"use client";

import { UnderwritingResults } from "@/types/underwriting";
import ScoreCard from "./ScoreCard";
import GaryOpinion from "./GaryOpinion";
import CalculationBreakdown from "./CalculationBreakdown";
import { useUnderwriting } from "@/context/UnderwritingContext";

interface ResultsPanelProps {
  results: UnderwritingResults;
}

export default function ResultsPanel({ results }: ResultsPanelProps) {
  const { resetFormData, usageCount, usageLimit } = useUnderwriting();

  return (
    <div className="space-y-8">
      {/* Header with usage info */}
      <div className="text-center">
        <p className="text-sm text-body-color dark:text-body-color-dark">
          Analysis {usageCount} of {usageLimit} • Submitted{" "}
          {new Date(results.submittedAt).toLocaleDateString()}
        </p>
        {usageCount < usageLimit && (
          <button
            onClick={resetFormData}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Start New Underwriting ({usageLimit - usageCount} remaining)
          </button>
        )}
      </div>

      {/* Data Source Badge */}
      {results.propertyComps.compsUsed?.length > 0 ? (
        <div className="rounded-sm border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-green-800 dark:text-green-300">
                ✓ {results.propertyComps.compsUsed?.length || 0} Comparable Sales
              </p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                Analysis based on real market data •{" "}
                {results.propertyComps.confidence === "high" ? "High" :
                 results.propertyComps.confidence === "medium" ? "Medium" : "Low"} Confidence
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-sm border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">
                ⚠ Estimated Values
              </p>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                Limited market data available. These estimates should be verified with an independent appraisal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Score Card - Top section */}
      <ScoreCard score={results.finalScore} calculations={results.calculations} />

      {/* Gary's Opinion */}
      <GaryOpinion opinion={results.garyOpinion} />

      {/* Detailed Calculations */}
      <CalculationBreakdown
        formData={results.formData}
        propertyComps={results.propertyComps}
        calculations={results.calculations}
      />

      {/* Contact CTA */}
      {usageCount >= usageLimit ? (
        <div className="rounded-sm bg-primary/10 p-6 text-center dark:bg-primary/20">
          <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
            You&apos;ve Used All 5 Free Reports
          </h3>
          <p className="mb-4 text-body-color dark:text-body-color-dark">
            Upgrade to Pro for 100 reports per month, permanent report storage, PDF exports, and priority support.
          </p>
          <a
            href="/underwrite-pro"
            className="inline-block rounded-sm bg-primary px-8 py-3 text-base font-medium text-white hover:bg-primary/90"
          >
            Upgrade to Pro
          </a>
        </div>
      ) : null}

      {/* Disclaimer */}
      <div className="rounded-sm border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs text-body-color dark:text-body-color-dark">
          <strong>Disclaimer:</strong> This AI-powered analysis is for informational purposes only and does not constitute a loan approval or commitment. Glass Loans assumes no liability for lending decisions made based on this tool. Actual loan terms and approval are subject to full underwriting review, appraisal, and borrower qualifications. Users accept full responsibility for their investment decisions.
        </p>
      </div>
    </div>
  );
}
