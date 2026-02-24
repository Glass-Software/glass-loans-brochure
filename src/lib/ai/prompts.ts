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
  const {
    propertyAddress,
    propertyCity,
    propertyState,
    propertyZip,
    purchasePrice,
    rehab,
    squareFeet,
    propertyCondition,
    userEstimatedArv,
    compLinks
  } = formData;

  // Build location constraint based on available data
  let locationConstraint = "";

  if (propertyState && propertyCity) {
    // Best case: We have state and city
    locationConstraint = `
**🎯 CRITICAL LOCATION CONSTRAINT:**
This property is located in ${propertyCity}, ${propertyState}${propertyZip ? ` ${propertyZip}` : ''}.

YOU MUST ONLY find comparable properties (comps) within the state of ${propertyState}.
DO NOT use comps from ANY other state under any circumstances.
Prioritize comps within a 10-mile radius of ${propertyCity}, ${propertyState}.
If you cannot find sufficient comps in ${propertyCity}, expand search to nearby cities IN ${propertyState} ONLY.
`;
  } else if (propertyState) {
    // Fallback: We have state but no city
    locationConstraint = `
**🎯 CRITICAL LOCATION CONSTRAINT:**
This property is located in ${propertyState}.

YOU MUST ONLY find comparable properties (comps) within the state of ${propertyState}.
DO NOT use comps from ANY other state under any circumstances.
`;
  } else {
    // Worst case: No structured location data
    locationConstraint = `
**⚠️ LOCATION NOTE:**
The exact state could not be automatically determined.
Carefully parse the address "${propertyAddress}" to determine the correct state.
Once determined, ONLY find comps in that same state. DO NOT use comps from other states.
`;
  }

  return `Analyze this property and provide market estimates:
${locationConstraint}

**PROPERTY DETAILS:**
- Address: ${propertyAddress}
${propertyCity ? `- City: ${propertyCity}` : ''}
${propertyState ? `- State: ${propertyState}` : ''}
${propertyZip ? `- ZIP Code: ${propertyZip}` : ''}
- Purchase Price: $${purchasePrice.toLocaleString()}
- Rehab Budget: $${rehab.toLocaleString()}
- Square Feet: ${squareFeet.toLocaleString()}
- Current Condition: ${propertyCondition}
- **User's ARV Estimate: $${userEstimatedArv.toLocaleString()}**
${compLinks && compLinks.length > 0 ? `\n**USER-PROVIDED COMPARABLE PROPERTIES:**\n${compLinks.map((link, i) => `${i + 1}. ${link}`).join('\n')}\n\nPlease analyze these comps and incorporate them into your estimates.` : ''}

**REQUESTED ANALYSIS:**
The user has estimated the ARV at $${userEstimatedArv.toLocaleString()}. Provide your own independent estimates in JSON format:

{
  "estimatedARV": <number>,
  "asIsValue": <number>,
  "compsUsed": [
    {
      "address": "<string>",
      "price": <number>,
      "sqft": <number>,
      "distance": "<string>",
      "soldDate": "<string>"
    }
  ],
  "marketAnalysis": "<brief summary including evaluation of user's ARV estimate>"
}

**ESTIMATION GUIDELINES:**
1. **Your Estimated ARV** (After Repair Value): Provide YOUR professional estimate of the property value after rehab, based on recent sales of similar renovated properties${propertyState ? ` IN ${propertyState}` : ''}. This may differ from the user's estimate.

2. **As-Is Value**: The current market value in ${propertyCondition} condition, without any improvements.

3. **Comps**: ${compLinks && compLinks.length > 0 ? 'The user has provided comparable property links above. Use these as your primary comps, and supplement with additional research if needed.' : `Find 3-5 comparable properties that recently sold${propertyCity && propertyState ? ` in or near ${propertyCity}, ${propertyState}` : propertyState ? ` in ${propertyState}` : ' in the area'}. Focus on renovated properties for ARV comparison.`}
   ${propertyState ? `\n   **🚨 CRITICAL: All comps MUST be located in ${propertyState}. VERIFY the state before including each comp.**` : ''}

4. **Market Analysis**: Briefly explain the local market conditions${propertyState ? ` in ${propertyState}` : ''}, trends, and YOUR reasoning for the estimates. Include a sentence comparing your ARV estimate to the user's estimate of $${userEstimatedArv.toLocaleString()} and whether you agree or disagree.

**IMPORTANT:**
- Return ONLY the JSON object, no other text
- All monetary values should be numbers without $ or commas
- Be realistic based on actual market conditions${propertyState ? ` in ${propertyState}` : ''}
- Your estimate should be independent - don't just match the user's number
${propertyState ? `- **Double-check that every comp address is in ${propertyState} before including it**` : ''}`;
}

