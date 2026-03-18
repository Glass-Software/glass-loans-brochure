import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import { verifyUserCode } from "@/lib/db/queries";

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
    const { email, verificationCode } = body;

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
