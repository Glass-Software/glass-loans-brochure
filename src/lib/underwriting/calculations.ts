import {
  UnderwritingFormData,
  PropertyComps,
  CalculatedResults,
  PropertyComparable,
  CompSelectionState,
} from "@/types/underwriting";

/**
 * Calculate all underwriting metrics based on form inputs and ARV/as-is value
 * Supports dual ARV calculation - can be run with user's ARV or Gary's ARV
 * All formulas are ported directly from the Excel template
 */
export function calculateUnderwriting(
  formData: UnderwritingFormData,
  arv: number, // Can be user's ARV or Gary's ARV
  asIsValue: number, // From Gary's estimate (for underwater check)
): CalculatedResults {
  const {
    purchasePrice,
    rehab,
    squareFeet,
    interestRate,
    months,
    loanAtPurchase,
    renovationFunds,
    closingCostsPercent,
    points,
  } = formData;

  // Formula 1: Renovation $$/SF = rehab / squareFeet
  const renovationDollarPerSf = rehab / squareFeet;

  // Formula 2: # of Days = months × 30
  const days = months * 30;

  // Formula 3: Total Cost = purchasePrice + rehab
  const totalCost = purchasePrice + rehab;

  // Formula 4: Total Loan Amount = loanAtPurchase + renovationFunds
  const totalLoanAmount = loanAtPurchase + renovationFunds;

  // Formula 5: Closing Costs $ = closingCostsPercent × purchasePrice
  const closingCostsDollar = (closingCostsPercent / 100) * purchasePrice;

  // Formula 6: Points $ = pointsPercent × totalLoanAmount
  const pointsDollar = (points / 100) * totalLoanAmount;

  // Formula 7: Per Diem = (totalLoanAmount × interestRate) / 360
  const perDiem = (totalLoanAmount * (interestRate / 100)) / 360;

  // Formula 8: Total Interest = perDiem × days
  const totalInterest = perDiem * days;

  // Formula 9: Total (Costs) = closingCosts$ + totalInterest + points$
  const totalCosts = closingCostsDollar + totalInterest + pointsDollar;

  // Formula 10: Total Costs (Overall) = totalCost + total
  const totalCostsOverall = totalCost + totalCosts;

  // Formula 11: Borrower Profit = ARV - totalCostsOverall
  const borrowerProfit = arv - totalCostsOverall;

  // Formula 12: Borrower Profit (Stress Tested) = (ARV × 0.95) - totalCostsOverall
  const borrowerProfitStressTested = arv * 0.95 - totalCostsOverall;

  // Formula 13: Stress Tested L-ARV = totalLoanAmount / (ARV × 0.95)
  const stressTestedLArv = (totalLoanAmount / (arv * 0.95)) * 100;

  // Formula 14: Is Loan Underwater Day 1? (Lender's perspective: loan amount > as-is value)
  // Simple collateral check: If we lend this amount today, is the property worth at least that much?
  const isLoanUnderwater = loanAtPurchase > asIsValue;

  // Formula 15: Loan to As-is Value = loanAtPurchase / asIsValue
  const loanToAsIsValue = (loanAtPurchase / asIsValue) * 100;

  // Formula 16: Loan to ARV = totalLoanAmount / ARV
  const loanToArv = (totalLoanAmount / arv) * 100;

  // Formula 17: Loan to Cost = totalLoanAmount / totalCost
  const loanToCost = (totalLoanAmount / totalCost) * 100;

  // Formula 18: Borrower Spread = same as Borrower Profit (#11)
  const borrowerSpread = borrowerProfit;

  // New calculations for enhanced scoring system
  const totalProjectCost = totalCost + totalCosts;
  const stressedARV = arv * 0.95;
  const stressTestedProfit = stressedARV - totalProjectCost - totalInterest;

  // Calculate component scores (1-10 scale) for new scoring rubric

  // 1. Leverage Score (average of LTV, LARV, LTC)
  const ltvScore =
    loanToAsIsValue <= 85 ? 10 : loanToAsIsValue <= 90 ? 7 : loanToAsIsValue <= 95 ? 4 : 1;
  const larvScore = loanToArv <= 75 ? 10 : loanToArv <= 80 ? 7 : loanToArv <= 85 ? 4 : 1;
  const ltcScore = loanToCost <= 85 ? 10 : loanToCost <= 90 ? 7 : loanToCost <= 95 ? 4 : 1;
  const leverageScore = (ltvScore + larvScore + ltcScore) / 3;

  // 2. Profit Score
  const profitScore =
    borrowerProfit >= 50000 ? 10 : borrowerProfit >= 25000 ? 7 : borrowerProfit >= 0 ? 4 : 1;

  // 3. Stress-Tested Profit Score
  const stressScore =
    stressTestedProfit > 25000
      ? 10
      : stressTestedProfit > 0
        ? 7
        : stressTestedProfit > -10000
          ? 4
          : 1;

  // 4. Underwater Score (loan-to-as-is ratio)
  const underwaterScore =
    loanToAsIsValue <= 85 ? 10 : loanToAsIsValue <= 95 ? 7 : loanToAsIsValue <= 100 ? 4 : 1;

  return {
    renovationDollarPerSf,
    days,
    totalCost,
    totalLoanAmount,
    closingCostsDollar,
    pointsDollar,
    perDiem,
    totalInterest,
    totalCosts,
    totalCostsOverall,
    arv,
    totalProjectCost,
    borrowerProfit,
    borrowerProfitStressTested,
    stressTestedLArv,
    stressTestedProfit,
    isLoanUnderwater,
    loanToAsIsValue,
    loanToArv,
    loanToCost,
    borrowerSpread,
    leverageScore,
    profitScore,
    stressScore,
    underwaterScore,
  };
}

