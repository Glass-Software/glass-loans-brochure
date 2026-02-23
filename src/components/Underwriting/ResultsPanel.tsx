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
        <p className="text-sm text-body-color">
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

      {/* Score Card - Top section */}
      <ScoreCard score={results.finalScore} calculations={results.calculations} />

      {/* Gary's Opinion */}
      <GaryOpinion opinion={results.garyOpinion} />

      {/* Detailed Calculations */}
      <CalculationBreakdown
        formData={results.formData}
        aiEstimates={results.aiEstimates}
        calculations={results.calculations}
      />

      {/* Contact CTA */}
      {usageCount >= usageLimit ? (
        <div className="rounded-sm bg-primary/10 p-6 text-center dark:bg-primary/20">
          <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
            Want More Analyses?
          </h3>
          <p className="mb-4 text-body-color">
            You&apos;ve used all 3 free underwriting analyses. Contact us to discuss your lending needs.
          </p>
          <a
            href="/contact"
            className="inline-block rounded-sm bg-primary px-8 py-3 text-base font-medium text-white hover:bg-primary/90"
          >
            Contact Glass Loans
          </a>
        </div>
      ) : null}

      {/* Disclaimer */}
      <div className="rounded-sm border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
        <p className="text-xs text-body-color">
          <strong>Disclaimer:</strong> This AI-powered analysis is for informational purposes only and does not constitute a loan approval or commitment. Glass Loans assumes no liability for lending decisions made based on this tool. Actual loan terms and approval are subject to full underwriting review, appraisal, and borrower qualifications. Users accept full responsibility for their investment decisions.
        </p>
      </div>
    </div>
  );
}
