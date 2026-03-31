"use client";

import { useState } from "react";
import Link from "next/link";

interface Subscription {
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripePriceId: string;
}

interface User {
  tier: string;
  stripeCustomerId: string | null;
}

interface SubscriptionCardProps {
  user: User;
  subscription: Subscription | null;
  usageCount: number;
  usageLimit: number;
  periodEnd: Date | null;
}

export default function SubscriptionCard({
  user,
  subscription,
  usageCount,
  usageLimit,
  periodEnd,
}: SubscriptionCardProps) {
  const [isCreatingPortalSession, setIsCreatingPortalSession] = useState(false);

  const isPro = user.tier === "pro";
  const usagePercentage = (usageCount / usageLimit) * 100;

  async function handleManageSubscription() {
    if (!user.stripeCustomerId) return;

    setIsCreatingPortalSession(true);

    try {
      const res = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      setIsCreatingPortalSession(false);
    }
  }

  return (
    <div className="shadow-three rounded-lg border border-stroke bg-white p-6 dark:border-white/10 dark:bg-black/40">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-black dark:text-white">
          {isPro ? "Pro Plan" : "Free Plan"}
        </h2>
        {subscription && (
          <p className="mt-1 text-sm text-body-color dark:text-body-color-dark">
            Status:{" "}
            <span className="capitalize">
              {subscription.cancelAtPeriodEnd ? "Canceling" : subscription.status}
            </span>
          </p>
        )}
      </div>

      {/* Usage Stats */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-body-color dark:text-body-color-dark">
            Reports Used
          </span>
          <span className="text-sm font-medium text-black dark:text-white">
            {usageCount} / {usageLimit}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-stroke dark:bg-white/10">
          <div
            className={`h-full transition-all ${
              usagePercentage >= 90
                ? "bg-red-500"
                : usagePercentage >= 70
                  ? "bg-yellow-500"
                  : "bg-primary"
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        {isPro && periodEnd && (
          <p className="mt-2 text-xs text-body-color dark:text-body-color-dark">
            Resets on {new Date(periodEnd).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Benefits */}
      {isPro ? (
        <div className="mb-6 rounded-md bg-primary/5 p-4 dark:bg-primary/10">
          <p className="mb-2 text-sm font-medium text-black dark:text-white">
            Your Pro Benefits:
          </p>
          <ul className="space-y-1 text-sm text-body-color dark:text-body-color-dark">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              100 reports per month
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Unlimited storage
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Priority support
            </li>
          </ul>
        </div>
      ) : (
        <div className="mb-6 rounded-md border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
          <p className="mb-2 text-sm font-medium text-black dark:text-white">
            Upgrade to Pro
          </p>
          <p className="mb-3 text-xs text-body-color dark:text-body-color-dark">
            Get 100 reports per month and unlimited storage
          </p>
          <Link
            href="/underwrite-pro"
            className="shadow-submit dark:shadow-submit-dark inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Upgrade Now
          </Link>
        </div>
      )}

      {/* Manage Subscription */}
      {isPro && subscription && (
        <button
          onClick={handleManageSubscription}
          disabled={isCreatingPortalSession}
          className="w-full rounded-md border border-stroke px-4 py-2 text-sm font-medium text-body-color transition-colors hover:border-primary hover:text-primary disabled:opacity-50 dark:border-white/10 dark:text-white dark:hover:border-primary"
        >
          {isCreatingPortalSession ? "Loading..." : "Manage Subscription"}
        </button>
      )}
    </div>
  );
}
