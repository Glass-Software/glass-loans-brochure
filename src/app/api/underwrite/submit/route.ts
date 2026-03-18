import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import {
  incrementUsageCount,
  createSubmission,
  checkRateLimit,
  generateReportId,
} from "@/lib/db/queries";
import { validateCompleteForm } from "@/lib/underwriting/validation";
import {
  calculateUnderwriting,
  calculateFinalScore,
} from "@/lib/underwriting/calculations";
import { openRouterClient } from "@/lib/ai/openrouter";
import {
  generatePropertyEstimationPrompt,
  generateGaryValuationPrompt,
  generateGaryOpinionPrompt,
  PROPERTY_ESTIMATION_SYSTEM_PROMPT,
  GARY_VALUATION_SYSTEM_PROMPT,
  GARY_OPINION_SYSTEM_PROMPT,
  generateMockGaryOpinion,
} from "@/lib/ai/prompts";
import { verifyRecaptchaToken } from "@/lib/recaptcha/verify";
import type { UnderwritingFormData } from "@/types/underwriting";

/** AI property estimation response shape for OpenRouter generateJSON */
type PropertyEstimationResponse = {
  estimatedARV: number;
  asIsValue: number;
  monthlyRent: number;
  compsUsed: Array<{ address: string; price: number; sqft: number }>;
  marketAnalysis: string;
};

/**
 * Progress event types for streaming
 */
type ProgressEvent = {
  type: "progress" | "complete" | "error";
  step: number;
  status: string;
  progress: number;
  timestamp: string;
  data?: any;
};

/**
 * Helper to send progress events via stream
 */
