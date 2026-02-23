import {
  UnderwritingFormData,
  AIPropertyEstimates,
  CalculatedResults,
} from "@/types/underwriting";

/**
 * Calculate all underwriting metrics based on form inputs and AI estimates
 * All formulas are ported directly from the Excel template
 */
export function calculateUnderwriting(
  formData: UnderwritingFormData,
  aiEstimates: AIPropertyEstimates,
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

  const { estimatedARV, asIsValue, monthlyRent } = aiEstimates;

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

  // Formula 11: Borrower Profit = estimatedARV - totalCostsOverall
  const borrowerProfit = estimatedARV - totalCostsOverall;

  // Formula 12: Borrower Profit (Stress Tested) = (estimatedARV × 0.9) - totalCostsOverall
  const borrowerProfitStressTested = estimatedARV * 0.9 - totalCostsOverall;

  // Formula 13: Stress Tested L-ARV = totalLoanAmount / (estimatedARV × 0.9)
  const stressTestedLArv = (totalLoanAmount / (estimatedARV * 0.9)) * 100;

  // Formula 14: Break Even Day 1 = asIsValue - (loanAtPurchase + totalInterest + points$ + (0.04 × totalLoanAmount))
  const breakEvenDay1 =
    asIsValue -
    (loanAtPurchase + totalInterest + pointsDollar + 0.04 * totalLoanAmount);

  // Formula 15: Debt Yield = ((monthlyRent × 12) × 0.6) / totalLoanAmount
  const debtYield = ((monthlyRent * 12 * 0.6) / totalLoanAmount) * 100;

  // Formula 16: Loan to As-is Value = loanAtPurchase / asIsValue
  const loanToAsIsValue = (loanAtPurchase / asIsValue) * 100;

  // Formula 17: Loan to ARV = totalLoanAmount / estimatedARV
  const loanToArv = (totalLoanAmount / estimatedARV) * 100;

  // Formula 18: Loan to Cost = totalLoanAmount / totalCost
  const loanToCost = (totalLoanAmount / totalCost) * 100;

  // Formula 19: Borrower Spread = same as Borrower Profit (#11)
  const borrowerSpread = borrowerProfit;

  // Formula 20: Break Even in Foreclosure = IF(breakEvenDay1 < 0, "No", "Yes")
  const breakEvenInForeclosure = breakEvenDay1 >= 0;

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
    borrowerProfit,
    borrowerProfitStressTested,
    stressTestedLArv,
    breakEvenDay1,
    debtYield,
    loanToAsIsValue,
    loanToArv,
    loanToCost,
    borrowerSpread,
    breakEvenInForeclosure,
  };
}

/**
 * Calculate final score (0-100) based on key metrics
 */
export function calculateFinalScore(
  calculated: CalculatedResults,
  formData: UnderwritingFormData,
): number {
  let score = 0;

  // Loan to ARV (30 points max)
  if (calculated.loanToArv <= 60) score += 30;
  else if (calculated.loanToArv <= 70) score += 20;
  else if (calculated.loanToArv <= 75) score += 10;

  // Loan to As-Is Value (20 points max)
  if (calculated.loanToAsIsValue <= 75) score += 20;
  else if (calculated.loanToAsIsValue <= 85) score += 10;

  // Borrower Spread (20 points max)
  if (calculated.borrowerSpread >= 50000) score += 20;
  else if (calculated.borrowerSpread >= 30000) score += 15;
  else if (calculated.borrowerSpread >= 20000) score += 10;

  // Break even in foreclosure (10 points)
  if (calculated.breakEvenInForeclosure) score += 10;

  // Market type (10 points max)
  if (formData.marketType === "Primary") score += 10;
  else if (formData.marketType === "Secondary") score += 5;
  // Tertiary = 0 points

  // Property condition (10 points max)
  if (formData.propertyCondition === "Good") score += 10;
  else if (formData.propertyCondition === "Bad") score += 5;
  // Really Bad = 0 points

  return Math.min(100, Math.max(0, score)); // Clamp between 0-100
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
