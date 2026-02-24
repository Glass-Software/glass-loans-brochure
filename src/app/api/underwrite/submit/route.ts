import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  incrementUsageCount,
  createSubmission,
  checkRateLimit,
} from "@/lib/db/queries";
import { validateCompleteForm } from "@/lib/underwriting/validation";
import {
  calculateUnderwriting,
  calculateFinalScore,
} from "@/lib/underwriting/calculations";
import { openRouterClient } from "@/lib/ai/openrouter";
import {
  generatePropertyEstimationPrompt,
  generateGaryOpinionPrompt,
  PROPERTY_ESTIMATION_SYSTEM_PROMPT,
  GARY_OPINION_SYSTEM_PROMPT,
  generateMockGaryOpinion,
} from "@/lib/ai/prompts";
import { verifyRecaptchaToken } from "@/lib/recaptcha/verify";
import type { UnderwritingFormData } from "@/types/underwriting";

/**
 * Progress event types for streaming
 */
type ProgressEvent = {
  type: 'progress' | 'complete' | 'error';
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
  progress: number
) {
  const event: ProgressEvent = {
    type: 'progress',
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
function sendComplete(
  controller: ReadableStreamDefaultController,
  data: any
) {
  const event: ProgressEvent = {
    type: 'complete',
    step: 5,
    status: 'Analysis complete!',
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
  code?: string
) {
  const event: ProgressEvent = {
    type: 'error',
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
  const { email, recaptchaToken, formData } = body;

  // Create a readable stream for progress updates
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Validate inputs (0-5%)
        sendProgress(controller, 1, "Validating request...", 5);

        if (!email || !formData) {
          sendError(controller, "Email and form data are required", "INVALID_REQUEST");
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

        const recaptchaVerification = await verifyRecaptchaToken(recaptchaToken, 0.5);

        if (!recaptchaVerification.success) {
          console.warn("reCAPTCHA verification failed:", recaptchaVerification.error);
          sendError(controller, "Security verification failed. Please try again.", "RECAPTCHA_FAILED");
          controller.close();
          return;
        }

        console.log("reCAPTCHA verified with score:", recaptchaVerification.score);

        // Step 4: Get client IP for rate limiting
        const forwarded = request.headers.get("x-forwarded-for");
        const ip = forwarded ? forwarded.split(",")[0] : "unknown";

        // Step 5: Check rate limit (10 requests per hour per IP) (15-20%)
        sendProgress(controller, 1, "Checking rate limits...", 15);

        const rateLimit = await checkRateLimit(ip, "/api/underwrite/submit", 10, 60);

        if (!rateLimit.allowed) {
          sendError(controller, "Rate limit exceeded. Please try again later.", "RATE_LIMIT");
          controller.close();
          return;
        }

        // Step 6: Normalize email and find/create user (20-25%)
        sendProgress(controller, 1, "Verifying email...", 20);

        const normalizedEmail = normalizeEmail(email);
        let user = findUserByNormalizedEmail(normalizedEmail);

        // If user doesn't exist, this means they skipped the verify-email step
        // Create them now (they'll get verification email after underwriting)
        if (!user) {
          const { user: newUser } = createUser(email, normalizedEmail);
          user = newUser;
        }

        // Step 7: Check usage limit (for all users, verified or not)
        if (user.usage_count >= user.usage_limit) {
          sendError(
            controller,
            `You've reached your limit of ${user.usage_limit} free underwriting ${user.usage_limit === 1 ? "analysis" : "analyses"}.`,
            "USAGE_LIMIT"
          );
          controller.close();
          return;
        }

        // Step 8: Get AI property estimates (25-50%)
        sendProgress(controller, 2, "Researching property comps with AI...", 25);

        console.log("Fetching AI property estimates...");
        console.log("OpenRouter API Key configured:", !!process.env.OPENROUTER_API_KEY);

        let aiEstimates;
        try {
          if (process.env.OPENROUTER_API_KEY) {
            const estimationPrompt =
              generatePropertyEstimationPrompt(formData as UnderwritingFormData);

            console.log("Calling OpenRouter for property estimates...");
            aiEstimates = await openRouterClient.generateJSON<{
              estimatedARV: number;
              asIsValue: number;
              monthlyRent: number;
              compsUsed: Array<{
                address: string;
                price: number;
                sqft: number;
              }>;
              marketAnalysis: string;
            }>(estimationPrompt, {
              systemPrompt: PROPERTY_ESTIMATION_SYSTEM_PROMPT,
              temperature: 0.3, // Lower temperature for more consistent estimates
              maxTokens: 2000,
            });
            console.log("Property estimates received successfully");
          } else {
            // Fallback estimates if no API key
            console.warn("OpenRouter API key not set, using fallback estimates");
            aiEstimates = {
              estimatedARV: formData.purchasePrice + formData.rehab * 1.5,
              asIsValue: formData.purchasePrice * 0.85,
              monthlyRent: Math.round((formData.purchasePrice * 0.01) / 10) * 10,
              compsUsed: [],
              marketAnalysis:
                "No AI analysis available - using estimated values based on purchase price and rehab budget.",
            };
          }
        } catch (aiError: any) {
          console.error("AI estimation error:", {
            message: aiError.message,
            name: aiError.name,
            stack: aiError.stack,
          });

          // Use fallback estimates
          aiEstimates = {
            estimatedARV: formData.purchasePrice + formData.rehab * 1.5,
            asIsValue: formData.purchasePrice * 0.85,
            compsUsed: [],
            marketAnalysis:
              "AI analysis temporarily unavailable - using estimated values.",
          };
        }

        // Step 9: Calculate all metrics TWICE (user ARV vs Gary ARV) (50-65%)
        sendProgress(controller, 3, "Calculating loan metrics...", 50);

        console.log("Calculating underwriting metrics...");
        const userCalculations = calculateUnderwriting(
          formData as UnderwritingFormData,
          formData.userEstimatedArv,
          aiEstimates.asIsValue,
        );

        const garyCalculations = calculateUnderwriting(
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

        // Step 11: Generate Gary's opinion (using both calculations) (65-90%)
        sendProgress(controller, 4, "Getting Gary's underwriting opinion...", 65);

        console.log("Generating Gary's opinion...");
        let garyOpinion: string;

        try {
          if (process.env.OPENROUTER_API_KEY) {
            const opinionPrompt = generateGaryOpinionPrompt(
              formData as UnderwritingFormData,
              userCalculations,
              garyCalculations,
              aiEstimates,
            );

            garyOpinion = await openRouterClient.generateText(opinionPrompt, {
              systemPrompt: GARY_OPINION_SYSTEM_PROMPT,
              temperature: 0.7,
              maxTokens: 1500,
            });
          } else {
            // Use mock opinion if no API key
            garyOpinion = generateMockGaryOpinion(
              formData as UnderwritingFormData,
              garyCalculations,
              formData.userEstimatedArv,
              aiEstimates.estimatedARV,
            );
          }
        } catch (opinionError) {
          console.error("Opinion generation error:", opinionError);
          garyOpinion = generateMockGaryOpinion(
            formData as UnderwritingFormData,
            garyCalculations,
            formData.userEstimatedArv,
            aiEstimates.estimatedARV,
          );
        }

        // Step 12: Store submission in database (90-95%)
        sendProgress(controller, 5, "Saving results...", 90);

        console.log("Storing submission...");
        const submission = createSubmission({
          userId: user.id,
          propertyAddress: formData.propertyAddress,
          propertyCity: formData.propertyCity,
          propertyState: formData.propertyState,
          propertyZip: formData.propertyZip,
          purchasePrice: formData.purchasePrice,
          rehab: formData.rehab,
          squareFeet: formData.squareFeet,
          propertyCondition: formData.propertyCondition,
          renovationPerSf: formData.renovationPerSf,
          userEstimatedArv: formData.userEstimatedArv,
          interestRate: formData.interestRate,
          months: formData.months,
          loanAtPurchase: formData.loanAtPurchase,
          renovationFunds: formData.renovationFunds || 0,
          closingCostsPercent: formData.closingCostsPercent,
          points: formData.points,
          marketType: formData.marketType,
          additionalDetails: formData.additionalDetails,
          compLinks: formData.compLinks,
          estimatedArv: aiEstimates.estimatedARV,
          asIsValue: aiEstimates.asIsValue,
          finalScore,
          garyOpinion,
          propertyComps: aiEstimates.compsUsed,
          ipAddress: ip,
          recaptchaScore: recaptchaVerification.score || 0,
        });

        // Step 13: Increment usage count
        incrementUsageCount(user.id);

        // Step 14: Handle response based on verification status
        if (!user.email_verified) {
          // User not verified yet - send verification email with link to results
          sendProgress(controller, 5, "Sending verification email...", 95);
          console.log("Sending verification email to unverified user...");

          // Import sendgrid and regenerate token
          const { regenerateVerificationToken } = await import("@/lib/db/queries");
          const sgMail = (await import("@sendgrid/mail")).default;

          if (!process.env.SENDGRID_API_KEY) {
            throw new Error("SENDGRID_API_KEY is not set");
          }

          sgMail.setApiKey(process.env.SENDGRID_API_KEY);

          const { token } = regenerateVerificationToken(user.id);
          const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/underwrite/verify?token=${token}&submission=${submission.id}`;

          await sgMail.send({
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
            subject: "Verify Your Email - View Your Underwriting Results",
            text: `Click the link to verify your email and view your underwriting results: ${verificationUrl}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4A6CF7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Glass Loans</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Your Underwriting Analysis is Ready!</h2>
    <p>Gary has analyzed your property at <strong>${formData.propertyAddress}</strong>.</p>
    <p><strong>Final Score: ${finalScore}/100</strong></p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #4A6CF7; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email & View Results</a>
    </div>
    <p style="font-size: 14px; color: #666;">This link expires in 24 hours.</p>
    <p style="font-size: 14px; color: #666;"><strong>Note:</strong> Free tier includes limited uses per verified email address.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206</p>
  </div>
</body>
</html>`,
          });

          sendComplete(controller, {
            success: true,
            emailSent: true,
            message: "Check your email to view your underwriting results.",
            submissionId: submission.id,
          });
        } else {
          // Step 15: User is verified - return results immediately (with dual calculations)
          sendComplete(controller, {
            success: true,
            results: {
              formData,
              aiEstimates,
              calculations: garyCalculations, // Primary calculations (for compatibility)
              userCalculations, // User's ARV calculations
              garyCalculations, // Gary's ARV calculations
              garyOpinion,
              finalScore,
              submittedAt: new Date(),
              usageCount: user.usage_count + 1,
              usageLimit: user.usage_limit,
            },
          });
        }

        controller.close();
      } catch (error: any) {
        console.error("Underwriting submission error:", error);
        sendError(
          controller,
          "An error occurred while processing your underwriting request",
          "SERVER_ERROR"
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
      "Connection": "keep-alive",
    },
  });
}
