import {
  UnderwritingFormData,
  CalculatedResults,
  BatchDataEnrichedEstimates,
  getRenovationLevel,
} from "@/types/underwriting";

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
${compLinks && compLinks.length > 0 ? `\n**USER-PROVIDED COMPARABLE PROPERTY ADDRESSES:**\n${compLinks.map((address, i) => `${i + 1}. ${address}`).join('\n')}\n\nPlease research these addresses and incorporate them into your estimates.` : ''}

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

3. **Comps**: ${compLinks && compLinks.length > 0 ? 'The user has provided comparable property addresses above. Research these addresses and use them as your primary comps, supplementing with additional research if needed.' : `Find 3-5 comparable properties that recently sold${propertyCity && propertyState ? ` in or near ${propertyCity}, ${propertyState}` : propertyState ? ` in ${propertyState}` : ' in the area'}. Focus on renovated properties for ARV comparison.`}
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
export const GARY_OPINION_SYSTEM_PROMPT = `You are Gary, the Senior Loan Underwriter at Glass Loans with over 20 years of experience in real estate financing.

## Your Identity & Philosophy

You are a conservative lender who understands risk because you've taken risks in the past. You provide accurate and true valuations - you're not overly conservative, but you're not reckless either. You're not the banker sitting in an ivory tower pushing paper; you're an on-the-ground investor who identifies value and is willing to make loans on good properties.

## Core Principles

1. **Lean conservative but be willing to take risks** - Balance safety with opportunity
2. **Never lend underwater** - Your loan should ALWAYS be at least 5% under the property's as-is value
3. **Skin in the game matters** - 100% Loan-to-Cost loans are bad; the more equity the borrower invests, the better

## Property Condition Definitions

**Good**: The property doesn't need much work. Flooring, foundation, HVAC, and plumbing are in good working condition. Appropriate for Light renovation level.

**Bad**: The property is in bad condition but not terrible. Likely needs flooring replacement, cabinets, countertops, and paint. Major items (foundation, HVAC, plumbing) are mostly functional but may need minor repairs. Appropriate for Medium renovation level.

**Really Bad**: This property is in really bad condition. Likely has plumbing issues, foundation issues, roof problems, plus flooring, cabinets, countertops, and paint need complete replacement. Appropriate for Heavy renovation level.

## Renovation Level Definitions

The renovation level should match the property condition. If the condition doesn't align with the renovation budget, FLAG IT as a potential blind spot.

**Light** (≤$30/SF): Paint, cleanup, minor deferred maintenance fixes. Should match "Good" condition properties.

**Medium** ($31-50/SF): Decent to full renovation - flooring, paint, cabinets, appliances, vanities, countertops, some plumbing. Should match "Bad" condition properties.

**Heavy** (>$50/SF): Full gut renovation fixing major items - electrical, roof, plumbing, HVAC, plus all finishes. Should match "Really Bad" condition properties.

**Important**: If condition and renovation level don't match, point it out. Example: If they claim top-of-market ARV but property is "Really Bad" with only Medium renovation, they likely won't achieve that price point without Heavy renovation. Exceptions exist (in-house crew with cheap labor), but mismatches warrant scrutiny.

## Leverage Metrics Definitions

Loan leverage is one of the most critical indicators of risk for fix-and-flip deals:

**Loan-to-As-Is Value (LTV)**: Ideally ≤85%. Measures borrower's equity cushion against current property value. Lower = better.

**Loan-to-ARV (LARV)**: Ideally ≤75%. Ensures loan remains well-collateralized after renovation, reducing risk if property sells below projections.

**Loan-to-Cost (LTC)**: Ideally ≤85%. Measures loan relative to total investment (purchase + renovation). Lower ratios mean more "skin in the game."

**All three metrics are equally important.** Lower leverage = stronger, safer loan. Higher ratios = increased risk and lower credit score.

## Scoring Rubric

Final score is 0-100 based on four weighted components:

1. **Loan Leverage Metrics (40% weight)**
   - High (8-10): LTV ≤85%, LARV ≤75%, LTC ≤85%
   - Medium (4-7): Moderate ratios
   - Low (1-3): High ratios (risky)

2. **Borrower Profit (30% weight)**
   - High (8-10): ≥$50k profit
   - Medium (4-7): $25-50k profit
   - Low (1-3): <$25k profit

3. **Stress-Tested Profit (20% weight)** - Assumes 10% ARV reduction
   - High (8-10): >$25k profit even after stress
   - Medium (4-7): $0-25k profit after stress
   - Low (1-3): ≤$0 (unprofitable) after stress

4. **Day-One Underwater Check (10% weight)** - Loan vs As-Is Value
   - High (8-10): ≤85% (safe cushion)
   - Medium (4-7): 85-95% (moderate risk)
   - Low (1-3): ≥95% (high risk / underwater)

You are known for being thorough, fair, and specific in your analysis. Provide direct, professional opinions focused on risk assessment and deal quality.`;

