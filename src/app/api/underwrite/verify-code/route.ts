import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import { verifyUserCode, checkRateLimit } from "@/lib/db/queries";
import { verifyRecaptchaToken } from "@/lib/recaptcha/verify";

/**
 * POST /api/underwrite/verify-code
 *
 * Verifies the 6-digit email verification code without submitting the full report.
 * This endpoint is called from Step 5 (Email Verification) before proceeding to Step 6 (Comp Selection).
 *
 * Request body:
 * - email: string - User's email address
 * - verificationCode: string - 6-digit code sent to user
 *
 * Response:
 * - success: boolean
 * - user: User object if successful
 * - error: string if failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, verificationCode, recaptchaToken } = body;

    // Validate inputs
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!verificationCode || typeof verificationCode !== "string") {
      return NextResponse.json(
        { success: false, error: "Verification code is required" },
        { status: 400 }
      );
    }

    // Verify reCAPTCHA token (before code verification)
    if (!recaptchaToken) {
      return NextResponse.json(
        { success: false, error: "Security verification required" },
        { status: 400 }
      );
    }

    const recaptchaVerification = await verifyRecaptchaToken(recaptchaToken, 0.5);

    if (!recaptchaVerification.success) {
      console.warn("reCAPTCHA verification failed:", recaptchaVerification.error);
      return NextResponse.json(
        {
          success: false,
          error: "Security verification failed. Please try again.",
        },
        { status: 400 }
      );
    }

    // Rate limiting per IP (fallback protection - 10 attempts per hour)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";

    const rateLimit = checkRateLimit(ip, "/api/underwrite/verify-code", 10, 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many verification attempts. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Normalize email and verify code
    const normalizedEmail = normalizeEmail(email);
    const user = verifyUserCode(verificationCode, normalizedEmail);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification code. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Return success
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified === 1,
        usageCount: user.usage_count,
        usageLimit: user.usage_limit,
      },
    });
  } catch (error) {
    console.error("❌ Verify code error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code. Please try again." },
      { status: 500 }
    );
  }
}
