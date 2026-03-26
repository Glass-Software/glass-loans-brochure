"use client";

import { CalculatedResults } from "@/types/underwriting";
import {
  formatCurrency,
  formatPercentage,
} from "@/lib/underwriting/calculations";

interface GaryMetricsSectionProps {
  propertyAddress: string;
  score: number;
  garyCalculations: CalculatedResults;
  garyAsIsValue: number;
}

export default function GaryMetricsSection({
  propertyAddress,
  score,
  garyCalculations,
  garyAsIsValue,
}: GaryMetricsSectionProps) {
  // Determine score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-primary";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  const scoreColor = getScoreColor(score);

  return (
    <div className="mb-8 rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-dark dark:text-white">
          Underwriting Analysis
        </h2>
        <p className="mt-2 text-base text-body-color dark:text-body-color-dark">
          {propertyAddress}
        </p>
      </div>

      {/* Gary's Score Badge */}
      <div className="mx-auto mb-8 flex w-fit items-center justify-center gap-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 px-8 py-4 dark:from-primary/20 dark:to-primary/10">
        <div className="text-center">
          <div className="text-sm font-medium text-body-color dark:text-body-color-dark">
            Gary&apos;s Score
          </div>
          <div className={`text-5xl font-bold ${scoreColor}`}>{score}</div>
        </div>
      </div>

      {/* Gary's Metrics */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-dark dark:text-white">
          Gary&apos;s Analysis
        </h3>
        <div className="space-y-3">
          <MetricRow
            label="As-is Value"
            value={formatCurrency(garyAsIsValue)}
          />
          <MetricRow
            label="After Repair Value"
            value={formatCurrency(garyCalculations.arv)}
          />
          <MetricRow
            label="Loan to As-is Value"
            value={formatPercentage(garyCalculations.loanToAsIsValue)}
          />
          <MetricRow
            label="Loan to ARV"
            value={formatPercentage(garyCalculations.loanToArv)}
          />
          <MetricRow
            label="Borrower Profit"
            value={formatCurrency(garyCalculations.borrowerProfit)}
          />
          <MetricRow
            label="Stress-Tested Profit"
            value={formatCurrency(garyCalculations.borrowerProfitStressTested)}
            subtitle="(5% ARV drop)"
          />
          <MetricRow
            label="Is the Loan Underwater Day 1?"
            value={garyCalculations.isLoanUnderwater ? "Yes" : "No"}
          />
        </div>
      </div>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  subtitle?: string;
}

function MetricRow({ label, value, subtitle }: MetricRowProps) {
  return (
    <div className="rounded-sm bg-primary/5 p-3 dark:bg-primary/10">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-body-color dark:text-body-color-dark">
            {label}
            {subtitle && (
              <span className="ml-1 text-xs text-body-color/70 dark:text-body-color-dark/70">
                {subtitle}
              </span>
            )}
          </p>
        </div>
        <div className="ml-4 text-right">
          <p className="text-base font-bold text-dark dark:text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
