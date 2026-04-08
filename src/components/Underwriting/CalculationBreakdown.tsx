"use client";

import { useState } from "react";
import {
  UnderwritingFormData,
  PropertyComps,
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
  propertyComps: PropertyComps;
  calculations: CalculatedResults;
  hideComps?: boolean;
}

export default function CalculationBreakdown({
  formData,
  propertyComps,
  calculations,
  hideComps = false,
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
            {formData.yearBuilt && (
              <Row label="Year Built" value={String(formData.yearBuilt)} />
            )}
            <Row label="Condition" value={formData.propertyCondition} />
            <Row
              label="Renovation Budget"
              value={`$${Number(formData.renovationPerSf).toFixed(2)}/SF (${getRenovationLevel(Number(formData.renovationPerSf))})`}
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

          {/* Borrower Profit Calculation */}
          <Section title="Borrower Profit Calculation">
            <div className="space-y-3">
              {/* Revenue */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="text-sm font-medium text-dark dark:text-white">
                  Revenue
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">
                    ARV (After Repair Value)
                  </span>
                  <span className="font-semibold text-dark dark:text-white">
                    {formatCurrency(calculations.arv)}
                  </span>
                </div>
              </div>

              {/* Costs Breakdown */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="text-sm font-medium text-dark dark:text-white">
                  Costs
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Purchase Price</span>
                    <span className="text-dark dark:text-white">
                      {formatCurrency(formData.purchasePrice)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Rehab Budget</span>
                    <span className="text-dark dark:text-white">
                      {formatCurrency(formData.rehab)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      Interest Expense (360-day basis)
                    </span>
                    <span className="text-dark dark:text-white">
                      {formatCurrency(calculations.totalInterest)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Closing Costs</span>
                    <span className="text-dark dark:text-white">
                      {formatCurrency(calculations.closingCostsDollar)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Points</span>
                    <span className="text-dark dark:text-white">
                      {formatCurrency(calculations.pointsDollar)}
                    </span>
                  </div>
                  <div className="border-t border-gray-300 pt-2 dark:border-gray-600">
                    <div className="flex justify-between">
                      <span className="font-semibold text-dark dark:text-white">
                        Total Costs
                      </span>
                      <span className="font-semibold text-dark dark:text-white">
                        {formatCurrency(calculations.totalCostsOverall)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profit Formula */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="text-center text-sm text-gray-700 dark:text-gray-300">
                  Borrower Profit = Revenue - Costs
                </div>
                <div className="mt-2 text-center text-lg font-bold text-dark dark:text-white">
                  {formatCurrency(calculations.borrowerProfit)}
                </div>
                <div className="mt-1 text-center text-xs text-gray-700 dark:text-gray-300">
                  = {formatCurrency(calculations.arv)} -{" "}
                  {formatCurrency(calculations.totalCostsOverall)}
                </div>
              </div>

              {/* Stress Tested */}
              <div className="mt-3 rounded border border-gray-300 bg-white p-3 dark:border-gray-600 dark:bg-gray-dark">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-dark dark:text-white">
                    Stress Tested Profit (5% ARV drop)
                  </span>
                  <span className="font-semibold text-dark dark:text-white">
                    {formatCurrency(calculations.borrowerProfitStressTested)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                  ARV × 0.95 = {formatCurrency(calculations.arv * 0.95)}
                </div>
              </div>

              {/* Underwater Check */}
              {calculations.isLoanUnderwater && (
                <div className="rounded border border-red-300 bg-red-50 p-2 dark:border-red-700 dark:bg-red-900/20">
                  <div className="text-center text-sm text-red-700 dark:text-red-400">
                    ⚠️ Loan is underwater on day 1
                  </div>
                </div>
              )}
            </div>
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
                <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
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
                <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                  {formatCurrency(calculations.borrowerProfit)}
                </div>
              </div>

              {/* Stress-Tested Profit - 20% */}
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark dark:text-white">
                    Stress-Tested Profit (5% ARV drop)
                  </span>
                  <span className="text-sm font-semibold text-primary">
                    {calculations.stressScore.toFixed(1)}/10 (20% weight)
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
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
                <div className="mt-1 text-xs text-gray-700 dark:text-gray-300">
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
              label="Stress Tested L-ARV (95%)"
              value={formatPercentage(calculations.stressTestedLArv)}
            />
            <Row
              label="Loan Underwater Day 1"
              value={calculations.isLoanUnderwater ? "Yes" : "No"}
              highlight
            />
          </Section>

          {/* Property Comps */}
          {!hideComps && propertyComps.compsUsed && propertyComps.compsUsed.length > 0 && (
            <Section
              title={`Property Comparables (${propertyComps.compsUsed.length} comps)`}
            >
              <div className="space-y-3">
                {propertyComps.compsUsed.map((comp: any, index: number) => {
                  // Generate link: use listing URL if available, otherwise search Google
                  const linkUrl = comp.listingUrl || `https://www.google.com/search?q=${encodeURIComponent(comp.address)}`;

                  return (
                    <div
                      key={index}
                      className="rounded bg-gray-200 p-3 text-sm dark:bg-gray-900"
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {comp.address} ↗
                        </a>
                      </div>

                      {/* Main stats */}
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700 dark:text-gray-300">
                        <span>
                          <strong>Price:</strong> {formatCurrency(comp.price)}
                        </span>
                        <span>
                          <strong>$/sqft:</strong> $
                          {comp.pricePerSqft ||
                            Math.round(comp.price / comp.sqft)}
                        </span>
                        <span>
                          <strong>Size:</strong> {formatNumber(comp.sqft)} sqft
                        </span>
                        <span>
                          <strong>Bed/Bath:</strong> {comp.bedrooms}/
                          {comp.bathrooms}
                        </span>
                        {comp.yearBuilt && (
                          <span>
                            <strong>Built:</strong> {comp.yearBuilt}
                          </span>
                        )}
                        {comp.distance && (
                          <span>
                            <strong>Distance:</strong> {comp.distance}
                          </span>
                        )}
                        {comp.soldDate && (
                          <span className="col-span-2">
                            <strong>Sold:</strong> {comp.soldDate}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
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
      <span className="text-gray-900 dark:text-gray-100">{label}</span>
      <span className="text-dark dark:text-white">{value}</span>
    </div>
  );
}
