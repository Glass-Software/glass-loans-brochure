import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, recaptchaToken, formData } = body;

    // Step 1: Validate inputs
    if (!email || !formData) {
      return NextResponse.json(
        { error: "Email and form data are required" },
        { status: 400 },
      );
    }

    // Step 2: Validate form data
    const validation = validateCompleteForm(formData);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Invalid form data",
          details: validation.errors,
        },
        { status: 400 },
      );
    }

    // Step 3: Verify reCAPTCHA token
    const recaptchaVerification = await verifyRecaptchaToken(recaptchaToken, 0.5);

    if (!recaptchaVerification.success) {
      console.warn("reCAPTCHA verification failed:", recaptchaVerification.error);
      return NextResponse.json(
        {
          error: "Security verification failed. Please try again.",
          code: "RECAPTCHA_FAILED",
        },
        { status: 400 },
      );
    }

    console.log("reCAPTCHA verified with score:", recaptchaVerification.score);

    // Step 4: Get client IP for rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";

    // Step 5: Check rate limit (10 requests per hour per IP)
    const rateLimit = await checkRateLimit(ip, "/api/underwrite/submit", 10, 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT",
        },
        { status: 429 },
      );
    }

    // Step 6: Normalize email and find user
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByNormalizedEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        {
          error: "Email not found. Please verify your email first.",
          code: "INVALID_EMAIL",
        },
        { status: 400 },
      );
    }

    if (!user.email_verified) {
      return NextResponse.json(
        {
          error: "Email not verified. Please check your inbox for the verification link.",
          code: "INVALID_EMAIL",
        },
        { status: 400 },
      );
    }

    // Step 7: Check usage limit
    if (user.usage_count >= 3) {
      return NextResponse.json(
        {
          error: "You've reached your limit of 3 free underwriting analyses.",
          code: "USAGE_LIMIT",
          limitReached: true,
        },
        { status: 403 },
      );
    }

    // Step 8: Get AI property estimates
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
        monthlyRent: Math.round((formData.purchasePrice * 0.01) / 10) * 10,
        compsUsed: [],
        marketAnalysis:
          "AI analysis temporarily unavailable - using estimated values.",
      };
    }

    // Step 9: Calculate all metrics
    console.log("Calculating underwriting metrics...");
    const calculations = calculateUnderwriting(
      formData as UnderwritingFormData,
      aiEstimates,
    );

    // Step 10: Calculate final score
    const finalScore = calculateFinalScore(
      calculations,
      formData as UnderwritingFormData,
    );

    // Step 11: Generate Gary's opinion
    console.log("Generating Gary's opinion...");
    let garyOpinion;

    try {
      if (process.env.OPENROUTER_API_KEY) {
        const opinionPrompt = generateGaryOpinionPrompt(
          formData as UnderwritingFormData,
          calculations,
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
          calculations,
        );
      }
    } catch (opinionError) {
      console.error("Opinion generation error:", opinionError);
      garyOpinion = generateMockGaryOpinion(
        formData as UnderwritingFormData,
        calculations,
      );
    }

    // Step 12: Store submission in database
    console.log("Storing submission...");
    await createSubmission({
      userId: user.id,
      propertyAddress: formData.propertyAddress,
      purchasePrice: formData.purchasePrice,
      rehab: formData.rehab,
      squareFeet: formData.squareFeet,
      propertyCondition: formData.propertyCondition,
      renovationPerSf: formData.renovationPerSf,
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
      monthlyRent: aiEstimates.monthlyRent,
      finalScore,
      garyOpinion,
      propertyComps: aiEstimates.compsUsed,
      ipAddress: ip,
      recaptchaScore: recaptchaVerification.score || 0,
    });

    // Step 13: Increment usage count
    await incrementUsageCount(user.id);

    // Step 14: Return results
    return NextResponse.json({
      success: true,
      results: {
        formData,
        aiEstimates,
        calculations,
        garyOpinion,
        finalScore,
        submittedAt: new Date(),
        usageCount: user.usage_count + 1,
        usageLimit: 3,
      },
    });
  } catch (error: any) {
    console.error("Underwriting submission error:", error);
    return NextResponse.json(
      {
        error: "An error occurred while processing your underwriting request",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
