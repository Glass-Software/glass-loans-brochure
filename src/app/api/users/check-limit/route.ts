import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { setPromoExpiry } from "@/lib/db/queries";

// Force dynamic behavior - no caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

    // Debug logging to help diagnose limit issues
    console.log(`🔍 [check-limit] User ${user.email}: usageCount=${user.usageCount}, usageLimit=${user.usageLimit}`);

    // Check if user has exceeded their usage limit
    // Note: This applies to both free and Pro users (Pro users have higher limits)
    if (user.usageCount >= user.usageLimit) {
      // Set promo expiry (1 hour from now) if not already set
      let promoExpiresAt: Date;

      if (user.promoExpiresAt && new Date(user.promoExpiresAt) > new Date()) {
        // User already has an active promo
        promoExpiresAt = new Date(user.promoExpiresAt);
      } else {
        // Set new promo expiry
        promoExpiresAt = new Date(Date.now() + 3600000);
        await setPromoExpiry(user.id);
      }

      const response = NextResponse.json({
        limitReached: true,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        promoExpiresAt: promoExpiresAt.toISOString(),
      });
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }

    // User is within their limit
    const response = NextResponse.json({
      limitReached: false,
      usageCount: user.usageCount,
      usageLimit: user.usageLimit,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (error: any) {
    console.error("❌ [check-limit] Error:", error);
    return NextResponse.json(
      { error: "Failed to check usage limit" },
      { status: 500 }
    );
  }
}
