import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setPromoExpiry } from "@/lib/db/queries";

/**
 * GET /api/users/check-limit
 *
 * Check if the authenticated user has exceeded their usage limit.
 * Returns limitReached=true if user has hit their limit.
 *
 * Used by Step 4 and Step 5 to prevent authenticated users from
 * proceeding to Step 6 (which triggers expensive API calls) if they've
 * exceeded their limit.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user has exceeded their usage limit
    // Note: This applies to both free and Pro users (Pro users have higher limits)
    if (user.usage_count >= user.usage_limit) {
      // Set promo expiry (1 hour from now) if not already set
      let promoExpiresAt: Date;

      if (user.promo_expires_at && new Date(user.promo_expires_at) > new Date()) {
        // User already has an active promo
        promoExpiresAt = new Date(user.promo_expires_at);
      } else {
        // Set new promo expiry
        promoExpiresAt = new Date(Date.now() + 3600000);
        await setPromoExpiry(user.id);
      }

      return NextResponse.json({
        limitReached: true,
        usageCount: user.usage_count,
        usageLimit: user.usage_limit,
        promoExpiresAt: promoExpiresAt.toISOString(),
      });
    }

    // User is within their limit
    return NextResponse.json({
      limitReached: false,
      usageCount: user.usage_count,
      usageLimit: user.usage_limit,
    });
  } catch (error: any) {
    console.error("❌ [check-limit] Error:", error);
    return NextResponse.json(
      { error: "Failed to check usage limit" },
      { status: 500 }
    );
  }
}
