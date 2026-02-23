"use client";

import { useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";
import type { MarketType } from "@/types/underwriting";

export default function Step4MarketDetails() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const compLinks = formData.compLinks || ["", "", ""];

  const updateCompLink = (index: number, value: string) => {
    const newCompLinks = [...compLinks];
    newCompLinks[index] = value;
    // Filter out empty strings before saving
    const filteredLinks = newCompLinks.filter((link) => link.trim() !== "");
    updateFormData({ compLinks: filteredLinks.length > 0 ? filteredLinks : undefined });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stepData = {
      marketType: formData.marketType,
      additionalDetails: formData.additionalDetails,
      compLinks: formData.compLinks,
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
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-body-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
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
              <option value="Primary">Primary</option>
              <option value="Secondary">Secondary</option>
              <option value="Tertiary">Tertiary</option>
            </select>
            {errors.marketType && (
              <p className={errorClass}>{errors.marketType}</p>
            )}
            <p className="mt-1 text-xs text-body-color">
              Primary: Major metro areas • Secondary: Mid-size cities • Tertiary: Small markets
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
          <div className="mb-8">
            <label className={labelClass}>
              Property Comparables (Optional)
            </label>
            <p className="mb-3 text-xs text-body-color">
              Provide up to 3 links to comparable properties to help Gary analyze this deal more accurately
            </p>

            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <input
                  key={index}
                  type="url"
                  value={compLinks[index] || ""}
                  onChange={(e) => updateCompLink(index, e.target.value)}
                  placeholder={`Comp ${index + 1} URL (e.g., Zillow, Redfin, MLS listing)`}
                  className={selectClass}
                />
              ))}
            </div>
            {errors.compLinks && (
              <p className={errorClass}>{errors.compLinks}</p>
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
