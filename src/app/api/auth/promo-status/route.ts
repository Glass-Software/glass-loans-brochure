import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ hasPromo: false, expiresAt: null });
    }

    // Pro users should never see the banner
    if (user.tier === "pro") {
      return NextResponse.json({ hasPromo: false, expiresAt: null });
    }

    // Check if user has active promo
    const promoExpiresAt = user.promoExpiresAt ? new Date(user.promoExpiresAt) : null;
    const hasPromo = promoExpiresAt ? promoExpiresAt > new Date() : false;

    return NextResponse.json({
      hasPromo,
      expiresAt: hasPromo ? promoExpiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error("Error fetching promo status:", error);
    return NextResponse.json(
      { error: "Failed to fetch promo status" },
      { status: 500 }
    );
  }
}
