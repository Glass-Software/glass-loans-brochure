"use client";

import { useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";
import { getRenovationLevel } from "@/types/underwriting";
import type { PropertyCondition } from "@/types/underwriting";

export default function Step2PropertyCondition() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Calculate renovation $/SF from rehab and square feet
    const renovationPerSf =
      formData.rehab && formData.squareFeet
        ? formData.rehab / formData.squareFeet
        : 0;

    // Update formData with calculated renovation $/SF
    updateFormData({ renovationPerSf });

    const stepData = {
      propertyCondition: formData.propertyCondition,
      renovationPerSf,
    };

    const validation = validateStep(2, stepData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    goToNextStep();
  };

  const selectClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit}>
      <div className="-mx-4 flex flex-wrap">
        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="propertyCondition" className={labelClass}>
              Property Condition *
            </label>
            <select
              id="propertyCondition"
              value={formData.propertyCondition || ""}
              onChange={(e) =>
                updateFormData({
                  propertyCondition: e.target.value as PropertyCondition,
                })
              }
              className={selectClass}
            >
              <option value="">Select condition...</option>
              <option value="Great (Like New)">Great (Like New)</option>
              <option value="Good">Good</option>
              <option value="Bad">Bad</option>
              <option value="Really Bad">Really Bad</option>
            </select>
            {errors.propertyCondition && (
              <p className={errorClass}>{errors.propertyCondition}</p>
            )}
            <p className="mt-2 text-sm text-body-color dark:text-body-color-dark">
              <strong>Great (Like New):</strong> Recently renovated/built, no deferred maintenance<br/>
              <strong>Good:</strong> Functional, minimal work needed<br/>
              <strong>Bad:</strong> Needs significant updates (flooring, kitchen, bath)<br/>
              <strong>Really Bad:</strong> Major repairs needed (foundation, HVAC, plumbing, roof)
            </p>
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label className={labelClass}>Renovation Budget (Calculated)</label>
            {formData.rehab && formData.squareFeet ? (
              <div className="rounded-sm border border-stroke bg-gray-2 px-6 py-3 dark:border-transparent dark:bg-[#2C303B]">
                <span className="text-base font-semibold text-dark dark:text-white">
                  ${(formData.rehab / formData.squareFeet).toFixed(2)}/SF
                </span>
                <span className="ml-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {getRenovationLevel(formData.rehab / formData.squareFeet)}
                </span>
              </div>
            ) : (
              <div className="rounded-sm border border-stroke bg-gray-2 px-6 py-3 text-body-color dark:border-transparent dark:bg-[#2C303B] dark:text-body-color-dark">
                Enter rehab budget and square feet in Step 1
              </div>
            )}
            <p className="mt-2 text-sm text-body-color dark:text-body-color-dark">
              Automatically calculated from your rehab budget and square footage
            </p>
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
              Next Step
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
