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

/**
 * Validate propertyComps structure to prevent malicious data injection
 */
function validatePropertyComps(propertyComps: any): { valid: boolean; error?: string } {
  if (!propertyComps) {
    return { valid: true }; // Optional field
  }

  // Validate top-level structure
  if (typeof propertyComps.estimatedARV !== 'number' || propertyComps.estimatedARV <= 0) {
    return { valid: false, error: "Invalid ARV value" };
  }

  if (typeof propertyComps.asIsValue !== 'number' || propertyComps.asIsValue <= 0) {
    return { valid: false, error: "Invalid as-is value" };
  }

  // Validate compsUsed array
  if (!Array.isArray(propertyComps.compsUsed)) {
    return { valid: false, error: "Invalid comps array" };
  }

  // Limit number of comps (prevent DoS)
  if (propertyComps.compsUsed.length > 50) {
    return { valid: false, error: "Too many comps" };
  }

  // Validate each comp
  for (const comp of propertyComps.compsUsed) {
    // Required fields
    if (!comp.address || typeof comp.address !== 'string') {
      return { valid: false, error: "Invalid comp address" };
    }

    if (typeof comp.price !== 'number' || comp.price <= 0 || comp.price > 100000000) {
      return { valid: false, error: "Invalid comp price" };
    }

    if (typeof comp.sqft !== 'number' || comp.sqft <= 0 || comp.sqft > 50000) {
      return { valid: false, error: "Invalid comp square footage" };
    }

    // Sanitize string fields (max length)
    comp.address = comp.address.substring(0, 500);
    if (comp.listingUrl && typeof comp.listingUrl === 'string') {
      comp.listingUrl = comp.listingUrl.substring(0, 1000);
    }
  }

  return { valid: true };
}

/**
 * Validate compSelectionState to prevent manipulation
 */
