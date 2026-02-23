"use client";

import { useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";
import type { PropertyCondition, RenovationLevel } from "@/types/underwriting";

export default function Step2PropertyCondition() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stepData = {
      propertyCondition: formData.propertyCondition,
      renovationPerSf: formData.renovationPerSf,
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
              <option value="Good">Good</option>
              <option value="Bad">Bad</option>
              <option value="Really Bad">Really Bad</option>
            </select>
            {errors.propertyCondition && (
              <p className={errorClass}>{errors.propertyCondition}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="renovationPerSf" className={labelClass}>
              Renovation Level *
            </label>
            <select
              id="renovationPerSf"
              value={formData.renovationPerSf || ""}
              onChange={(e) =>
                updateFormData({
                  renovationPerSf: e.target.value as RenovationLevel,
                })
              }
              className={selectClass}
            >
              <option value="">Select level...</option>
              <option value="Light $30/SF">Light ($30/SF)</option>
              <option value="Medium $50-60/SF">Medium ($50-60/SF)</option>
              <option value="Heavy $70-90/SF">Heavy ($70-90/SF)</option>
            </select>
            {errors.renovationPerSf && (
              <p className={errorClass}>{errors.renovationPerSf}</p>
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
              Next Step
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
