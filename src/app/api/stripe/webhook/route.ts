import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe/client";
import {
  findUserByNormalizedEmail,
  createUser,
  upgradeUserToPro,
  downgradeUserToFree,
  createSubscription,
  updateSubscription,
  getSubscriptionByStripeId,
  clearPromoExpiry,
} from "@/lib/db/queries";
import { normalizeEmail } from "@/lib/email/normalization";
import Stripe from "stripe";

export async function POST(req: Request) {
  let event: Stripe.Event;

  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      console.error("❌ Webhook: Missing stripe-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("❌ Webhook: STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Webhook signature verification failed:", errorMessage);
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  console.log(`✅ Webhook received: ${event.type}`);

  try {

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`❌ Error processing webhook:`, error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Creates or upgrades user and creates subscription record
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("🔵 Processing checkout.session.completed");

  const stripeCustomerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!stripeCustomerId || !subscriptionId) {
    console.error("❌ Missing required data in checkout session:", {
      stripeCustomerId: !!stripeCustomerId,
      subscriptionId: !!subscriptionId,
    });
    throw new Error("Missing required data in checkout session");
  }

  // Fetch customer to get email
  const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
  const email = customer.email;

  if (!email) {
    console.error("❌ Customer has no email:", stripeCustomerId);
    throw new Error("Customer has no email");
  }

  console.log(`📧 Email: ${email}`);
  console.log(`👤 Stripe Customer: ${stripeCustomerId}`);
  console.log(`💳 Subscription: ${subscriptionId}`);

  // Get subscription details from Stripe
  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
  const subscription = subscriptionResponse as Stripe.Subscription;
  console.log(`📊 Subscription status: ${subscription.status}`);

  // Normalize email to find/create user
  const normalizedEmail = normalizeEmail(email);
  console.log(`🔍 Looking for user with normalized email: ${normalizedEmail}`);

  // Find existing user OR create new one
  let user = await findUserByNormalizedEmail(normalizedEmail);

  if (!user) {
    console.log("➕ Creating new user for Pro signup");
    const result = await createUser(email, normalizedEmail, false);
    user = result.user;
    console.log(`✅ Created new user: ${user.id}`);
  } else {
    console.log(`✅ Found existing user: ${user.id}`);
    console.log(`📝 User has ${user.usage_count} existing reports - these will be preserved!`);
  }

  // Upgrade user to Pro (updates tier, limits, retention, stripeCustomerId)
  console.log(`⬆️  Upgrading user ${user.id} to Pro tier`);
  await upgradeUserToPro(user.id, stripeCustomerId);

  // Create subscription record
  console.log(`💾 Creating subscription record for user ${user.id}`);

  // Period dates are on the subscription items, not the subscription itself
  const subscriptionItem = subscription.items.data[0];

  await createSubscription({
    userId: user.id,
    stripeCustomerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: subscriptionItem.price.id,
    tier: "pro",
    status: subscription.status,
    currentPeriodStart: new Date((subscriptionItem as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscriptionItem as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  });

  // Clear promotional expiry after successful upgrade
  console.log(`🎁 Clearing promo expiry for user ${user.id}`);
  await clearPromoExpiry(user.id);

  console.log(`✅ Pro subscription created for user ${user.id}`);
  console.log(`🎉 User now has Pro access with existing reports preserved!`);
}

/**
 * Handle customer.subscription.updated
 * Updates subscription status, billing period, or plan changes
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`🔵 Processing customer.subscription.updated: ${subscription.id}`);

  const dbSubscription = await getSubscriptionByStripeId(subscription.id);

  if (!dbSubscription) {
    console.log(`ℹ️  Subscription ${subscription.id} not found in database (may not be created yet)`);
    return;
  }

  console.log(`📝 Updating subscription for user ${dbSubscription.user_id}`);
  console.log(`   Status: ${dbSubscription.status} → ${subscription.status}`);

  // Period dates are on the subscription items, not the subscription itself
  const subscriptionItem = subscription.items.data[0];

  await updateSubscription(dbSubscription.id, {
    status: subscription.status,
    stripePriceId: subscriptionItem.price.id,
    currentPeriodStart: new Date((subscriptionItem as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscriptionItem as any).current_period_end * 1000),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  });

  console.log(`✅ Updated subscription ${subscription.id}`);
}

/**
 * Handle customer.subscription.deleted
 * Downgrades user to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`🔵 Processing customer.subscription.deleted: ${subscription.id}`);

  const dbSubscription = await getSubscriptionByStripeId(subscription.id);

  if (!dbSubscription) {
    console.error(`❌ Subscription ${subscription.id} not found in database`);
    return;
  }

  console.log(`⬇️  Downgrading user ${dbSubscription.user_id} to free tier`);

  // Downgrade user to free tier
  await downgradeUserToFree(dbSubscription.user_id);

  // Update subscription status (keep for history)
  await updateSubscription(dbSubscription.id, {
    status: "canceled",
  });

  console.log(`✅ User ${dbSubscription.user_id} downgraded to free tier`);
  console.log(`📝 Note: Existing reports are preserved (no deletion on downgrade)`);
}

/**
 * Handle invoice.payment_failed
 * Marks subscription as past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`🔵 Processing invoice.payment_failed`);

  const subscriptionId = (invoice as any).subscription as string;

  if (!subscriptionId) {
    console.log("ℹ️  Invoice not associated with subscription, skipping");
    return;
  }

  const dbSubscription = await getSubscriptionByStripeId(subscriptionId);

  if (!dbSubscription) {
    console.error(`❌ Subscription ${subscriptionId} not found in database`);
    return;
  }

  console.log(`⚠️  Payment failed for user ${dbSubscription.user_id}`);
  console.log(`   Marking subscription as past_due`);

  await updateSubscription(dbSubscription.id, {
    status: "past_due",
  });

  console.log(`✅ Updated subscription status to past_due`);
  console.log(`ℹ️  Stripe will retry payment automatically`);
}
