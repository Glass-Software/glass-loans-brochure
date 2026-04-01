"use client";

import { useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";

const formatNumber = (value: number | undefined): string => {
  if (!value) return "";
  return value.toLocaleString("en-US");
};

const parseNumber = (value: string): number => {
  return Number(value.replace(/,/g, ""));
};

export default function Step3LoanTerms() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleNumberChange = (field: string, value: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d]/g, "");
    const numValue = cleaned ? parseInt(cleaned) : 0;
    updateFormData({ [field]: numValue });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stepData = {
      interestRate: formData.interestRate || 0,
      months: formData.months || 0,
      loanAtPurchase: formData.loanAtPurchase || 0,
      renovationFunds: formData.renovationFunds || 0,
      closingCostsPercent: formData.closingCostsPercent || 0,
      points: formData.points || 0,
    };

    const validation = validateStep(3, stepData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    goToNextStep();
  };

  const inputClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-placeholder-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-placeholder-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit}>
      <div className="-mx-4 flex flex-wrap">
        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="interestRate" className={labelClass}>
              Interest Rate (%) *
            </label>
            <input
              type="number"
              id="interestRate"
              value={formData.interestRate || ""}
              onChange={(e) =>
                updateFormData({ interestRate: Number(e.target.value) })
              }
              placeholder="12"
              min="0"
              step="0.1"
              className={inputClass}
            />
            {errors.interestRate && (
              <p className={errorClass}>{errors.interestRate}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="months" className={labelClass}>
              Loan Term (Months) *
            </label>
            <input
              type="number"
              id="months"
              value={formData.months || ""}
              onChange={(e) =>
                updateFormData({ months: Number(e.target.value) })
              }
              placeholder="6"
              min="1"
              step="1"
              className={inputClass}
            />
            {errors.months && <p className={errorClass}>{errors.months}</p>}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="loanAtPurchase" className={labelClass}>
              Loan Amount Towards Purchase *
            </label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-body-color dark:text-body-color-dark">
                $
              </span>
              <input
                type="text"
                id="loanAtPurchase"
                value={formatNumber(formData.loanAtPurchase)}
                onChange={(e) => handleNumberChange("loanAtPurchase", e.target.value)}
                placeholder="110,000"
                className={`${inputClass} pl-10`}
              />
            </div>
            {errors.loanAtPurchase && (
              <p className={errorClass}>{errors.loanAtPurchase}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="renovationFunds" className={labelClass}>
              Loan Amount Towards Renovation
            </label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-body-color dark:text-body-color-dark">
                $
              </span>
              <input
                type="text"
                id="renovationFunds"
                value={formatNumber(formData.renovationFunds)}
                onChange={(e) => handleNumberChange("renovationFunds", e.target.value)}
                placeholder="0"
                className={`${inputClass} pl-10`}
              />
            </div>
            {errors.renovationFunds && (
              <p className={errorClass}>{errors.renovationFunds}</p>
            )}
            <p className="mt-1 text-xs text-body-color dark:text-body-color-dark">
              Additional funds provided for renovations (defaults to $0)
            </p>
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="closingCostsPercent" className={labelClass}>
              Closing Costs (%) *
            </label>
            <input
              type="number"
              id="closingCostsPercent"
              value={formData.closingCostsPercent || ""}
              onChange={(e) =>
                updateFormData({
                  closingCostsPercent: Number(e.target.value),
                })
              }
              placeholder="6.5"
              min="0"
              step="0.1"
              className={inputClass}
            />
            {errors.closingCostsPercent && (
              <p className={errorClass}>{errors.closingCostsPercent}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="points" className={labelClass}>
              Points (%) *
            </label>
            <input
              type="number"
              id="points"
              value={formData.points || ""}
              onChange={(e) =>
                updateFormData({ points: Number(e.target.value) })
              }
              placeholder="3"
              min="0"
              step="0.1"
              className={inputClass}
            />
            {errors.points && <p className={errorClass}>{errors.points}</p>}
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
