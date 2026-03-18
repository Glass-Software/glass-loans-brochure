"use client";

import { CalculatedResults } from "@/types/underwriting";
import { formatCurrency, formatPercentage } from "@/lib/underwriting/calculations";

interface ScoreCardProps {
  score: number;
  calculations: CalculatedResults;
}

export default function ScoreCard({ score, calculations }: ScoreCardProps) {
  // Determine score color and label
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-blue-600 dark:text-blue-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Review";
  };

  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  return (
    <div className="rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
      {/* Main Score Display */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <div className="text-center">
            <div className={`text-5xl font-bold ${scoreColor}`}>{score}</div>
            <div className="text-sm text-body-color dark:text-body-color-dark">out of 100</div>
          </div>
        </div>
        <h3 className={`text-2xl font-bold ${scoreColor}`}>{scoreLabel}</h3>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Loan to ARV"
          value={formatPercentage(calculations.loanToArv)}
          status={calculations.loanToArv <= 70 ? "good" : calculations.loanToArv <= 75 ? "fair" : "poor"}
        />
        <MetricCard
          label="Loan to As-Is"
          value={formatPercentage(calculations.loanToAsIsValue)}
          status={calculations.loanToAsIsValue <= 75 ? "good" : calculations.loanToAsIsValue <= 85 ? "fair" : "poor"}
        />
        <MetricCard
          label="Borrower Spread"
          value={formatCurrency(calculations.borrowerSpread)}
          status={calculations.borrowerSpread >= 30000 ? "good" : calculations.borrowerSpread >= 20000 ? "fair" : "poor"}
        />
        <MetricCard
          label="Loan Underwater"
          value={calculations.isLoanUnderwater ? "Yes" : "No"}
          status={calculations.isLoanUnderwater ? "poor" : "good"}
        />
        <MetricCard
          label="Stress Test L-ARV"
          value={formatPercentage(calculations.stressTestedLArv)}
          status={calculations.stressTestedLArv <= 70 ? "good" : calculations.stressTestedLArv <= 80 ? "fair" : "poor"}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "good" | "fair" | "poor";
}) {
  const statusColors = {
    good: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    fair: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800",
    poor: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
  };

  const dotColors = {
    good: "bg-green-500",
    fair: "bg-yellow-500",
    poor: "bg-red-500",
  };

  return (
    <div className={`rounded-sm border p-4 ${statusColors[status]}`}>
      <div className="mb-1 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${dotColors[status]}`} />
        <span className="text-xs font-medium text-body-color dark:text-body-color-dark">{label}</span>
      </div>
      <div className="text-lg font-bold text-dark dark:text-white">{value}</div>
    </div>
  );
}
