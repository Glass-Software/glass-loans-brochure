import Stripe from "stripe";

// SERVER-SIDE ONLY - Do not import this file in client components
// For price IDs, import from @/lib/stripe/prices instead

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
});

// Re-export price utilities for convenience (server-side)
export { STRIPE_PRICES, getTierFromPriceId, isPromoPrice } from "./prices";
