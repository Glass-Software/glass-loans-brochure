export interface CheckoutSessionRequest {
  email: string;
  priceId: string;
  userId?: number;
  promoCode?: string; // "UPGRADE99" if eligible for promo
}

export interface CheckoutSessionResponse {
  url: string;
}

export interface SubscriptionStatusResponse {
  tier: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "incomplete";
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export interface PromoEligibilityResponse {
  eligible: boolean;
  expiresAt?: string;
  priceId?: string; // Promo price ID if eligible
}

export type PricingPlan = "monthly" | "annual";
export type PricingType = "regular" | "promo";

export interface PricingCardProps {
  title: string;
  price: number;
  period: "month" | "year";
  priceId: string;
  features: string[];
  highlighted?: boolean;
  discount?: string; // e.g., "Save $30/mo"
  onSelect: () => void;
}