/**
 * Generate prompt for Gary's opinion
 */
export function generateGaryOpinionPrompt(
  formData: UnderwritingFormData,
  userCalculated: CalculatedResults,
  garyCalculated: CalculatedResults,
  aiEstimates: BatchDataEnrichedEstimates,
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

**BORROWER'S ESTIMATES:**
- Estimated As-Is Value: $${formData.userEstimatedAsIsValue.toLocaleString()}
- Estimated ARV: $${userEstimatedArv.toLocaleString()}
- Calculated Renovation Budget: $${(rehab / squareFeet).toFixed(2)}/SF (${getRenovationLevel(rehab / squareFeet)})

**DATA QUALITY:**
${aiEstimates.batchDataUsed
  ? `✓ VERIFIED DATA: This analysis uses real property data including:
- ${aiEstimates.compsUsed?.length || 0} actual comparable sales
- Professional valuation model estimates
- Public records and tax assessment data
${aiEstimates.compTier ? `- Search quality: ${aiEstimates.compTier === 1 ? "High (tight criteria)" : aiEstimates.compTier === 2 ? "Good (moderate criteria)" : "Fair (expanded criteria)"}` : ""}`
  : `⚠ LIMITED DATA: Using estimated values - recommend independent verification`}

${aiEstimates.batchDataUsed && aiEstimates.subjectPropertyDetails
  ? `**SUBJECT PROPERTY (Public Records):**
- Type: ${aiEstimates.subjectPropertyDetails.propertyType}
- Bed/Bath: ${aiEstimates.subjectPropertyDetails.bedrooms}/${aiEstimates.subjectPropertyDetails.bathrooms}
- Year Built: ${aiEstimates.subjectPropertyDetails.yearBuilt}
- Tax Assessed Value: $${aiEstimates.subjectPropertyDetails.taxAssessedValue?.toLocaleString()}
${aiEstimates.subjectPropertyDetails.lastSaleDate
    ? `- Last Sale: $${aiEstimates.subjectPropertyDetails.lastSalePrice?.toLocaleString()} on ${aiEstimates.subjectPropertyDetails.lastSaleDate}`
    : ""}`
  : ""}

${aiEstimates.batchDataUsed && aiEstimates.compsUsed && aiEstimates.compsUsed.length > 0
  ? `**COMPARABLE SALES (Real Data):**
${aiEstimates.compsUsed.map((comp: any, i: number) => {
    let compLine = `${i + 1}. ${comp.address} - $${comp.price.toLocaleString()}`;
    compLine += `\n   ${comp.bedrooms} bed / ${comp.bathrooms} bath, ${comp.sqft.toLocaleString()} sqft${comp.yearBuilt ? `, built ${comp.yearBuilt}` : ""}`;
    compLine += `\n   $${comp.pricePerSqft}/sqft${comp.distance ? `, ${comp.distance}` : ""}${comp.soldDate ? `, sold ${comp.soldDate}` : ""}`;

    // Show valuation data if available
    if (comp.avmValue || comp.taxAssessedValue) {
      compLine += `\n   `;
      if (comp.avmValue) {
        compLine += `AVM: $${comp.avmValue.toLocaleString()} (${(comp.avmConfidence * 100).toFixed(0)}% confidence)`;
      }
      if (comp.taxAssessedValue) {
        if (comp.avmValue) compLine += `, `;
        compLine += `Tax Assessed: $${comp.taxAssessedValue.toLocaleString()}`;
      }
    }

    // Flag potential issues
    if (comp.isPotentialFlip) {
      compLine += `\n   ⚠️ POTENTIAL FLIP: Sale price is ${((comp.price / comp.taxAssessedValue - 1) * 100).toFixed(0)}% above tax assessment (likely renovated)`;
    }

    return compLine;
  }).join("\n\n")}`
  : ""}

${aiEstimates.riskFlags && aiEstimates.riskFlags.length > 0
  ? `**RISK FLAGS DETECTED:**
${aiEstimates.riskFlags.map((flag: any) =>
    `- [${flag.severity.toUpperCase()}] ${flag.message}`
  ).join("\n")}`
  : ""}

**ARV COMPARISON:**
- **Borrower's ARV Estimate**: $${userEstimatedArv.toLocaleString()}
- **Your ARV Estimate**: $${aiEstimates.estimatedARV.toLocaleString()}
- **Difference**: $${Math.abs(userEstimatedArv - aiEstimates.estimatedARV).toLocaleString()} (${((Math.abs(userEstimatedArv - aiEstimates.estimatedARV) / aiEstimates.estimatedARV) * 100).toFixed(1)}%)

**AS-IS VALUE COMPARISON:**
- **Borrower's As-Is Estimate**: $${formData.userEstimatedAsIsValue.toLocaleString()}
- **Your As-Is Value (BatchData)**: $${aiEstimates.asIsValue.toLocaleString()}
- **Calculation Method**: MIN(Tax Assessed: $${aiEstimates.subjectPropertyDetails?.taxAssessedValue ? aiEstimates.subjectPropertyDetails.taxAssessedValue.toLocaleString() : "N/A"}, 85% of AVM: $${aiEstimates.avmValue ? Math.round(aiEstimates.avmValue * 0.85).toLocaleString() : "N/A"})
- **Difference**: $${Math.abs(formData.userEstimatedAsIsValue - aiEstimates.asIsValue).toLocaleString()} (${((Math.abs(formData.userEstimatedAsIsValue - aiEstimates.asIsValue) / aiEstimates.asIsValue) * 100).toFixed(1)}%)

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

1. **Comp Quality Check**: ${aiEstimates.batchDataUsed
  ? `Review each comp's bed/bath count, year built, and condition flags. Are we comparing apples-to-apples? Flag any comps marked as "POTENTIAL FLIP" - these are renovated properties that may skew ARV estimates upward for a distressed subject property.`
  : `Note limited data availability.`}

2. **Data Quality Assessment**: ${aiEstimates.batchDataUsed
  ? `Comment on the quality of the market data (${aiEstimates.compsUsed?.length} comps found, ${aiEstimates.compTier === 1 ? "tight search" : aiEstimates.compTier === 2 ? "moderate search" : "expanded search"}, valuation confidence: ${aiEstimates.avmConfidence}%). Are the comps tight or did we have to cast a wide net?`
  : `Note that this analysis uses estimated values due to limited data - recommend proceeding with caution and obtaining independent appraisal.`}

3. **ARV Assessment**: Do you agree with the borrower's ARV estimate of $${userEstimatedArv.toLocaleString()}? ${aiEstimates.batchDataUsed
  ? `Reference specific comps by address that support your $${aiEstimates.estimatedARV.toLocaleString()} valuation. If comps are flagged as potential flips, explain how that affects your ARV confidence.`
  : `Explain why your estimate is $${aiEstimates.estimatedARV.toLocaleString()} and whether theirs is reasonable, optimistic, or conservative.`}

4. **As-Is Value Assessment**: Does the borrower's as-is estimate of $${formData.userEstimatedAsIsValue.toLocaleString()} align with your calculation of $${aiEstimates.asIsValue.toLocaleString()}? If there's a significant difference (>10%), explain why and which value is more realistic.

5. **Property Condition vs Renovation Level**: Does the ${propertyCondition} condition match the ${getRenovationLevel(rehab / squareFeet)} renovation level ($${(rehab / squareFeet).toFixed(2)}/SF)? If mismatched, explain the implications for achieving the target ARV.

6. **Overall Deal Quality**: Is this a good deal? What's the risk level based on YOUR valuation?

7. **Risk Factors**: ${aiEstimates.riskFlags && aiEstimates.riskFlags.length > 0
  ? `Address the specific risk flags detected in the data above.`
  : `What are the main risks or red flags you see?`}

8. **Recommendation**: Clear recommendation - Approve, Approve with Conditions, or Decline.

**TONE:**
- Write in first person as Gary
- ${aiEstimates.batchDataUsed
  ? "Reference the real market data in your analysis - be specific about which comps support your opinion"
  : "Acknowledge that you're working with limited data and recommend independent verification"}
- Be direct and professional
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
