"use client";

import { useUnderwriting } from "@/context/UnderwritingContext";
import FormProgress from "./FormProgress";
import Step1PropertyDetails from "./Step1PropertyDetails";
import Step2PropertyCondition from "./Step2PropertyCondition";
import Step3LoanTerms from "./Step3LoanTerms";
import Step4MarketDetails from "./Step4MarketDetails";
import Step5EmailVerification from "./Step5EmailVerification";
import Step6CompSelection from "./Step6CompSelection";
import ResultsPanel from "./ResultsPanel";
import ProgressIndicator from "./ProgressIndicator";

function UnderwritingContent() {
  const { currentStep, results, error, usageCount, usageLimit } =
    useUnderwriting();

  // Show results if available
  if (results) {
    return (
      <section className="overflow-hidden py-16 md:py-20 lg:py-28">
        <div className="container">
          <div className="-mx-4 flex flex-wrap">
            <div className="w-full px-4">
              <div className="mx-auto max-w-4xl">
                <div className="mb-8 text-center">
                  <h2 className="mb-4 text-3xl font-bold text-dark dark:text-white sm:text-4xl">
                    Your Underwriting Results
                  </h2>
                  <p className="text-body-color dark:text-body-color-dark">
                    Here&apos;s Gary&apos;s analysis of your loan
                  </p>
                </div>

                <ResultsPanel results={results} />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Step 6 gets special full-width treatment (Comp Selection)
  if (currentStep === 6) {
    return (
      <>
        {/* Progress Indicator Modal */}
        <ProgressIndicator />

        <section className="overflow-hidden">
          {/* Full-width Map + Drawer - No Container */}
          <Step6CompSelection error={error} />
        </section>
      </>
    );
  }

  // All other steps use the standard container
  return (
    <>
      {/* Progress Indicator Modal */}
      <ProgressIndicator />

      <section className="overflow-hidden py-16 md:py-20 lg:py-28">
        <div className="container">
          <div className="-mx-4 flex flex-wrap">
            <div className="w-full px-4">
              <div className="mx-auto max-w-4xl">
                {/* Header */}
                <div className="mb-12 text-center">
                <h1 className="mb-5 text-3xl font-bold leading-tight text-black dark:text-white sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight">
                  AI Loan Underwriting
                </h1>
                <p className="text-base text-body-color dark:text-body-color-dark sm:text-lg">
                  Get instant AI-powered analysis from Gary, Glass Loans&apos; expert underwriter
                </p>
                {usageCount > 0 && (
                  <p className="mt-2 text-sm text-body-color dark:text-body-color-dark">
                    You&apos;ve used {usageCount} of {usageLimit} free reports
                  </p>
                )}
              </div>

              {/* Main form container */}
              <div className="rounded-sm bg-white px-8 py-11 shadow-three dark:bg-gray-dark sm:p-[55px] lg:px-8 xl:p-[55px]">
                <FormProgress currentStep={currentStep} totalSteps={6} />

                {error && (
                  <div className="mb-8 rounded-sm bg-red-50 p-4 dark:bg-red-900/20">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                )}

                {/* Render current step */}
                {currentStep === 1 && <Step1PropertyDetails />}
                {currentStep === 2 && <Step2PropertyCondition />}
                {currentStep === 3 && <Step3LoanTerms />}
                {currentStep === 4 && <Step4MarketDetails />}
                {currentStep === 5 && <Step5EmailVerification />}
              </div>

              {/* Disclaimer */}
              <div className="mt-6 text-center text-xs text-body-color dark:text-body-color-dark">
                <p>
                  This AI analysis is for informational purposes only. Glass Loans assumes no liability for lending decisions made based on this tool. Users accept full responsibility for their investment decisions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

export default function Underwriting() {
  return <UnderwritingContent />;
}
