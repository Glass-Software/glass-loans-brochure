"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SectionTitle from "@/components/Common/SectionTitle";
import PricingCard from "@/components/Pro/PricingCard";
import { STRIPE_PRICES } from "@/lib/stripe/prices";

const UnderwriteProPage = () => {
  const [isMonthly, setIsMonthly] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSelectPlan = async (priceId: string) => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout error:", data.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      setIsLoading(false);
    }
  };

  const proFeatures = [
    "100 underwriting reports per month",
    "Permanent report history",
    "Skip email verification",
    "Export reports to PDF",
    "Priority support",
    "Dashboard access",
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="relative z-10 overflow-hidden bg-white pb-16 pt-[120px] dark:bg-gray-dark md:pb-[120px] md:pt-[150px] xl:pb-[160px] xl:pt-[180px]">
        <div className="container">
          <div className="mx-auto max-w-[800px] text-center">
            <h1 className="mb-5 text-3xl font-bold leading-tight text-black dark:text-white sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight">
              Underwrite Pro
            </h1>
            <h2 className="mb-5 text-2xl font-bold leading-tight text-black dark:text-white sm:text-3xl sm:leading-tight">
              100 Reports Per Month
            </h2>
            <p className="mb-12 text-base !leading-relaxed text-body-color dark:text-white sm:text-lg md:text-xl">
              Upgrade to Pro and get 100 monthly reports with Gary&apos;s
              AI-powered underwriting analysis, permanent report storage, PDF
              exports, and priority support.
            </p>

            <div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
              <button
                onClick={() =>
                  handleSelectPlan(
                    isMonthly
                      ? STRIPE_PRICES.MONTHLY_REGULAR
                      : STRIPE_PRICES.ANNUAL_REGULAR,
                  )
                }
                disabled={isLoading}
                className="rounded-sm bg-primary px-8 py-4 text-base font-semibold text-white duration-300 ease-in-out hover:bg-primary/80"
              >
                {isLoading ? "Loading..." : "Upgrade Now"}
              </button>
              <Link
                href="/underwrite"
                className="text-base font-medium text-body-color duration-300 ease-in-out hover:text-primary dark:text-body-color-dark dark:hover:text-primary"
              >
                Try Free Version
              </Link>
            </div>
          </div>
        </div>

        {/* Background decorations */}
        <div className="absolute bottom-0 left-0 z-[-1]">
          <svg
            width="239"
            height="601"
            viewBox="0 0 239 601"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              opacity="0.3"
              x="-184.451"
              y="600.973"
              width="196"
              height="541.607"
              rx="2"
              transform="rotate(-128.7 -184.451 600.973)"
              fill="url(#paint0_linear_93:235)"
            />
            <rect
              opacity="0.3"
              x="-188.201"
              y="385.272"
              width="59.7544"
              height="541.607"
              rx="2"
              transform="rotate(-128.7 -188.201 385.272)"
              fill="url(#paint1_linear_93:235)"
            />
            <defs>
              <linearGradient
                id="paint0_linear_93:235"
                x1="-90.1184"
                y1="420.414"
                x2="-90.1184"
                y2="1131.65"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_93:235"
                x1="-159.441"
                y1="204.714"
                x2="-159.441"
                y2="915.952"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </section>

      {/* Pro Features Section */}
      <section className="relative py-16 md:py-20 lg:py-28">
        <div className="container">
          <SectionTitle
            title="Pro Features"
            paragraph="Everything you need to analyze deals efficiently and professionally."
            center
          />

          <div className="grid grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: (
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                title: "100 Reports Monthly",
                description:
                  "Generate up to 100 underwriting reports every month.",
              },
              {
                icon: (
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
                title: "Permanent History",
                description:
                  "Access all your past reports forever. No 14-day expiration.",
              },
              {
                icon: (
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                ),
                title: "Skip Verification",
                description:
                  "Stay logged in. No need to verify your email every time.",
              },
              {
                icon: (
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                ),
                title: "PDF Export",
                description:
                  "Download your reports as PDF files for easy sharing.",
              },
              {
                icon: (
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                ),
                title: "Dashboard",
                description:
                  "View all your reports in one place with powerful filtering.",
              },
              {
                icon: (
                  <svg
                    className="h-10 w-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                ),
                title: "Priority Support",
                description:
                  "Get help faster with priority email and chat support.",
              },
            ].map((feature, index) => (
              <div key={index} className="w-full">
                <div className="wow fadeInUp" data-wow-delay=".15s">
                  <div className="mb-10 flex h-[70px] w-[70px] items-center justify-center rounded-md bg-primary bg-opacity-10 text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="mb-5 text-xl font-bold text-black dark:text-white sm:text-2xl lg:text-xl xl:text-2xl">
                    {feature.title}
                  </h3>
                  <p className="pr-[10px] text-base font-medium leading-relaxed text-body-color dark:text-white">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative angled lines on the right */}
        <div className="absolute right-0 top-20 z-[-1] opacity-30 lg:opacity-100">
          <svg
            width="364"
            height="201"
            viewBox="0 0 364 201"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5.88928 72.3303C33.6599 66.4798 101.397 64.9086 150.178 105.427C211.155 156.076 229.59 162.093 264.333 166.607C299.076 171.12 337.718 183.657 362.889 212.24"
              stroke="url(#paint0_linear_features)"
            />
            <path
              d="M-22.1107 72.3303C5.65989 66.4798 73.3965 64.9086 122.178 105.427C183.155 156.076 201.59 162.093 236.333 166.607C271.076 171.12 309.718 183.657 334.889 212.24"
              stroke="url(#paint1_linear_features)"
            />
            <path
              d="M-53.1107 72.3303C-25.3401 66.4798 42.3965 64.9086 91.1783 105.427C152.155 156.076 170.59 162.093 205.333 166.607C240.076 171.12 278.718 183.657 303.889 212.24"
              stroke="url(#paint2_linear_features)"
            />
            <circle
              opacity="0.8"
              cx="214.505"
              cy="60.5054"
              r="49.7205"
              transform="rotate(-13.421 214.505 60.5054)"
              stroke="url(#paint3_linear_features)"
            />
            <circle
              cx="220"
              cy="63"
              r="43"
              fill="url(#paint4_radial_features)"
            />
            <defs>
              <linearGradient
                id="paint0_linear_features"
                x1="184.389"
                y1="69.2405"
                x2="184.389"
                y2="212.24"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" stopOpacity="0" />
                <stop offset="1" stopColor="#4A6CF7" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_features"
                x1="156.389"
                y1="69.2405"
                x2="156.389"
                y2="212.24"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" stopOpacity="0" />
                <stop offset="1" stopColor="#4A6CF7" />
              </linearGradient>
              <linearGradient
                id="paint2_linear_features"
                x1="125.389"
                y1="69.2405"
                x2="125.389"
                y2="212.24"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" stopOpacity="0" />
                <stop offset="1" stopColor="#4A6CF7" />
              </linearGradient>
              <linearGradient
                id="paint3_linear_features"
                x1="214.505"
                y1="10.2849"
                x2="212.684"
                y2="99.5816"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
              <radialGradient
                id="paint4_radial_features"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(220 63) rotate(90) scale(43)"
              >
                <stop offset="0.145833" stopColor="white" stopOpacity="0" />
                <stop offset="1" stopColor="white" stopOpacity="0.08" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="relative overflow-hidden bg-gray-light py-16 dark:bg-bg-color-dark md:py-20 lg:py-28"
      >
        <div className="container relative z-10">
          <SectionTitle
            title="Simple Pricing"
            paragraph="Choose the plan that works best for you. Cancel anytime."
            center
          />

          {/* Monthly/Annual Toggle */}
          <div className="mb-10 flex justify-center">
            <div className="inline-flex rounded-md bg-white p-1 shadow-three dark:bg-gray-dark">
              <button
                onClick={() => setIsMonthly(true)}
                disabled={isLoading}
                className={`rounded px-6 py-2 text-base font-medium transition ${
                  isMonthly
                    ? "bg-primary text-white"
                    : "text-body-color hover:text-primary dark:text-body-color-dark"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsMonthly(false)}
                disabled={isLoading}
                className={`rounded px-6 py-2 text-base font-medium transition ${
                  !isMonthly
                    ? "bg-primary text-white"
                    : "text-body-color hover:text-primary dark:text-body-color-dark"
                }`}
              >
                Annual
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="mx-auto grid max-w-[900px] grid-cols-1 items-center gap-x-8 gap-y-10 md:grid-cols-2">
            <PricingCard
              title="Free"
              price={0}
              period="month"
              priceId=""
              features={[
                "5 underwriting reports",
                "Reports expire after 14 days",
                "Email verification required",
                "View reports via email links",
                "Basic support",
              ]}
              onSelect={() => router.push("/underwrite")}
            />
            <PricingCard
              title="Pro"
              price={isMonthly ? 129 : 1199}
              period={isMonthly ? "month" : "year"}
              priceId={
                isMonthly
                  ? STRIPE_PRICES.MONTHLY_REGULAR
                  : STRIPE_PRICES.ANNUAL_REGULAR
              }
              features={proFeatures}
              highlighted={true}
              discount={!isMonthly ? "Save $349/year" : undefined}
              onSelect={() =>
                handleSelectPlan(
                  isMonthly
                    ? STRIPE_PRICES.MONTHLY_REGULAR
                    : STRIPE_PRICES.ANNUAL_REGULAR,
                )
              }
            />
          </div>
        </div>

        {/* Decorative element on the right for pricing section */}
        <div className="pointer-events-none absolute -right-20 bottom-0 z-0 opacity-50 lg:opacity-100">
          <svg
            width="320"
            height="400"
            viewBox="0 0 320 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="200"
              cy="300"
              r="140"
              fill="url(#paint0_linear_pricing)"
            />
            <circle
              opacity="0.8"
              cx="240"
              cy="200"
              r="80"
              stroke="url(#paint1_linear_pricing)"
              strokeWidth="2"
            />
            <circle
              cx="280"
              cy="100"
              r="22"
              fill="url(#paint2_radial_pricing)"
            />
            <circle
              cx="140"
              cy="340"
              r="30"
              fill="url(#paint3_radial_pricing)"
            />
            <defs>
              <linearGradient
                id="paint0_linear_pricing"
                x1="60"
                y1="160"
                x2="200"
                y2="400"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_pricing"
                x1="160"
                y1="120"
                x2="320"
                y2="280"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#4A6CF7" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0" />
              </linearGradient>
              <radialGradient
                id="paint2_radial_pricing"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(280 100) rotate(90) scale(22)"
              >
                <stop offset="0.145833" stopColor="#4A6CF7" stopOpacity="0" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0.08" />
              </radialGradient>
              <radialGradient
                id="paint3_radial_pricing"
                cx="0"
                cy="0"
                r="1"
                gradientUnits="userSpaceOnUse"
                gradientTransform="translate(140 340) rotate(90) scale(30)"
              >
                <stop offset="0.145833" stopColor="#4A6CF7" stopOpacity="0" />
                <stop offset="1" stopColor="#4A6CF7" stopOpacity="0.08" />
              </radialGradient>
            </defs>
          </svg>
        </div>
      </section>
    </>
  );
};

export default UnderwriteProPage;