function sendProgress(
  controller: ReadableStreamDefaultController,
  step: number,
  status: string,
  progress: number,
) {
  const event: ProgressEvent = {
    type: "progress",
    step,
    status,
    progress,
    timestamp: new Date().toISOString(),
  };

  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

/**
 * Helper to send completion event
 */
function sendComplete(controller: ReadableStreamDefaultController, data: any) {
  const event: ProgressEvent = {
    type: "complete",
    step: 5,
    status: "Analysis complete!",
    progress: 100,
    timestamp: new Date().toISOString(),
    data,
  };

  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

/**
 * Helper to send error event
 */
function sendError(
  controller: ReadableStreamDefaultController,
  error: string,
  code?: string,
) {
  const event: ProgressEvent = {
    type: "error",
    step: 0,
    status: error,
    progress: 0,
    timestamp: new Date().toISOString(),
    data: { code },
  };

  const encoder = new TextEncoder();
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    email,
    recaptchaToken,
    formData,
    propertyComps,
    compSelectionState,
  } = body;

  // Create a readable stream for progress updates
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Validate inputs (0-5%)
        sendProgress(controller, 1, "Validating request...", 5);

        if (!email || !formData) {
          sendError(
            controller,
            "Email and form data are required",
            "INVALID_REQUEST",
          );
          controller.close();
          return;
        }

        // Step 2: Validate form data
        const validation = validateCompleteForm(formData);
        if (!validation.valid) {
          sendError(controller, "Invalid form data", "INVALID_FORM");
          controller.close();
          return;
        }

        // Step 3: Verify reCAPTCHA token (5-15%)
        sendProgress(controller, 1, "Verifying security...", 10);

        const recaptchaVerification = await verifyRecaptchaToken(
          recaptchaToken,
          0.5,
        );

        if (!recaptchaVerification.success) {
          console.warn(
            "reCAPTCHA verification failed:",
            recaptchaVerification.error,
          );
          sendError(
            controller,
            "Security verification failed. Please try again.",
            "RECAPTCHA_FAILED",
          );
          controller.close();
          return;
        }

        console.log(
          "reCAPTCHA verified with score:",
          recaptchaVerification.score,
        );

        // Step 4: Get client IP for rate limiting
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : "unknown";

        // Step 5: Check rate limit (10 requests per hour per IP) (15-20%)
        sendProgress(controller, 1, "Checking rate limits...", 15);

        const rateLimit = await checkRateLimit(
          ip,
          "/api/underwrite/submit",
          10,
          60,
        );

        if (!rateLimit.allowed) {
          sendError(
            controller,
            "Rate limit exceeded. Please try again later.",
            "RATE_LIMIT",
          );
          controller.close();
          return;
        }

        // Step 6: Get verified user (20-25%)
        sendProgress(controller, 1, "Verifying user...", 20);

        const normalizedEmail = normalizeEmail(email);

        // Import findVerifiedUserByEmail (code was already verified in Step 5)
        const { findVerifiedUserByEmail } = await import("@/lib/db/queries");

        const user = findVerifiedUserByEmail(normalizedEmail);

        if (!user) {
          sendError(
            controller,
            "User not found or email not verified. Please complete email verification first.",
            "USER_NOT_VERIFIED",
          );
          controller.close();
          return;
        }

        // Step 7: Check usage limit
        if (user.usage_count >= user.usage_limit) {
          sendError(
            controller,
            `You've reached your limit of ${user.usage_limit} free underwriting ${user.usage_limit === 1 ? "analysis" : "analyses"}.`,
            "USAGE_LIMIT",
          );
          controller.close();
          return;
        }

        // Step 8: Process comps and comp selection (25-50%)
        sendProgress(controller, 2, "Processing comp selections...", 25);

        console.log("Processing comp selection...");

        let aiEstimates;

        // Comps are now fetched in Step 5 and passed from frontend
        if (propertyComps && compSelectionState) {
          console.log(
            `[Server] Using comps from Step 6 (${propertyComps.compsUsed.length} total comps)`,
          );

          // Filter comps based on user selection (remove comps marked as "removed")
          const activeComps = propertyComps.compsUsed.filter(
            (comp: any, idx: number) => {
              const state = compSelectionState.find(
                (s: any) => s.compIndex === idx,
              );
              return !state?.removed;
            },
          );

          console.log(
            `[Server] ${activeComps.length} active comps after filtering (${propertyComps.compsUsed.length - activeComps.length} removed)`,
          );

          // Validate minimum comps
          if (activeComps.length < 3) {
            sendError(
              controller,
              "At least 3 comps are required. Please select more comps.",
              "INSUFFICIENT_COMPS",
            );
            controller.close();
            return;
          }

          sendProgress(
            controller,
            2,
            `Using ${activeComps.length} selected comps...`,
            35,
          );

          // Recalculate ARV using WEIGHTED median (considers emphasis)
          const { calculateWeightedARVFromComps } = await import(
            "@/lib/underwriting/calculations"
          );
          const recalculatedARV = calculateWeightedARVFromComps(
            activeComps,
            compSelectionState,
            formData as UnderwritingFormData,
          );

          console.log(
            `[Server] Recalculated ARV: $${recalculatedARV.toLocaleString()} (was: $${propertyComps.estimatedARV.toLocaleString()})`,
          );

          aiEstimates = {
            estimatedARV: recalculatedARV,
            asIsValue: propertyComps.asIsValue,
            compsUsed: propertyComps.compsUsed, // ALL comps (not filtered)
            marketAnalysis:
              propertyComps.marketAnalysis ||
              "Market analysis based on selected comparable sales",
            confidence: activeComps.length >= 5 ? "high" : "medium",
            providerUsed: propertyComps.avmMetadata?.source || "user_selection",
          };

          sendProgress(
            controller,
            2,
            `ARV recalculated: $${recalculatedARV.toLocaleString()}`,
            40,
          );
        } else {
          // Fallback: Fetch comps if not provided (backward compatibility)
          console.log("[Server] No comps provided, fetching from providers...");
          sendProgress(controller, 2, "Researching property comps...", 25);

          try {
            // Try real estate data providers (RentCast, Realie, etc.)
            const { getPropertyEstimates, hasAvailableProvider } = await import(
              "@/lib/comps/provider"
            );

            if (hasAvailableProvider()) {
              sendProgress(
                controller,
                2,
                "Searching comparable properties...",
                25,
              );

              try {
                const result = await getPropertyEstimates(
                  formData as UnderwritingFormData,
                );
                aiEstimates = result;
                console.log(
                  `[Server] ${result.providerUsed} returned ${aiEstimates.compsUsed.length} comps`,
                );
                sendProgress(
                  controller,
                  2,
                  `Found ${aiEstimates.compsUsed.length} comparable sales (${result.providerUsed})`,
                  35,
                );
              } catch (providerError: any) {
                console.warn("[Server] Provider error:", providerError.message);

                // Distinguish between error types
                if (
                  providerError.code === "INVALID_PARAMS" ||
                  providerError.code === "INVALID_ADDRESS"
                ) {
                  sendError(
                    controller,
                    "Invalid property location. Please check the address.",
                    "INVALID_ADDRESS",
                  );
                  controller.close();
                  return;
                } else if (providerError.code === "RATE_LIMIT") {
                  console.warn("[Server] Rate limit hit, falling back to AI");
                } else if (providerError.code === "NOT_FOUND") {
                  console.warn("[Server] No comps found, falling back to AI");
                }

                // Fall through to AI fallback
                throw providerError;
              }
            } else {
              console.log(
                "[Server] No data providers configured - using AI fallback",
              );
              throw new Error("Primary data source not configured");
            }
          } catch (dataError: any) {
            // Fallback to AI estimation if Realie.ai failed or unavailable
            console.warn("[Server] Falling back to AI estimates");
            sendProgress(
              controller,
              2,
              "Using AI estimation (no market data available)...",
              30,
            );

            try {
              if (process.env.OPENROUTER_API_KEY) {
                const estimationPrompt = generatePropertyEstimationPrompt(
                  formData as UnderwritingFormData,
                );

                console.log("Calling OpenRouter for property estimates...");
                const aiResponse =
                  await openRouterClient.generateJSON<PropertyEstimationResponse>(
                    estimationPrompt,
                    {
                      systemPrompt: PROPERTY_ESTIMATION_SYSTEM_PROMPT,
                      temperature: 0.3,
                      maxTokens: 2000,
                    },
                  );

                // Add fallback markers
                aiEstimates = {
                  ...aiResponse,
                  batchDataUsed: false,
                  valuationMethod: "ai_fallback",
                  compTier: 3, // Mark as lowest confidence
                };

                console.log("AI estimates received successfully");
              } else {
                // Ultimate fallback: Simple heuristics
                console.warn(
                  "No API keys configured, using heuristic estimates",
                );
                aiEstimates = {
                  estimatedARV: formData.purchasePrice + formData.rehab * 1.5,
                  asIsValue: formData.purchasePrice * 0.85,
                  monthlyRent:
                    Math.round((formData.purchasePrice * 0.01) / 10) * 10,
                  compsUsed: [],
                  marketAnalysis:
                    "No real estate data available - using estimated values based on purchase price and rehab budget.",
                  batchDataUsed: false,
                  valuationMethod: "heuristic",
                };
              }
            } catch (aiError: any) {
              console.error("AI estimation also failed:", aiError);

              // Ultimate fallback
              aiEstimates = {
                estimatedARV: formData.purchasePrice + formData.rehab * 1.5,
                asIsValue: formData.purchasePrice * 0.85,
                compsUsed: [],
                marketAnalysis:
                  "Property estimates temporarily unavailable - using conservative estimates.",
                batchDataUsed: false,
                valuationMethod: "heuristic",
              };
            }

            sendProgress(controller, 2, "Fallback estimates complete", 50);
          }
        }

        // Step 9: Calculate all metrics TWICE (user ARV vs Gary ARV) (50-65%)
        sendProgress(controller, 3, "Calculating loan metrics...", 50);

        console.log("Calculating underwriting metrics...");
        const userCalculations = calculateUnderwriting(
          formData as UnderwritingFormData,
          formData.userEstimatedArv,
          aiEstimates.asIsValue,
        );

        let garyCalculations = calculateUnderwriting(
          formData as UnderwritingFormData,
          aiEstimates.estimatedARV,
          aiEstimates.asIsValue,
        );

        // Step 10: Calculate final score (use Gary's calculations for scoring)
        sendProgress(controller, 3, "Calculating final score...", 60);

        const finalScore = calculateFinalScore(
          garyCalculations,
          formData as UnderwritingFormData,
        );

        // Step 11: Generate Gary's valuations (CALL 1 - Low temperature) (65-75%)
        sendProgress(
          controller,
          4,
          "Calculating property valuations...",
          65,
        );

        console.log("Gary Call 1: Calculating valuations...");
        let garyAsIsValue: number;
        let garyEstimatedARV: number;
        let garyOpinion: string;
        const apiAsIsValue = aiEstimates.asIsValue; // Store API's as-is value separately

        try {
          if (process.env.OPENROUTER_API_KEY) {
            // CALL 1: Get valuations from Gary (low temperature for consistency)
            const valuationPrompt = generateGaryValuationPrompt(
              formData as UnderwritingFormData,
              aiEstimates.compsUsed,
              compSelectionState,
            );

            console.log("Calling OpenRouter for Gary's valuations (temp 0.15)...");
            const valuationResponse = await openRouterClient.generateJSON<{
              asIsValue: number;
              estimatedARV: number;
            }>(valuationPrompt, {
              systemPrompt: GARY_VALUATION_SYSTEM_PROMPT,
              temperature: 0.15, // Low temperature for consistent calculations
              maxTokens: 500, // Short response, just JSON
            });

            garyAsIsValue = valuationResponse.asIsValue;
            garyEstimatedARV = valuationResponse.estimatedARV;

            console.log(`Gary's As-Is: $${garyAsIsValue.toLocaleString()}`);
            console.log(`Gary's ARV: $${garyEstimatedARV.toLocaleString()}`);
            console.log(`API As-Is: $${apiAsIsValue.toLocaleString()}`);

            // Validate values are reasonable (basic sanity check)
            if (garyAsIsValue <= 0 || garyEstimatedARV <= 0) {
              throw new Error("Invalid valuations from Gary (values must be positive)");
            }
            if (garyEstimatedARV < garyAsIsValue * 0.8) {
              console.warn("Warning: Gary's ARV is significantly lower than as-is value");
            }

            sendProgress(
              controller,
              4,
              `Valuations calculated: ARV $${(garyEstimatedARV / 1000).toFixed(0)}k`,
              75,
            );

            // CALL 2: Get opinion from Gary (higher temperature for natural writing)
            sendProgress(
              controller,
              4,
              "Writing underwriting opinion...",
              80,
            );

            console.log("Gary Call 2: Writing opinion (temp 0.7)...");

            // Recalculate Gary's metrics using his valuations
            const garyCalculationsUpdated = calculateUnderwriting(
              formData as UnderwritingFormData,
              garyEstimatedARV,
              garyAsIsValue,
            );

            const opinionPrompt = generateGaryOpinionPrompt(
              formData as UnderwritingFormData,
              userCalculations,
              garyCalculationsUpdated,
              garyAsIsValue, // Pass Gary's as-is value
              garyEstimatedARV, // Pass Gary's ARV
              apiAsIsValue, // Pass API's as-is value for comparison
              aiEstimates.compsUsed,
              compSelectionState,
            );

            garyOpinion = await openRouterClient.generateText(opinionPrompt, {
              systemPrompt: GARY_OPINION_SYSTEM_PROMPT,
              temperature: 0.7, // Higher temperature for natural, conversational writing
              maxTokens: 1500,
            });

            console.log("Gary's opinion generated successfully");

            // Update garyCalculations for later use
            garyCalculations = garyCalculationsUpdated;

          } else {
            // Fallback: Use automated calculation if no API key
            console.log("No OPENROUTER_API_KEY, using automated calculations...");
            const { calculateARV } = await import("@/lib/rentcast/comps");
            garyEstimatedARV = calculateARV(aiEstimates.compsUsed, formData.rehab, formData.squareFeet);
            garyAsIsValue = apiAsIsValue; // Use API value as fallback
            garyOpinion = generateMockGaryOpinion(
              formData as UnderwritingFormData,
              garyCalculations,
              formData.userEstimatedArv,
              garyEstimatedARV,
            );
          }
        } catch (garyError: any) {
          console.error("Gary error:", garyError);
          // Fallback to automated calculation
          console.log("Falling back to automated calculation...");
          const { calculateARV } = await import("@/lib/rentcast/comps");
          garyEstimatedARV = calculateARV(aiEstimates.compsUsed, formData.rehab, formData.squareFeet);
          garyAsIsValue = apiAsIsValue;
          garyOpinion = generateMockGaryOpinion(
            formData as UnderwritingFormData,
            garyCalculations,
            formData.userEstimatedArv,
            garyEstimatedARV,
          );
        }

        // Update aiEstimates with Gary's valuations
        aiEstimates.estimatedARV = garyEstimatedARV;
        aiEstimates.asIsValue = garyAsIsValue;
        aiEstimates.apiAsIsValue = apiAsIsValue;

        // Step 12: Store submission in database (90-95%)
        sendProgress(controller, 5, "Saving results...", 90);

        console.log("Storing submission...");

        // Generate report ID and calculate expiration
        const reportId = generateReportId();
        const retentionDays = user.report_retention_days || 14;
        const expiresAt = new Date(
          Date.now() + retentionDays * 24 * 60 * 60 * 1000,
        ).toISOString();

        const submission = createSubmission({
          userId: user.id,
          propertyAddress: formData.propertyAddress,
          propertyCity: formData.propertyCity,
          propertyState: formData.propertyState,
          propertyZip: formData.propertyZip,
          propertyCounty: formData.propertyCounty,
          propertyLatitude: aiEstimates?.subjectLatitude ?? propertyComps?.subjectLatitude ?? formData.propertyLatitude,
          propertyLongitude: aiEstimates?.subjectLongitude ?? propertyComps?.subjectLongitude ?? formData.propertyLongitude,
          purchasePrice: formData.purchasePrice,
          rehab: formData.rehab,
          squareFeet: formData.squareFeet,
          bedrooms: formData.bedrooms,
          bathrooms: formData.bathrooms,
          yearBuilt: formData.yearBuilt,
          propertyType: formData.propertyType,
          propertyCondition: formData.propertyCondition,
          renovationPerSf: formData.renovationPerSf,
          userEstimatedAsIsValue: formData.userEstimatedAsIsValue,
          userEstimatedArv: formData.userEstimatedArv,
          interestRate: formData.interestRate,
          months: formData.months,
          loanAtPurchase: formData.loanAtPurchase,
          renovationFunds: formData.renovationFunds || 0,
          closingCostsPercent: formData.closingCostsPercent,
          points: formData.points,
          marketType: formData.marketType,
          additionalDetails: formData.additionalDetails,
          estimatedArv: aiEstimates.estimatedARV,
          asIsValue: aiEstimates.asIsValue,
          finalScore,
          garyOpinion,
          propertyComps: aiEstimates.compsUsed, // ALL comps
          compSelectionState: compSelectionState
            ? JSON.stringify(compSelectionState)
            : null,
          reportId,
          expiresAt,
          ipAddress: ip,
          recaptchaScore: recaptchaVerification.score || 0,
        });

        // Step 13: Increment usage count
        incrementUsageCount(user.id);

        // Step 14: Send email with report link (90-95%)
        sendProgress(controller, 5, "Sending report link to your email...", 95);

        const sgMail = (await import("@sendgrid/mail")).default;

        if (!process.env.SENDGRID_API_KEY) {
          throw new Error("SENDGRID_API_KEY is not set");
        }

        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const reportUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "https://glassloans.io"}/underwrite/results/${reportId}`;

        await sgMail.send({
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
          subject: "Your Underwriting Report Link - Glass Loans",
          text: `Your underwriting report is ready!\n\nView your report: ${reportUrl}\n\nThis link will be valid for ${retentionDays} days.\n\nBest,\nGlass Loans Team`,
          html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4A6CF7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Glass Loans</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Your Report is Ready!</h2>
    <p>Your underwriting analysis has been completed.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${reportUrl}" style="background-color: #4A6CF7; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Report</a>
    </div>
    <p style="font-size: 14px; color: #666;">This link will be valid for ${retentionDays} days.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206</p>
  </div>
</body>
</html>`,
        });

        // Step 15: Return success with reportId for immediate redirect
        sendComplete(controller, {
          success: true,
          reportId,
          emailSent: true,
          message: "Report generated successfully! Redirecting...",
        });

        controller.close();
      } catch (error: any) {
        console.error("Underwriting submission error:", error);
        sendError(
          controller,
          "An error occurred while processing your underwriting request",
          "SERVER_ERROR",
        );
        controller.close();
      }
    },
  });

  // Return streaming response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
