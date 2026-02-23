import { UnderwritingFormData, CalculatedResults } from "@/types/underwriting";

/**
 * System prompt for property estimation
 */
export const PROPERTY_ESTIMATION_SYSTEM_PROMPT = `You are a real estate expert specializing in property valuation and rental market analysis. You have access to current market data and comparable sales information. Provide accurate, data-driven estimates for property values and rental rates.`;

/**
 * Generate prompt for property comps and estimates
 */
export function generatePropertyEstimationPrompt(
  formData: UnderwritingFormData,
): string {
  const { propertyAddress, purchasePrice, rehab, squareFeet, propertyCondition, compLinks } =
    formData;

  return `Analyze this fix-and-flip property and provide market estimates:

**PROPERTY DETAILS:**
- Address: ${propertyAddress}
- Purchase Price: $${purchasePrice.toLocaleString()}
- Rehab Budget: $${rehab.toLocaleString()}
- Square Feet: ${squareFeet.toLocaleString()}
- Current Condition: ${propertyCondition}
${compLinks && compLinks.length > 0 ? `\n**USER-PROVIDED COMPARABLE PROPERTIES:**\n${compLinks.map((link, i) => `${i + 1}. ${link}`).join('\n')}\n\nPlease analyze these comps and incorporate them into your estimates.` : ''}

**REQUESTED ANALYSIS:**
Provide the following estimates in JSON format:

{
  "estimatedARV": <number>,
  "asIsValue": <number>,
  "monthlyRent": <number>,
  "compsUsed": [
    {
      "address": "<string>",
      "price": <number>,
      "sqft": <number>,
      "distance": "<string>",
      "soldDate": "<string>"
    }
  ],
  "marketAnalysis": "<brief summary of market conditions and reasoning>"
}

**ESTIMATION GUIDELINES:**
1. **Estimated ARV** (After Repair Value): The projected market value after completing the rehab. Base this on recent sales of similar renovated properties in the area.

2. **As-Is Value**: The current market value in ${propertyCondition} condition, without any improvements. This should be below the purchase price or align with distressed property sales.

3. **Monthly Rent**: The expected monthly rental income if the property were rented as-is. Consider local rental comps and property condition.

4. **Comps**: ${compLinks && compLinks.length > 0 ? 'The user has provided comparable property links above. Use these as your primary comps, and supplement with additional research if needed.' : 'Find 3-5 comparable properties that recently sold in the area. Include both renovated properties (for ARV) and as-is properties.'}

5. **Market Analysis**: Briefly explain the local market conditions, trends, and your reasoning for the estimates.

**IMPORTANT:**
- Return ONLY the JSON object, no other text
- All monetary values should be numbers without $ or commas
- Be realistic based on actual market conditions
- Consider the property condition when estimating values`;
}

/**
 * System prompt for Gary's underwriting opinion
 */
export const GARY_OPINION_SYSTEM_PROMPT = `You are Gary, a seasoned loan underwriter with over 20 years of experience in fix-and-flip financing at Glass Loans. You provide direct, professional opinions on loan applications with a focus on risk assessment and deal quality. You are known for being thorough, fair, and specific in your analysis.`;

/**
 * Generate prompt for Gary's opinion
 */