/**
 * System prompt for Gary's underwriting opinion
 */
export const GARY_OPINION_SYSTEM_PROMPT = `You are Gary, a seasoned loan underwriter with over 20 years of experience in real estate financing at Glass Loans. You provide direct, professional opinions on loan applications with a focus on risk assessment and deal quality. You are known for being thorough, fair, and specific in your analysis.`;

/**
 * Generate prompt for Gary's opinion
 */
export function generateGaryOpinionPrompt(
  formData: UnderwritingFormData,
  userCalculated: CalculatedResults,
  garyCalculated: CalculatedResults,
  aiEstimates: { estimatedARV: number; asIsValue: number },
): string {
  const {
    propertyAddress,
    propertyCity,
    propertyState,
    purchasePrice,
    rehab,
    squareFeet,
    propertyCondition,
    interestRate,
    months,
    loanAtPurchase,
    userEstimatedArv,
    marketType,
    additionalDetails,
  } = formData;

  // Build location string for display
  const locationDisplay = propertyCity && propertyState
    ? `${propertyCity}, ${propertyState}`
    : propertyState
    ? propertyState
    : propertyAddress;

  return `Provide your professional underwriting opinion on this loan application.

**DEAL SUMMARY:**
- Property: ${locationDisplay}
${propertyAddress !== locationDisplay ? `- Full Address: ${propertyAddress}` : ''}
- Purchase Price: $${purchasePrice.toLocaleString()}
- Rehab Budget: $${rehab.toLocaleString()}
- Square Feet: ${squareFeet.toLocaleString()}
- Condition: ${propertyCondition}
- Market: ${marketType}

**LOAN TERMS:**
- Loan Amount: $${loanAtPurchase.toLocaleString()} at ${interestRate}% for ${months} months
- Renovation Funds: $${formData.renovationFunds?.toLocaleString() || "0"}

**ARV COMPARISON:**
- **Borrower's ARV Estimate**: $${userEstimatedArv.toLocaleString()}
- **Your ARV Estimate**: $${aiEstimates.estimatedARV.toLocaleString()}
- **Difference**: $${Math.abs(userEstimatedArv - aiEstimates.estimatedARV).toLocaleString()} (${((Math.abs(userEstimatedArv - aiEstimates.estimatedARV) / aiEstimates.estimatedARV) * 100).toFixed(1)}%)
- As-Is Value: $${aiEstimates.asIsValue.toLocaleString()}

**KEY METRICS (Using Your ARV):**
- Loan to ARV: ${garyCalculated.loanToArv.toFixed(2)}%
- Loan to As-Is Value: ${garyCalculated.loanToAsIsValue.toFixed(2)}%
- Loan to Cost: ${garyCalculated.loanToCost.toFixed(2)}%
- Borrower Spread: $${garyCalculated.borrowerSpread.toLocaleString()}
- Borrower Profit: $${garyCalculated.borrowerProfit.toLocaleString()}
- Stress Tested L-ARV (90%): ${garyCalculated.stressTestedLArv.toFixed(2)}%
- Loan Underwater Day 1?: ${garyCalculated.isLoanUnderwater ? "Yes" : "No"}
- Total Interest: $${garyCalculated.totalInterest.toLocaleString()}
${additionalDetails ? `\n**BORROWER NOTES:**\n${additionalDetails}\n` : ""}

**YOUR TASK:**
Write a 3-4 paragraph professional opinion covering:

1. **ARV Assessment**: Do you agree with the borrower's ARV estimate of $${userEstimatedArv.toLocaleString()}? Explain why your estimate is $${aiEstimates.estimatedARV.toLocaleString()} and whether theirs is reasonable, optimistic, or conservative.

2. **Overall Deal Quality**: Is this a good deal? What's the risk level based on YOUR valuation?

3. **Strengths & Concerns**: What are the key strengths? What are the main risks or red flags?

4. **Recommendation**: Clear recommendation - Approve, Approve with Conditions, or Decline. If you disagree significantly with their ARV, mention that the deal metrics change under your valuation.

**TONE:**
- Write in first person as Gary
- Be direct and professional
- Be specific with numbers and metrics
- Address the ARV comparison directly in your first paragraph
- If there are problems, state them clearly
- Don't sugarcoat risks, but be fair

Return ONLY your written opinion, no JSON or additional formatting.`;
}

