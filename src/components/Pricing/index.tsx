"use client";
import { useState } from "react";
import SectionTitle from "../Common/SectionTitle";
import PricingBox from "./PricingBox";
import Link from "next/link";

const Pricing = () => {
  const [isMonthly, setIsMonthly] = useState(true);

  return (
    <section id="pricing" className="relative py-16 md:py-20 lg:py-28">
      <div className="container">
        <SectionTitle
          title="Simple and Affordable Pricing"
          paragraph="We believe in a setting pricing plan that makes our product a no brainer for your business"
          center
          width="665px"
        />

        <div className="mb-10 flex justify-center">
          <div className="inline-flex rounded-md bg-white p-1 shadow-three dark:bg-gray-dark">
            <button
              onClick={() => setIsMonthly(true)}
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

        <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          <PricingBox
            packageName="Lite"
            monthlyPrice="395"
            annualPrice="3,950"
            isMonthly={isMonthly}
            subtitle="0-25 Loans"
          />
          <PricingBox
            packageName="Basic"
            monthlyPrice="695"
            annualPrice="6,950"
            isMonthly={isMonthly}
            subtitle="25-75 Loans"
          />
          <PricingBox
            packageName="Plus"
            monthlyPrice="1,295"
            annualPrice="12,950"
            isMonthly={isMonthly}
            subtitle="75-150 Loans"
          />
        </div>

        <div className="mt-8 text-center">
          <p className="text-base text-body-color dark:text-body-color-dark">
            <span className="font-semibold">Enterprise:</span>{" "}
            <Link
              href="https://calendly.com/willcoleman202/30min"
              className="text-primary hover:underline"
            >
              Schedule a call
            </Link>{" "}
            to discuss pricing for 150+ Loans
          </p>
        </div>
      </div>

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
  );
};

export default Pricing;
