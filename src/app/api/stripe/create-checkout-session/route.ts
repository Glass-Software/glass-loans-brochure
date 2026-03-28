import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { CheckoutSessionRequest, CheckoutSessionResponse } from "@/types/stripe";
import { findUserByNormalizedEmail } from "@/lib/db/queries";
import { normalizeEmail } from "@/lib/email/normalize";

export async function POST(request: Request) {
  try {
    const body: CheckoutSessionRequest = await request.json();
    const { email, priceId, userId } = body;

    // Validate required fields
    if (!email || !priceId) {
      return NextResponse.json(
        { error: "Email and price ID are required" },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = normalizeEmail(email);

    // Find or create Stripe customer
    const user = await findUserByNormalizedEmail(normalizedEmail);
    let customerId: string | undefined;

    if (user) {
      // Check if user already has a Stripe customer ID
      const existingCustomer = await stripe.customers.list({
        email: normalizedEmail,
        limit: 1,
      });

      if (existingCustomer.data.length > 0) {
        customerId = existingCustomer.data[0].id;
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: customerId,
      customer_email: customerId ? undefined : normalizedEmail,
      client_reference_id: userId ? userId.toString() : undefined,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://glassloans.io"}/signup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://glassloans.io"}/underwrite-pro?canceled=true`,
      metadata: {
        userId: userId?.toString() || "",
        email: normalizedEmail,
      },
      subscription_data: {
        metadata: {
          userId: userId?.toString() || "",
          email: normalizedEmail,
        },
      },
    });

    console.log("✅ Checkout session created:", {
      sessionId: session.id,
      customerId: session.customer || session.customer_email,
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
