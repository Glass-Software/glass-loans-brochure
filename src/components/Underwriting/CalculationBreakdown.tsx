"use client";

import { useState } from "react";
import {
  UnderwritingFormData,
  AIPropertyEstimates,
  CalculatedResults,
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
            <Row label="Renovation Level" value={formData.renovationPerSf} />
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

          {/* AI Estimates */}
          <Section title="AI Market Analysis">
            <Row
              label="Estimated ARV"
              value={formatCurrency(aiEstimates.estimatedARV)}
              highlight
            />
            <Row
              label="As-Is Value"
              value={formatCurrency(aiEstimates.asIsValue)}
            />
            {aiEstimates.marketAnalysis && (
              <div className="mt-2 rounded bg-blue-50 p-3 dark:bg-blue-900/20">
                <p className="text-sm text-body-color">
                  {aiEstimates.marketAnalysis}
                </p>
              </div>
            )}
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

          {/* Risk Metrics */}
          <Section title="Risk Metrics">
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
              label="Loan Underwater"
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
