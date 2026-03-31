import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { CheckoutSessionRequest, CheckoutSessionResponse } from "@/types/stripe";

export async function POST(request: Request) {
  try {
    const body: CheckoutSessionRequest = await request.json();
    const { priceId } = body;

    // Validate required fields
    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID is required" },
        { status: 400 }
      );
    }

    // Determine base URL based on environment
    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_BASE_URL || 'https://glassloans.io');

    // Create checkout session - Stripe will collect email
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
    });

    console.log("✅ Checkout session created:", {
      sessionId: session.id,
      priceId,
    });

    return NextResponse.json<CheckoutSessionResponse>({ url: session.url! });
  } catch (error: any) {
    console.error("❌ Error creating checkout session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