/**
 * Calculate final underwriting score (0-100)
 * Based on weighted scoring rubric (LENDER-FOCUSED):
 * - 40%: Loan Leverage Metrics (LTV, LARV, LTC)
 * - 10%: Borrower Profit (reduced - borrower profit matters but isn't primary concern)
 * - 20%: Stress-Tested Profit (5% ARV reduction)
 * - 30%: Collateral Protection / Day-One Underwater Check (increased - lender safety critical)
 */
export function calculateFinalScore(
  calculated: CalculatedResults,
  formData: UnderwritingFormData,
): number {
  // Component 1: Loan Leverage Metrics (40 points max)
  // Uses pre-calculated leverageScore (1-10 scale, averaged from LTV, LARV, LTC)
  const leveragePoints = (calculated.leverageScore / 10) * 40;

  // Component 2: Borrower Profit (10 points max) - REDUCED from 30%
  // Uses pre-calculated profitScore (1-10 scale)
  const profitPoints = (calculated.profitScore / 10) * 10;

  // Component 3: Stress-Tested Profit (20 points max)
  // Uses pre-calculated stressScore (1-10 scale)
  const stressPoints = (calculated.stressScore / 10) * 20;

  // Component 4: Collateral Protection / Underwater Check (30 points max) - INCREASED from 10%
  // Uses pre-calculated underwaterScore (1-10 scale)
  const underwaterPoints = (calculated.underwaterScore / 10) * 30;

  // Sum all weighted components
  const finalScore = Math.round(
    leveragePoints + profitPoints + stressPoints + underwaterPoints,
  );

  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(
  value: number,
  decimals: number = 2,
): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Calculate ARV using weighted median based on comp selection (from Step 6)
 * Emphasized comps get 3x weight in the median calculation
 */
export function calculateWeightedARVFromComps(
  comps: PropertyComparable[],
  compSelectionState: CompSelectionState[],
  formData: UnderwritingFormData
): number {
  if (comps.length === 0) {
    throw new Error("At least one comp required for ARV calculation");
  }

  // Calculate price per sqft and weight for each comp
  const compsWithWeights = comps.map((c, idx) => {
    const state = compSelectionState.find((s) => s.compIndex === idx);
    const weight = state?.emphasized ? 3.0 : 1.0;
    return {
      pricePerSqft: c.price / c.sqft,
      weight,
    };
  });

  // Sort by price per sqft
  compsWithWeights.sort((a, b) => a.pricePerSqft - b.pricePerSqft);

  // Calculate total weight
  const totalWeight = compsWithWeights.reduce((sum, c) => sum + c.weight, 0);
  const halfWeight = totalWeight / 2;

  // Find weighted median (comp where cumulative weight crosses 50% threshold)
  let cumulativeWeight = 0;
  let medianPricePerSqft = compsWithWeights[0].pricePerSqft;

  for (const comp of compsWithWeights) {
    cumulativeWeight += comp.weight;
    if (cumulativeWeight >= halfWeight) {
      medianPricePerSqft = comp.pricePerSqft;
      break;
    }
  }

  // Apply to subject property square footage
  return Math.round(medianPricePerSqft * formData.squareFeet);
}

/**
 * Format $/sqft to 2 decimal places
 */
export function formatPricePerSqft(price: number, sqft: number): string {
  return (price / sqft).toFixed(2);
}
