"use client";

import { CalculatedResults } from "@/types/underwriting";
import { formatCurrency, formatPercentage } from "@/lib/underwriting/calculations";

interface ScoreMetricsComparisonProps {
  propertyAddress: string;
  score: number;
  userCalculations: CalculatedResults;
  garyCalculations: CalculatedResults;
  userAsIsValue: number;
  garyAsIsValue: number;
}

export default function ScoreMetricsComparison({
  propertyAddress,
  score,
  userCalculations,
  garyCalculations,
  userAsIsValue,
  garyAsIsValue,
}: ScoreMetricsComparisonProps) {
  const metrics = [
    {
      label: "As is Value",
      userValue: formatCurrency(userAsIsValue),
      garyValue: formatCurrency(garyAsIsValue),
    },
    {
      label: "After Repair Value",
      userValue: formatCurrency(userCalculations.arv),
      garyValue: formatCurrency(garyCalculations.arv),
    },
    {
      label: "Loan to As is Value",
      userValue: formatPercentage(userCalculations.loanToAsIsValue),
      garyValue: formatPercentage(garyCalculations.loanToAsIsValue),
    },
    {
      label: "Loan to ARV",
      userValue: formatPercentage(userCalculations.loanToArv),
      garyValue: formatPercentage(garyCalculations.loanToArv),
    },
    {
      label: "Borrower Profit",
      userValue: formatCurrency(userCalculations.borrowerProfit),
      garyValue: formatCurrency(garyCalculations.borrowerProfit),
    },
    {
      label: "Stress-Tested Profit",
      userValue: formatCurrency(userCalculations.borrowerProfitStressTested),
      garyValue: formatCurrency(garyCalculations.borrowerProfitStressTested),
      subtitle: "(5% ARV drop)",
    },
    {
      label: "Is the Loan Underwater Day 1?",
      userValue: userCalculations.isLoanUnderwater ? "Yes" : "No",
      garyValue: garyCalculations.isLoanUnderwater ? "Yes" : "No",
    },
  ];

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
      <div className="mb-8">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold text-dark dark:text-white">
            Underwriting Analysis
          </h2>
          <p className="mt-1 text-sm text-body-color dark:text-body-color-dark">
            {propertyAddress}
          </p>
        </div>

        {/* Modern Score Badge */}
        <div className="mx-auto flex w-fit items-center justify-center gap-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 px-8 py-4 dark:from-primary/20 dark:to-primary/10">
          <div className="text-center">
            <div className="text-sm font-medium text-body-color dark:text-body-color-dark">
              Gary&apos;s Score
            </div>
            <div className={`text-5xl font-bold ${scoreColor}`}>
              {score}
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Comparison */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Left Column: Your Estimates */}
        <div>
          <h3 className="mb-4 border-b-2 border-stroke pb-3 text-lg font-semibold text-dark dark:border-stroke-dark dark:text-white">
            Your Estimates
          </h3>
          <div className="space-y-4">
            {metrics.map((metric, idx) => (
              <MetricRow
                key={idx}
                label={metric.label}
                value={metric.userValue}
                subtitle={metric.subtitle}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Gary's Analysis */}
        <div>
          <h3 className="mb-4 border-b-2 border-stroke pb-3 text-lg font-semibold text-dark dark:border-stroke-dark dark:text-white">
            Gary&apos;s Analysis
          </h3>
          <div className="space-y-4">
            {metrics.map((metric, idx) => (
              <MetricRow
                key={idx}
                label={metric.label}
                value={metric.garyValue}
                subtitle={metric.subtitle}
              />
            ))}
          </div>
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
    <div
      className="rounded-sm bg-primary/5 p-3 dark:bg-primary/10"
    >
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
