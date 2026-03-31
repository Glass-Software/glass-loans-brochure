import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe/client";
import { getCurrentUser } from "@/lib/auth/session";
import { STRIPE_PRICES } from "@/lib/stripe/prices";

export async function GET(request: Request) {
  try {
    // Get plan parameter from query string (monthly or annual)
    const { searchParams } = new URL(request.url);
    const plan = searchParams.get("plan") || "monthly"; // Default to monthly

    // Check if user has active promo (prioritize cookie over database)
    const cookieStore = await cookies();
    const promoCookie = cookieStore.get("gl_promo_expires");

    let isPromoValid = false;
    if (promoCookie?.value) {
      // User has cookie (pre-auth)
      const promoExpiresAt = new Date(promoCookie.value);
      isPromoValid = promoExpiresAt > new Date();
      console.log("🔵 [promo-checkout] Using cookie promo:", promoCookie.value, "valid:", isPromoValid);
    } else {
      // Check database (post-auth)
      const user = await getCurrentUser();
      const promoExpiresAt = user?.promoExpiresAt ? new Date(user.promoExpiresAt) : null;
      isPromoValid = promoExpiresAt ? promoExpiresAt > new Date() : false;
      console.log("🔵 [promo-checkout] Using database promo:", promoExpiresAt, "valid:", isPromoValid);
    }

    // Select price ID based on promo validity and plan type
    let priceId: string;
    if (isPromoValid) {
      // Use promotional pricing
      priceId = plan === "annual"
        ? STRIPE_PRICES.ANNUAL_PROMO
        : STRIPE_PRICES.MONTHLY_PROMO;
      console.log("🎁 [promo-checkout] Using promotional pricing:", plan, "→", priceId);
    } else {
      // Use regular pricing
      priceId = plan === "annual"
        ? STRIPE_PRICES.ANNUAL_REGULAR
        : STRIPE_PRICES.MONTHLY_REGULAR;
      console.log("💰 [promo-checkout] Using regular pricing (promo invalid/expired):", plan, "→", priceId);
    }

    if (!priceId) {
      console.error("❌ [promo-checkout] Missing Stripe price ID in environment variables");
      console.error("❌ [promo-checkout] STRIPE_PRICES:", STRIPE_PRICES);
      console.error("❌ [promo-checkout] Plan requested:", plan);
      console.error("❌ [promo-checkout] Promo valid:", isPromoValid);
      return NextResponse.json(
        { error: "Stripe price configuration missing" },
        { status: 500 }
      );
    }

    // Determine base URL based on environment
    const baseUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : process.env.NEXT_PUBLIC_BASE_URL || "https://glassloans.io";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/signup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/underwrite-pro?canceled=true`,
      allow_promotion_codes: false, // Disable additional promo codes
    });

    console.log("✅ Promo checkout session created:", {
      sessionId: session.id,
      priceId,
      isPromoValid,
    });

    return NextResponse.redirect(session.url!);
  } catch (error: any) {
    console.error("❌ Error creating promo checkout session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
