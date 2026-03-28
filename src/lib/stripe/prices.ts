// Stripe price IDs - Safe to import on client side
// These are just string identifiers, not secrets

export const STRIPE_PRICES = {
  // Regular pricing
  MONTHLY_REGULAR: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_REGULAR ||
                   process.env.STRIPE_PRICE_MONTHLY_REGULAR || "",
  ANNUAL_REGULAR: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_REGULAR ||
                  process.env.STRIPE_PRICE_ANNUAL_REGULAR || "",

  // Promotional pricing (shown at usage limit)
  MONTHLY_PROMO: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_PROMO ||
                 process.env.STRIPE_PRICE_MONTHLY_PROMO || "",
  ANNUAL_PROMO: process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PROMO ||
                process.env.STRIPE_PRICE_ANNUAL_PROMO || "",
} as const;

// Helper to determine tier from price ID
export function getTierFromPriceId(priceId: string): "free" | "pro" {
  const proPriceIds = [
    STRIPE_PRICES.MONTHLY_REGULAR,
    STRIPE_PRICES.ANNUAL_REGULAR,
    STRIPE_PRICES.MONTHLY_PROMO,
    STRIPE_PRICES.ANNUAL_PROMO,
  ];

  return proPriceIds.includes(priceId) ? "pro" : "free";
}

// Helper to check if price ID is promotional
export function isPromoPrice(priceId: string): boolean {
  return priceId === STRIPE_PRICES.MONTHLY_PROMO || priceId === STRIPE_PRICES.ANNUAL_PROMO;
}