/**
 * Generate a simplified prompt for testing (no AI required)
 */
export function generateMockGaryOpinion(
  formData: UnderwritingFormData,
  calculated: CalculatedResults,
  userArv: number,
  garyArv: number,
): string {
  const ltvScore =
    calculated.loanToArv <= 70 ? "conservative" : calculated.loanToArv <= 75 ? "moderate" : "aggressive";
  const arvDiff = Math.abs(userArv - garyArv);
  const arvPctDiff = (arvDiff / garyArv) * 100;

  return `Thanks for submitting this ${formData.propertyAddress} deal for review.

You've estimated the ARV at $${(userArv / 1000).toFixed(0)}k. Based on recent comps in the area, I estimate $${(garyArv / 1000).toFixed(0)}k, which is ${arvPctDiff < 5 ? "very close to your number" : arvPctDiff < 10 ? "reasonably aligned with your estimate" : userArv > garyArv ? `${arvPctDiff.toFixed(0)}% higher than my estimate - you may be optimistic` : `${arvPctDiff.toFixed(0)}% lower than my estimate - you're being conservative`}.

Using my ARV estimate, this is a ${ltvScore} deal with a Loan-to-ARV of ${calculated.loanToArv.toFixed(1)}%. The borrower stands to make around $${Math.round(calculated.borrowerProfit / 1000)}k if everything goes according to plan. The ${formData.marketType.toLowerCase()} market location ${formData.marketType === "Primary" ? "is favorable" : formData.marketType === "Secondary" ? "presents moderate risk" : "requires careful consideration"}. Property condition is listed as ${formData.propertyCondition.toLowerCase()}, and the ${formData.months}-month timeline ${formData.months <= 6 ? "is tight but manageable" : "provides adequate time for the rehab"}.

${!calculated.isLoanUnderwater ? "The good news is the loan wouldn't be underwater day 1, which provides downside protection." : "One concern: the loan would be underwater day 1, which increases our risk exposure."} The Loan-to-Cost ratio of ${calculated.loanToCost.toFixed(1)}% ${calculated.loanToCost <= 80 ? "is conservative" : "requires the borrower to have adequate reserves"}.

**My Recommendation:** ${calculated.loanToArv <= 70 && calculated.borrowerProfit >= 20000 && !calculated.isLoanUnderwater ? "Approve" : calculated.loanToArv <= 75 && calculated.borrowerProfit >= 15000 ? "Approve with standard conditions" : "Needs additional review"}. ${calculated.loanToArv > 75 ? "Request additional equity injection to reduce LTV below 75%." : calculated.borrowerProfit < 15000 ? "Borrower spread is thin - verify ARV estimate with local appraiser." : "Standard terms apply."}`;
}