function validateCompSelectionState(compSelectionState: any, compsCount: number): { valid: boolean; error?: string } {
  if (!compSelectionState) {
    return { valid: true }; // Optional field
  }

  if (!Array.isArray(compSelectionState)) {
    return { valid: false, error: "Invalid selection state" };
  }

  // Count active comps
  let activeCount = 0;

  for (const state of compSelectionState) {
    // Validate structure
    if (typeof state.compIndex !== 'number' ||
        typeof state.emphasized !== 'boolean' ||
        typeof state.removed !== 'boolean') {
      return { valid: false, error: "Invalid selection state structure" };
    }

    // Validate compIndex is within bounds
    if (state.compIndex < 0 || state.compIndex >= compsCount) {
      return { valid: false, error: "Invalid comp index" };
    }

    if (!state.removed) {
      activeCount++;
    }
  }

  // Validate minimum comps requirement
  if (activeCount < 3) {
    return { valid: false, error: "At least 3 comps must be selected" };
  }

  return { valid: true };
}

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
    step: 6,
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

        // Additional validation: String lengths to prevent DB overflow / DoS
        if (formData.propertyAddress.length > 500) {
          sendError(controller, "Property address too long", "INVALID_INPUT");
          controller.close();
          return;
        }

        if (formData.additionalDetails && formData.additionalDetails.length > 5000) {
          sendError(controller, "Additional details too long", "INVALID_INPUT");
          controller.close();
          return;
        }

        // Additional validation: Numeric ranges
        if (formData.purchasePrice < 1000 || formData.purchasePrice > 100000000) {
          sendError(controller, "Invalid purchase price", "INVALID_INPUT");
          controller.close();
          return;
        }

        if (formData.squareFeet < 100 || formData.squareFeet > 50000) {
          sendError(controller, "Invalid square footage", "INVALID_INPUT");
          controller.close();
          return;
        }

        if (formData.rehab < 0 || formData.rehab > 10000000) {
          sendError(controller, "Invalid rehab budget", "INVALID_INPUT");
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

        let aiEstimates;

        // Validate propertyComps if provided
        if (propertyComps) {
          const compsValidation = validatePropertyComps(propertyComps);
          if (!compsValidation.valid) {
            sendError(controller, compsValidation.error || "Invalid comp data", "INVALID_COMPS");
            controller.close();
            return;
          }
        }

        // Validate compSelectionState if provided
        if (compSelectionState && propertyComps) {
          const selectionValidation = validateCompSelectionState(
            compSelectionState,
            propertyComps.compsUsed.length
          );
          if (!selectionValidation.valid) {
            sendError(controller, selectionValidation.error || "Invalid selection state", "INVALID_SELECTION");
            controller.close();
            return;
          }
        }

        // Comps are now fetched in Step 6 and passed from frontend
        if (propertyComps && compSelectionState) {
          // Filter comps based on user selection (remove comps marked as "removed")
          const activeComps = propertyComps.compsUsed.filter(
            (comp: any, idx: number) => {
              const state = compSelectionState.find(
                (s: any) => s.compIndex === idx,
              );
              return !state?.removed;
            },
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

        // Step 9: Calculate preliminary metrics for scoring (50-60%)
        sendProgress(controller, 3, "Calculating loan metrics...", 50);

        // Calculate preliminary Gary calculations (will be recalculated after Gary's analysis)
        let garyCalculations = calculateUnderwriting(
          formData as UnderwritingFormData,
          aiEstimates.estimatedARV,
          aiEstimates.asIsValue,
        );

        // Step 10: Calculate preliminary final score (60-65%)
        sendProgress(controller, 3, "Calculating final score...", 60);

        let finalScore = calculateFinalScore(
          garyCalculations,
          formData as UnderwritingFormData,
        );

        // Step 11: Generate Gary's valuations (CALL 1 - Low temperature) (65-75%)
        sendProgress(
          controller,
          4,
          "Gary is analyzing comparable sales...",
          65,
        );

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
              `Gary calculated ARV: $${(garyEstimatedARV / 1000).toFixed(0)}k`,
              75,
            );

            // CALL 2: Get opinion from Gary (higher temperature for natural writing)
            sendProgress(
              controller,
              5,
              "Gary is writing your underwriting report...",
              80,
            );

            // Recalculate Gary's metrics using his valuations
            const garyCalculationsUpdated = calculateUnderwriting(
              formData as UnderwritingFormData,
              garyEstimatedARV,
              garyAsIsValue,
            );

            // Recalculate final score based on Gary's actual valuations (not preliminary AI estimates)
            finalScore = calculateFinalScore(
              garyCalculationsUpdated,
              formData as UnderwritingFormData,
            );

            const opinionPrompt = generateGaryOpinionPrompt(
              formData as UnderwritingFormData,
              garyCalculationsUpdated,
              garyCalculationsUpdated,
              garyAsIsValue, // Pass Gary's as-is value
              garyEstimatedARV, // Pass Gary's ARV
              apiAsIsValue, // Pass API's as-is value for comparison
              aiEstimates.compsUsed,
              compSelectionState,
              finalScore, // Pass recalculated score based on Gary's valuations
            );

            garyOpinion = await openRouterClient.generateText(opinionPrompt, {
              systemPrompt: GARY_OPINION_SYSTEM_PROMPT,
              temperature: 0.7, // Higher temperature for natural, conversational writing
              maxTokens: 1500,
            });

            // Update garyCalculations for later use
            garyCalculations = garyCalculationsUpdated;

          } else {
            // Fallback: Use automated calculation if no API key
            console.log("No OPENROUTER_API_KEY, using automated calculations...");
            const { calculateARV } = await import("@/lib/rentcast/comps");
            garyEstimatedARV = calculateARV(aiEstimates.compsUsed, formData.rehab, formData.squareFeet);
            garyAsIsValue = apiAsIsValue; // Use API value as fallback

            // Recalculate with automated valuations
            garyCalculations = calculateUnderwriting(
              formData as UnderwritingFormData,
              garyEstimatedARV,
              garyAsIsValue,
            );
            finalScore = calculateFinalScore(garyCalculations, formData as UnderwritingFormData);

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

          // Recalculate with fallback valuations
          garyCalculations = calculateUnderwriting(
            formData as UnderwritingFormData,
            garyEstimatedARV,
            garyAsIsValue,
          );
          finalScore = calculateFinalScore(garyCalculations, formData as UnderwritingFormData);

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

        // Step 12: Store submission in database (85-95%)
        sendProgress(controller, 6, "Saving your report...", 85);

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
        sendProgress(controller, 6, "Sending report link to your email...", 95);

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
