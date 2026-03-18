"use client";

import { useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";
import type { MarketType } from "@/types/underwriting";

export default function Step4MarketDetails() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stepData = {
      marketType: formData.marketType,
      additionalDetails: formData.additionalDetails,
    };

    const validation = validateStep(4, stepData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    goToNextStep();
  };

  const selectClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-placeholder-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-placeholder-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit}>
      <div className="-mx-4 flex flex-wrap">
        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="marketType" className={labelClass}>
              Market Type *
            </label>
            <select
              id="marketType"
              value={formData.marketType || ""}
              onChange={(e) =>
                updateFormData({ marketType: e.target.value as MarketType })
              }
              className={selectClass}
            >
              <option value="">Select market type...</option>
              <option value="Urban">Urban</option>
              <option value="Suburban">Suburban</option>
              <option value="Rural">Rural</option>
            </select>
            {errors.marketType && (
              <p className={errorClass}>{errors.marketType}</p>
            )}
            <p className="mt-1 text-xs text-body-color dark:text-body-color-dark">
              Urban: Dense metro areas • Suburban: Mid-size cities • Rural: Small markets/towns
            </p>
          </div>
        </div>

        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="additionalDetails" className={labelClass}>
              Additional Details for Gary (Optional)
            </label>
            <textarea
              id="additionalDetails"
              rows={4}
              value={formData.additionalDetails || ""}
              onChange={(e) =>
                updateFormData({ additionalDetails: e.target.value })
              }
              placeholder="Share any additional context about this deal that would help Gary provide a more accurate opinion... (e.g., market trends, property specifics, exit strategy, timeline constraints, etc.)"
              className={selectClass}
            />
            {errors.additionalDetails && (
              <p className={errorClass}>{errors.additionalDetails}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="rounded-sm border border-primary px-9 py-4 text-base font-medium text-primary duration-300 hover:bg-primary hover:text-white"
            >
              Previous
            </button>
            <button
              type="submit"
              className="rounded-sm bg-primary px-9 py-4 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 dark:shadow-submit-dark"
            >
              Next: Get Results
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
