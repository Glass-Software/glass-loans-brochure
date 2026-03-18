"use client";

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
}

const stepLabels = [
  "Property Details",
  "Property Condition",
  "Loan Terms",
  "Market Details",
  "Verify Email",
  "Select Comps",
  "View Report",
];

export default function FormProgress({
  currentStep,
  totalSteps,
}: FormProgressProps) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="mb-4">
        {/* Circles and connecting lines */}
        <div className="flex items-center">
          {[...Array(totalSteps)].map((_, index) => {
            const step = index + 1;
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;

            return (
              <div key={step} className="flex flex-1 items-center">
                {/* Step circle */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                    isCompleted || isCurrent
                      ? "border-primary bg-primary text-white"
                      : "border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-dark dark:text-gray-500"
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
                    step
                  )}
                </div>

                {/* Connecting line */}
                {step < totalSteps && (
                  <div
                    className={`mx-2 h-0.5 flex-1 transition-colors ${
                      isCompleted
                        ? "bg-primary"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Labels below circles (desktop only) */}
        <div className="mt-2 hidden sm:flex">
          {[...Array(totalSteps)].map((_, index) => {
            const step = index + 1;
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;

            return (
              <div key={step} className="flex flex-1 items-center">
                <span
                  className={`flex-shrink-0 text-center text-xs font-medium ${
                    isCompleted || isCurrent
                      ? "text-primary"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                  style={{ width: '40px' }}
                >
                  {stepLabels[index]}
                </span>
                {/* Spacer to match connecting line */}
                {step < totalSteps && <div className="mx-2 flex-1" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step label for mobile */}
      <div className="text-center sm:hidden">
        <p className="text-sm font-medium text-primary">
          Step {currentStep} of {totalSteps}: {stepLabels[currentStep - 1]}
        </p>
      </div>
    </div>
  );
}
