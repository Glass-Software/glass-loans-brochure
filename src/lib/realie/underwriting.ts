import { searchComparables, calculateARV } from "./comps";
import { UnderwritingFormData, PropertyComps } from "@/types/underwriting";

/**
 * Get property estimates using Realie comp data
 */
export async function getRealiePropertyEstimates(
  formData: UnderwritingFormData
): Promise<PropertyComps> {
  console.log("[Realie] Starting property estimation...");

  // Search for comparables (TIER 1 ONLY while optimizing search criteria)
  const { comps, tier, searchRadius } = await searchComparables(formData, {
    maxTier: 1, // Only use Tier 1 while optimizing (prevents wasted API calls)
    marketType: formData.marketType,
  });

  if (comps.length === 0) {
    throw new Error("No comparable properties found");
  }

  console.log(
    `[Realie] Found ${comps.length} comps (Tier ${tier}, ${searchRadius}mi radius)`
  );

  // Calculate ARV using percentile approach
  const estimatedARV = calculateARV(comps, formData.rehab, formData.squareFeet);

  // Use the user's as-is estimate (they've seen the property, we haven't)
  const asIsValue = formData.userEstimatedAsIsValue;

  // Build market analysis summary
  const avgPricePerSqft =
    comps.reduce((sum, c) => sum + (c.pricePerSqft || 0), 0) / comps.length;
  const marketAnalysis =
    `Based on ${comps.length} comparable sales within ${searchRadius} miles. ` +
    `Average price per square foot: $${avgPricePerSqft.toFixed(2)}. ` +
    `Search quality: Tier ${tier} (${tier === 1 ? "tight" : tier === 2 ? "moderate" : "expanded"} criteria).`;

  // Calculate confidence based on tier
  // Tier reflects how much we had to relax criteria (beds, sqft, time)
  // Market type naturally affects radius but not confidence
  const confidence: "high" | "medium" | "low" =
    tier === 1 ? "high" : tier === 2 ? "medium" : "low";

  return {
    estimatedARV,
    asIsValue,
    compsUsed: comps,
    marketAnalysis,
    confidence,
  };
}
