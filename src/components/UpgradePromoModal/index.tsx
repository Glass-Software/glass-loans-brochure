"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { usePromoTimer } from "@/hooks/usePromoTimer";

interface UpgradePromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  expiryTime: Date | null;
}

export default function UpgradePromoModal({
  isOpen,
  onClose,
  expiryTime,
}: UpgradePromoModalProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const { hoursRemaining, minutesRemaining, secondsRemaining, isExpired } =
    usePromoTimer(expiryTime);

  const handleUpgrade = () => {
    // Redirect to Stripe checkout with promo price (monthly or annual)
    const plan = isAnnual ? "annual" : "monthly";
    window.location.href = `/api/stripe/create-checkout-session-promo?plan=${plan}`;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl border border-stroke bg-white p-8 shadow-xl transition-all dark:border-white/10 dark:bg-black">
                {/* Icon */}
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <svg
                    className="h-8 w-8 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {/* Clock circle */}
                    <circle cx="12" cy="12" r="9" strokeWidth="2" />
                    {/* Hour hand (static) */}
                    <line x1="12" y1="12" x2="12" y2="8" strokeWidth="2" strokeLinecap="round" />
                    {/* Minute hand (animated) - wrapped in group for proper rotation */}
                    <g className="clock-hand">
                      <line
                        x1="12"
                        y1="12"
                        x2="15"
                        y2="12"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>
                  <style jsx>{`
                    .clock-hand {
                      transform-origin: 12px 12px;
                      animation: clock-tick 60s steps(60) infinite;
                    }

                    @keyframes clock-tick {
                      from { transform: rotate(0deg); }
                      to { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>

                {/* Timer under clock */}
                {!isExpired && (
                  <div className="mt-3 text-center">
                    <div className="inline-flex items-center gap-1">
                      <span className="text-lg font-bold text-primary">
                        {hoursRemaining.toString().padStart(2, "0")}
                      </span>
                      <span className="text-sm text-body-color dark:text-body-color-dark">:</span>
                      <span className="text-lg font-bold text-primary">
                        {minutesRemaining.toString().padStart(2, "0")}
                      </span>
                      <span className="text-sm text-body-color dark:text-body-color-dark">:</span>
                      <span className="text-lg font-bold text-primary">
                        {secondsRemaining.toString().padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-body-color dark:text-body-color-dark">
                      You're Out of Reports!
                    </p>
                  </div>
                )}

                {/* Headline */}
                <Dialog.Title className="mt-6 text-center text-2xl font-bold text-black dark:text-white">
                  Get the Best Deal on Pro
                </Dialog.Title>
                <p className="mt-2 text-center text-sm font-medium text-primary">
                  This exclusive offer expires in 1 hour!
                </p>

                {/* Monthly/Annual Toggle */}
                <div className="mt-6 flex justify-center">
                  <div className="inline-flex rounded-md bg-gray-100 p-1 dark:bg-gray-800">
                    <button
                      onClick={() => setIsAnnual(false)}
                      className={`rounded px-4 py-2 text-sm font-medium transition ${
                        !isAnnual
                          ? "bg-primary text-white"
                          : "text-body-color hover:text-primary dark:text-body-color-dark"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setIsAnnual(true)}
                      className={`rounded px-4 py-2 text-sm font-medium transition ${
                        isAnnual
                          ? "bg-primary text-white"
                          : "text-body-color hover:text-primary dark:text-body-color-dark"
                      }`}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                {/* Pricing */}
                <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:bg-primary/10">
                  <div className="text-center">
                    <p className="text-sm text-body-color line-through dark:text-body-color-dark">
                      {isAnnual ? "$1,199/year" : "$129/month"}
                    </p>
                    <p className="mt-1 text-4xl font-bold text-primary">
                      {isAnnual ? (
                        <>
                          $799<span className="text-lg">/year</span>
                        </>
                      ) : (
                        <>
                          $99<span className="text-lg">/month</span>
                        </>
                      )}
                    </p>
                    <p className="mt-2 text-xs font-medium text-black dark:text-white">
                      {isAnnual
                        ? "Save $400/year • Limited time only"
                        : "Save $30/month • Limited time only"}
                    </p>
                  </div>
                </div>

                {/* Benefits */}
                <ul className="mt-6 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-body-color dark:text-body-color-dark">
                      100 reports per month
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-body-color dark:text-body-color-dark">
                      Unlimited storage
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-body-color dark:text-body-color-dark">
                      Priority support
                    </span>
                  </li>
                </ul>

                {/* CTA */}
                <div className="mt-8 flex flex-col gap-3">
                  <button
                    onClick={handleUpgrade}
                    className="shadow-submit dark:shadow-submit-dark w-full rounded-md bg-primary px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-primary/90"
                  >
                    {isExpired ? "Upgrade to Pro" : "Claim This Offer Now"}
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full rounded-md border border-stroke px-6 py-3 text-sm font-medium text-body-color transition-colors hover:border-primary hover:text-primary dark:border-white/20 dark:text-white dark:hover:border-primary"
                  >
                    Maybe Later
                  </button>
                </div>

                {/* Fine Print */}
                <p className="mt-4 text-center text-xs text-body-color/70 dark:text-body-color-dark/70">
                  {isExpired
                    ? "Regular pricing applies"
                    : "This special offer is only available for the next hour"}
                </p>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
