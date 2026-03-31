import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import Stripe from "stripe";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Get customer email
    let email: string | null = null;

    if (session.customer_email) {
      email = session.customer_email;
    } else if (session.customer) {
      const customer = await stripe.customers.retrieve(session.customer as string);
      if (!customer.deleted) {
        email = (customer as Stripe.Customer).email;
      }
    }

    if (!email) {
      return NextResponse.json(
        { error: "Could not retrieve customer email" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      email,
      customerId: session.customer as string,
      subscriptionId: session.subscription as string,
      paymentStatus: session.payment_status,
    });
  } catch (error: any) {
    console.error("Error verifying session:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify session" },
      { status: 500 }
    );
  }
}
