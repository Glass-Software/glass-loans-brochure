import Stripe from "stripe";

// SERVER-SIDE ONLY - Do not import this file in client components
// For price IDs, import from @/lib/stripe/prices instead

let stripeInstance: Stripe | null = null;

/**
 * Get the Stripe client instance (lazy-initialized)
 * Defers secret key check until first use to allow builds without secrets
 */
function getStripeClient(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // API version is set to default in package, override in Stripe Dashboard if needed
      typescript: true,
    });
  }
  return stripeInstance;
}

// Export lazy-initialized client using Proxy
// This allows the build to succeed without STRIPE_SECRET_KEY,
// while still checking for it at runtime when the client is actually used
export const stripe = new Proxy({} as Stripe, {
  get: (_, prop) => {
    const client = getStripeClient();
    const value = client[prop as keyof Stripe];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Re-export price utilities for convenience (server-side)
export { STRIPE_PRICES, getTierFromPriceId, isPromoPrice } from "./prices";
