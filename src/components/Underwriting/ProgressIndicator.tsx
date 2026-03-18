"use client";

import { useUnderwriting } from "@/context/UnderwritingContext";

export default function ProgressIndicator() {
  const { isProcessing, progressStep, progressStatus, progressPercent } =
    useUnderwriting();

  if (!isProcessing) {
    return null;
  }

  const steps = [
    { number: 1, label: "Verifying" },
    { number: 2, label: "Researching Comps" },
    { number: 3, label: "Calculating Metrics" },
    { number: 4, label: "Gary's Opinion" },
    { number: 5, label: "Finalizing" },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm dark:bg-opacity-70">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-dark sm:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="h-8 w-8 animate-spin text-primary"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-dark dark:text-white">
            Processing Your Underwriting
          </h3>
          <p className="mt-2 text-sm text-body-color dark:text-body-color-dark">
            Gary is analyzing your property...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-body-color dark:text-body-color-dark">{progressStatus}</span>
            <span className="font-medium text-primary">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="space-y-3">
          {steps.map((step) => {
            const isActive = step.number === progressStep;
            const isCompleted = step.number < progressStep;

            return (
              <div
                key={step.number}
                className={`flex items-center gap-3 rounded-lg p-3 transition-all duration-300 ${
                  isActive
                    ? "bg-primary/10 dark:bg-primary/20"
                    : isCompleted
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "bg-gray-50 dark:bg-gray-800"
                }`}
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-medium ${
                    isActive
                      ? "bg-primary text-white"
                      : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span className="text-sm">{step.number}</span>
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-dark dark:text-white"
                      : isCompleted
                        ? "text-green-700 dark:text-green-300"
                        : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {step.label}
                  {isActive && (
                    <span className="ml-2 inline-block">
                      <span className="animate-pulse">...</span>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-body-color dark:text-body-color-dark">
          This usually takes 8-15 seconds. Please don&apos;t close this window.
        </p>
      </div>
    </div>
  );
}
