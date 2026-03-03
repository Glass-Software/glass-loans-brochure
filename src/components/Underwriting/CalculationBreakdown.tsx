"use client";

import { useState } from "react";
import {
  UnderwritingFormData,
  AIPropertyEstimates,
  CalculatedResults,
  getRenovationLevel,
} from "@/types/underwriting";
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
} from "@/lib/underwriting/calculations";

interface CalculationBreakdownProps {
  formData: UnderwritingFormData;
  aiEstimates: AIPropertyEstimates;
  calculations: CalculatedResults;
}

export default function CalculationBreakdown({
  formData,
  aiEstimates,
  calculations,
}: CalculationBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-sm bg-white shadow-three dark:bg-gray-dark">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <h3 className="text-lg font-semibold text-dark dark:text-white">
          Detailed Calculations
        </h3>
        <svg
          className={`h-5 w-5 text-body-color transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-6 dark:border-gray-700">
          {/* Input Summary */}
          <Section title="Property Information">
            <Row label="Address" value={formData.propertyAddress} />
            <Row
              label="Purchase Price"
              value={formatCurrency(formData.purchasePrice)}
            />
            <Row label="Rehab Budget" value={formatCurrency(formData.rehab)} />
            <Row
              label="Square Feet"
              value={formatNumber(formData.squareFeet)}
            />
            <Row label="Condition" value={formData.propertyCondition} />
            <Row
              label="Renovation Budget"
              value={`$${formData.renovationPerSf.toFixed(2)}/SF (${getRenovationLevel(formData.renovationPerSf)})`}
            />
            <Row label="Market Type" value={formData.marketType} />
          </Section>

          {/* Loan Terms */}
          <Section title="Loan Terms">
            <Row
              label="Loan at Purchase"
              value={formatCurrency(formData.loanAtPurchase)}
            />
            <Row
              label="Renovation Funds"
              value={formatCurrency(formData.renovationFunds || 0)}
            />
            <Row
              label="Total Loan Amount"
              value={formatCurrency(calculations.totalLoanAmount)}
              highlight
            />
            <Row
              label="Interest Rate"
              value={formatPercentage(formData.interestRate)}
            />
            <Row label="Loan Term" value={`${formData.months} months`} />
            <Row
              label="Closing Costs"
              value={formatPercentage(formData.closingCostsPercent)}
            />
            <Row label="Points" value={formatPercentage(formData.points)} />
          </Section>

          {/* ARV & As-Is Value Comparison */}
          <Section title="ARV & As-Is Value Comparison">
            <div className="space-y-4">
              {/* ARV Comparison */}
              <div>
                <div className="mb-2 text-sm font-medium text-dark dark:text-white">
                  After Repair Value (ARV)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                    <div className="text-xs text-body-color">Your Estimate</div>
                    <div className="mt-1 text-lg font-semibold text-dark dark:text-white">
                      {formatCurrency(formData.userEstimatedArv)}
                    </div>
                  </div>
                  <div className="rounded bg-primary/10 p-3 dark:bg-primary/20">
                    <div className="text-xs text-body-color">Gary's Analysis</div>
                    <div className="mt-1 text-lg font-semibold text-dark dark:text-white">
                      {formatCurrency(aiEstimates.estimatedARV)}
                    </div>
                  </div>
                </div>
                {Math.abs(formData.userEstimatedArv - aiEstimates.estimatedARV) /
                  aiEstimates.estimatedARV >
                  0.1 && (
                  <div className="mt-2 rounded-l-4 border-l-4 border-yellow-400 bg-yellow-50 p-2 dark:bg-yellow-900/20">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      ⚠️ Your ARV estimate differs by{" "}
                      {(
                        (Math.abs(
                          formData.userEstimatedArv - aiEstimates.estimatedARV,
                        ) /
                          aiEstimates.estimatedARV) *
                        100
                      ).toFixed(1)}
                      % from Gary's analysis
                    </p>
                  </div>
                )}
              </div>

              {/* As-Is Value Comparison */}
              <div>
                <div className="mb-2 text-sm font-medium text-dark dark:text-white">
                  As-Is Value (Current Condition)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                    <div className="text-xs text-body-color">Your Estimate</div>
                    <div className="mt-1 text-lg font-semibold text-dark dark:text-white">
                      {formatCurrency(formData.userEstimatedAsIsValue)}
                    </div>
                  </div>
                  <div className="rounded bg-primary/10 p-3 dark:bg-primary/20">
                    <div className="text-xs text-body-color">
                      Gary's Analysis (BatchData)
                    </div>
                    <div className="mt-1 text-lg font-semibold text-dark dark:text-white">
                      {formatCurrency(aiEstimates.asIsValue)}
                    </div>
                  </div>
                </div>
                {Math.abs(formData.userEstimatedAsIsValue - aiEstimates.asIsValue) /
                  aiEstimates.asIsValue >
                  0.1 && (
                  <div className="mt-2 rounded-l-4 border-l-4 border-yellow-400 bg-yellow-50 p-2 dark:bg-yellow-900/20">
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      ⚠️ Your as-is estimate differs by{" "}
                      {(
                        (Math.abs(
                          formData.userEstimatedAsIsValue - aiEstimates.asIsValue,
                        ) /
                          aiEstimates.asIsValue) *
                        100
                      ).toFixed(1)}
                      % from Gary's analysis
                    </p>
                  </div>
                )}
              </div>

              {/* Market Analysis */}
              {aiEstimates.marketAnalysis && (
                <div className="mt-3 rounded bg-blue-50 p-3 dark:bg-blue-900/20">
                  <p className="text-sm text-body-color">
                    {aiEstimates.marketAnalysis}
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Financial Calculations */}
          <Section title="Financial Analysis">
            <Row
              label="Renovation $/SF"
              value={`$${formatNumber(calculations.renovationDollarPerSf, 2)}/SF`}
            />
            <Row
              label="Total Cost (Purchase + Rehab)"
              value={formatCurrency(calculations.totalCost)}
            />
            <Row
              label="Closing Costs ($)"
              value={formatCurrency(calculations.closingCostsDollar)}
            />
            <Row
              label="Points ($)"
              value={formatCurrency(calculations.pointsDollar)}
            />
            <Row
              label="Per Diem Interest"
              value={formatCurrency(calculations.perDiem)}
            />
            <Row
              label="Total Interest"
              value={formatCurrency(calculations.totalInterest)}
            />
            <Row
              label="Total Costs (All In)"
              value={formatCurrency(calculations.totalCostsOverall)}
              highlight
            />
          </Section>

          {/* Profitability */}
          <Section title="Profitability">
            <Row
              label="Borrower Profit"
              value={formatCurrency(calculations.borrowerProfit)}
              highlight
            />
            <Row
              label="Borrower Profit (Stress Tested)"
              value={formatCurrency(calculations.borrowerProfitStressTested)}
            />
            <Row
              label="Loan Underwater Day 1"
              value={calculations.isLoanUnderwater ? "Yes" : "No"}
            />
          </Section>

          {/* Score Breakdown */}
          <Section title="Score Breakdown (0-100)">
            <div className="space-y-3">
              {/* Loan Leverage Metrics - 40% */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark dark:text-white">
                    Loan Leverage Metrics
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {calculations.leverageScore.toFixed(1)}/10 (40% weight)
                  </span>
                </div>
                <div className="mt-1 text-xs text-body-color">
                  LTV: {formatPercentage(calculations.loanToAsIsValue)}, LARV:{" "}
                  {formatPercentage(calculations.loanToArv)}, LTC:{" "}
                  {formatPercentage(calculations.loanToCost)}
                </div>
              </div>

              {/* Borrower Profit - 30% */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark dark:text-white">
                    Borrower Profit
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {calculations.profitScore.toFixed(1)}/10 (30% weight)
                  </span>
                </div>
                <div className="mt-1 text-xs text-body-color">
                  {formatCurrency(calculations.borrowerProfit)}
                </div>
              </div>

              {/* Stress-Tested Profit - 20% */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark dark:text-white">
                    Stress-Tested Profit (10% ARV drop)
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {calculations.stressScore.toFixed(1)}/10 (20% weight)
                  </span>
                </div>
                <div className="mt-1 text-xs text-body-color">
                  {formatCurrency(calculations.stressTestedProfit)}
                </div>
              </div>

              {/* Day-One Underwater Check - 10% */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark dark:text-white">
                    Day-One Underwater Check
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {calculations.underwaterScore.toFixed(1)}/10 (10% weight)
                  </span>
                </div>
                <div className="mt-1 text-xs text-body-color">
                  {calculations.isLoanUnderwater
                    ? "⚠️ Underwater"
                    : "✓ Safe cushion"}
                </div>
              </div>
            </div>
          </Section>

          {/* Detailed Risk Metrics */}
          <Section title="Detailed Risk Metrics">
            <Row
              label="Loan to ARV"
              value={formatPercentage(calculations.loanToArv)}
            />
            <Row
              label="Loan to As-Is Value"
              value={formatPercentage(calculations.loanToAsIsValue)}
            />
            <Row
              label="Loan to Cost"
              value={formatPercentage(calculations.loanToCost)}
            />
            <Row
              label="Stress Tested L-ARV (90%)"
              value={formatPercentage(calculations.stressTestedLArv)}
            />
            <Row
              label="Loan Underwater Day 1"
              value={calculations.isLoanUnderwater ? "Yes" : "No"}
              highlight
            />
          </Section>

          {/* Property Comps */}
          {aiEstimates.compsUsed && aiEstimates.compsUsed.length > 0 && (
            <Section title="Property Comparables">
              <div className="space-y-2">
                {aiEstimates.compsUsed.map((comp, index) => (
                  <div
                    key={index}
                    className="rounded bg-gray-50 p-3 text-sm dark:bg-gray-800"
                  >
                    <div className="font-medium text-dark dark:text-white">
                      {comp.address}
                    </div>
                    <div className="mt-1 flex gap-4 text-body-color">
                      <span>{formatCurrency(comp.price)}</span>
                      <span>{formatNumber(comp.sqft)} sqft</span>
                      {comp.distance && <span>{comp.distance}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <h4 className="mb-3 font-semibold text-dark dark:text-white">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-2 ${highlight ? "font-semibold" : ""}`}
    >
      <span className="text-body-color">{label}</span>
      <span className="text-dark dark:text-white">{value}</span>
    </div>
  );
}
