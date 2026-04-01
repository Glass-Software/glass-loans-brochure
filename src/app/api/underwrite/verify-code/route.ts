import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeEmail } from "@/lib/email/normalization";
import { verifyUserCode } from "@/lib/db/queries";
import { verifyRecaptchaToken } from "@/lib/recaptcha/verify";
import { createSession } from "@/lib/auth/session";

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

    // Verify reCAPTCHA token (skip if not provided - for local development)
    if (recaptchaToken) {
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
    }

    // Rate limiting DISABLED - causes database locking issues on Fly.io
    // const forwarded = request.headers.get("x-forwarded-for");
    // const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    // const rateLimit = checkRateLimit(ip, "/api/underwrite/verify-code", 10, 60);
    // if (!rateLimit.allowed) {
    //   return NextResponse.json({ success: false, error: "Too many verification attempts. Please try again later." }, { status: 429 });
    // }

    // Normalize email and verify code
    const normalizedEmail = normalizeEmail(email);
    const user = await verifyUserCode(verificationCode, normalizedEmail);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification code. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Create session for the user (both free and Pro users get sessions now)
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded ? forwarded.split(",")[0] : undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    await createSession(user.id, ipAddress, userAgent);

    console.log(`✅ Session created for user ${user.id} (${user.email})`);

    // Add user to ActiveCampaign list 11 (all users, free and Pro)
    try {
      const { addFreeUser } = await import("@/lib/activecampaign/client");
      await addFreeUser(
        user.email,
        user.usageCount,
        undefined, // propertyState (not available at verification time)
        user.firstName || undefined,
        user.lastName || undefined
      );
      console.log(`✅ [verify-code] User ${user.email} added to ActiveCampaign list 11`);
    } catch (error: any) {
      // Don't fail verification if ActiveCampaign fails - log and continue
      console.error(`❌ [verify-code] ActiveCampaign error (non-critical):`, error.message);
    }

    // Clear promo cookie (database is now source of truth)
    const cookieStore = await cookies();
    cookieStore.delete("gl_promo_expires");
    console.log("🍪 [verify-code] Promo cookie cleared (user authenticated)");

    // Return success
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
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
