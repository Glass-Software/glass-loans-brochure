import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import { verifyUserCode } from "@/lib/db/queries";
import { createSession } from "@/lib/auth/session";

/**
 * POST /api/auth/verify-code-pro
 *
 * Verifies the 6-digit verification code for Pro signup and creates a session.
 * Called from the signup page after checkout.
 *
 * Request body:
 * - email: string - User's email address
 * - verificationCode: string - 6-digit code sent to user
 *
 * Response:
 * - success: boolean
 * - redirectTo: string - URL to redirect to (dashboard)
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

    // Get IP address and user agent for session tracking
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Create session (sets HTTP-only cookie)
    await createSession(user.id, ip, userAgent);

    console.log(`✅ Pro user ${user.id} logged in successfully`);

    // Return success with redirect URL
    return NextResponse.json({
      success: true,
      redirectTo: "/dashboard",
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
      },
    });
  } catch (error) {
    console.error("❌ Verify code pro error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code. Please try again." },
      { status: 500 }
    );
  }
}