export function generateGaryOpinionPrompt(
  formData: UnderwritingFormData,
  calculated: CalculatedResults,
  aiEstimates: { estimatedARV: number; asIsValue: number; monthlyRent: number },
): string {
  const {
    propertyAddress,
    purchasePrice,
    rehab,
    squareFeet,
    propertyCondition,
    interestRate,
    months,
    loanAtPurchase,
    marketType,
    additionalDetails,
  } = formData;

  return `Provide your professional underwriting opinion on this fix-and-flip loan application.

**DEAL SUMMARY:**
- Property: ${propertyAddress}
- Purchase Price: $${purchasePrice.toLocaleString()}
- Rehab Budget: $${rehab.toLocaleString()}
- Square Feet: ${squareFeet.toLocaleString()}
- Condition: ${propertyCondition}
- Market: ${marketType}

**LOAN TERMS:**
- Loan Amount: $${loanAtPurchase.toLocaleString()} at ${interestRate}% for ${months} months
- Renovation Funds: $${formData.renovationFunds?.toLocaleString() || "0"}

**VALUATION:**
- Estimated ARV: $${aiEstimates.estimatedARV.toLocaleString()}
- As-Is Value: $${aiEstimates.asIsValue.toLocaleString()}
- Monthly Rent (As-Is): $${aiEstimates.monthlyRent.toLocaleString()}

**KEY METRICS:**
- Loan to ARV: ${calculated.loanToArv.toFixed(2)}%
- Loan to As-Is Value: ${calculated.loanToAsIsValue.toFixed(2)}%
- Loan to Cost: ${calculated.loanToCost.toFixed(2)}%
- Borrower Spread: $${calculated.borrowerSpread.toLocaleString()}
- Borrower Profit: $${calculated.borrowerProfit.toLocaleString()}
- Stress Tested L-ARV (90%): ${calculated.stressTestedLArv.toFixed(2)}%
- Break Even in Foreclosure: ${calculated.breakEvenInForeclosure ? "Yes" : "No"}
- Debt Yield: ${calculated.debtYield.toFixed(2)}%
- Total Interest: $${calculated.totalInterest.toLocaleString()}
${additionalDetails ? `\n**BORROWER NOTES:**\n${additionalDetails}\n` : ""}

**YOUR TASK:**
Write a 3-4 paragraph professional opinion covering:

1. **Overall Assessment**: Is this a good deal? What's the risk level?

2. **Strengths & Concerns**: What are the key strengths of this deal? What are the main risks or red flags?

3. **Market & Exit Strategy**: Commentary on the market type and exit strategy considerations. Is the timeline realistic?

4. **Recommendation**: Clear recommendation - Approve, Approve with Conditions, or Decline. If conditions, specify them.

**TONE:**
- Write in first person as Gary
- Be direct and professional
- Be specific with numbers and metrics
- If there are problems, state them clearly
- If it's a good deal, explain why
- Don't sugarcoat risks, but be fair

Return ONLY your written opinion, no JSON or additional formatting.`;
}

/**
 * Generate a simplified prompt for testing (no AI required)
 */
export function generateMockGaryOpinion(
  formData: UnderwritingFormData,
  calculated: CalculatedResults,
): string {
  const ltvScore =
    calculated.loanToArv <= 70 ? "conservative" : calculated.loanToArv <= 75 ? "moderate" : "aggressive";

  return `Thanks for submitting this ${formData.propertyAddress} deal for review.

Looking at the numbers, this is a ${ltvScore} deal with a Loan-to-ARV of ${calculated.loanToArv.toFixed(1)}%. The borrower stands to make around $${Math.round(calculated.borrowerProfit / 1000)}k if everything goes according to plan, which provides ${calculated.borrowerProfit >= 30000 ? "good" : "moderate"} cushion for unexpected costs.

The ${formData.marketType.toLowerCase()} market location ${formData.marketType === "Primary" ? "is favorable" : formData.marketType === "Secondary" ? "presents moderate risk" : "requires careful consideration"}. Property condition is listed as ${formData.propertyCondition.toLowerCase()}, and the ${formData.months}-month timeline ${formData.months <= 6 ? "is tight but manageable" : "provides adequate time for the rehab"}.

${calculated.breakEvenInForeclosure ? "The good news is we'd break even in a foreclosure scenario, which provides downside protection." : "One concern: we wouldn't break even in a foreclosure scenario, which increases our risk exposure."} The Loan-to-Cost ratio of ${calculated.loanToCost.toFixed(1)}% ${calculated.loanToCost <= 80 ? "is conservative" : "requires the borrower to have adequate reserves"}.

**My Recommendation:** ${calculated.loanToArv <= 70 && calculated.borrowerProfit >= 20000 && calculated.breakEvenInForeclosure ? "Approve" : calculated.loanToArv <= 75 && calculated.borrowerProfit >= 15000 ? "Approve with standard conditions" : "Needs additional review"}. ${calculated.loanToArv > 75 ? "Request additional equity injection to reduce LTV below 75%." : calculated.borrowerProfit < 15000 ? "Borrower spread is thin - verify ARV estimate with local appraiser." : "Standard terms apply."}`;
}
