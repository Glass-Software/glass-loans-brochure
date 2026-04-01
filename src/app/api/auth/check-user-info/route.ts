import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import { findUserByNormalizedEmail } from "@/lib/db/queries";

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/check-user-info
 *
 * Checks if a user exists and has their name set.
 * Used during Pro signup to determine if we need to collect user information.
 *
 * Query params:
 * - email: string - User's email address
 *
 * Response:
 * - hasName: boolean - Whether user has both firstName and lastName set
 * - hasMarketingConsent: boolean - Whether user has marketing consent
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by normalized email
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByNormalizedEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has both first and last name
    const hasName = !!(user.firstName && user.lastName);

    return NextResponse.json({
      hasName,
      hasMarketingConsent: user.marketingConsent || false,
    });
  } catch (error: any) {
    console.error("❌ [check-user-info] Error:", error);
    return NextResponse.json(
      { error: "Failed to check user information" },
      { status: 500 }
    );
  }
}
