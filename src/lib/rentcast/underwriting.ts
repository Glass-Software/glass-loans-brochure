import { calculateARV, mapPropertyType, getRadiusForMarketAndTier } from "./comps";
import { getRentCastClient } from "./client";
import { RentCastAVMParams, AVMMetadata, NormalizedComparable } from "./types";
import { UnderwritingFormData, PropertyComps } from "@/types/underwriting";
import { retryWithBackoff } from "./retry";

/**
 * Get property as-is value from RentCast AVM with specified radius
 * Falls back to user estimate on error
 */
async function getAsIsValue(
  formData: UnderwritingFormData,
  maxRadius: number
): Promise<{
  asIsValue: number;
  avmMetadata: AVMMetadata;
  avmComparables: NormalizedComparable[];
  subjectLatitude?: number;
  subjectLongitude?: number;
}> {
  console.log(`[RentCast AVM] Fetching as-is value (${maxRadius}mi radius)...`);

  const client = getRentCastClient();

  const avmParams: RentCastAVMParams = {
    address: formData.propertyAddress,
    propertyType: mapPropertyType(formData.propertyType),
    bedrooms: formData.bedrooms,
    bathrooms: formData.bathrooms,
    squareFootage: formData.squareFeet,
    lookupSubjectAttributes: true, // Use actual property data for best accuracy
    // Comp filtering: tighter radius and more recent listings for better quality
    maxRadius, // Use tiered radius based on market type
    daysOld: 365, // Properties sold/listed within last year
    compCount: 25, // RentCast API maximum (documented range: 5-25)
  };

  try {
    const avmResponse = await client.getPropertyValue(avmParams);

    console.log(`[RentCast AVM] Success: $${avmResponse.price.toLocaleString()}`);
    console.log(`[RentCast AVM] Confidence range: $${avmResponse.priceRangeLow.toLocaleString()} - $${avmResponse.priceRangeHigh.toLocaleString()}`);

    // Calculate confidence metrics
    const range = avmResponse.priceRangeHigh - avmResponse.priceRangeLow;
    const percentRange = (range / avmResponse.price) * 100;

    // Normalize AVM comparables to NormalizedComparable format
    // Filter out comps with missing essential data
    const avmComparables = avmResponse.comparables
      ?.filter(comp => {
        // Must have price, sqft, and at least beds/baths data
        const hasEssentialData =
          comp.price &&
          comp.price > 0 &&
          comp.squareFootage &&
          comp.squareFootage > 0 &&
          comp.bedrooms !== undefined &&
          comp.bathrooms !== undefined;

        if (!hasEssentialData) {
          console.warn(`[RentCast AVM] Filtered out comp with incomplete data: ${comp.formattedAddress || comp.addressLine1}`);
        }

        return hasEssentialData;
      })
      .map(comp => {
        // Format date to remove timestamp (e.g., "2024-01-15" instead of "2024-01-15T12:00:00Z")
        const rawDate = comp.listedDate || comp.lastSeenDate;
        const formattedDate = rawDate ? rawDate.split('T')[0] : undefined;

        return {
          address: comp.formattedAddress || comp.addressLine1 || '',
          price: comp.price!, // Safe to use ! after filter
          sqft: comp.squareFootage!,
          bedrooms: comp.bedrooms!,
          bathrooms: comp.bathrooms!,
          yearBuilt: comp.yearBuilt,
          distance: comp.distance !== undefined ? `${comp.distance.toFixed(2)} miles` : undefined,
          soldDate: formattedDate,
          pricePerSqft: comp.price! / comp.squareFootage!,
          listingUrl: undefined, // AVM comps don't have listing URLs
          correlation: comp.correlation, // AVM correlation score (0-1)
          latitude: comp.latitude, // For map display
          longitude: comp.longitude, // For map display
        };
      }) || [];

    console.log(`[RentCast AVM] Normalized ${avmComparables.length} AVM comparables (filtered for complete data)`);

    return {
      asIsValue: avmResponse.price,
      avmComparables, // NEW: Return normalized comps for ARV calculation
      avmMetadata: {
        source: 'rentcast_avm',
        confidence: {
          low: avmResponse.priceRangeLow,
          high: avmResponse.priceRangeHigh,
          range,
          percentRange,
        },
        subjectCoordinates: avmResponse.subjectProperty?.latitude && avmResponse.subjectProperty?.longitude
          ? {
              latitude: avmResponse.subjectProperty.latitude,
              longitude: avmResponse.subjectProperty.longitude,
            }
          : undefined,
        timestamp: new Date().toISOString(),
        avmComparables, // Include AVM comps for transparency
      },
      subjectLatitude: avmResponse.subjectProperty?.latitude,
      subjectLongitude: avmResponse.subjectProperty?.longitude,
    };
  } catch (error: any) {
    console.error(`[RentCast AVM] Failed: ${error.message}`);
    // No fallback - throw error to trigger next provider in chain
    throw error;
  }
}

/**
 * Get property estimates using RentCast AVM endpoint exclusively
 * Uses AVM for as-is value and comparables (up to 25 high-quality comps)
 * Implements 3-tier radius escalation based on market type
 * Uses retry logic with email alerts on failure
 */
export async function getRentCastPropertyEstimates(
  formData: UnderwritingFormData
): Promise<PropertyComps> {
  console.log("[RentCast] Starting property estimation...");

  const marketType = formData.marketType || "Suburban";
  let tier: 1 | 2 | 3 = 1;
  let avmResult: Awaited<ReturnType<typeof getAsIsValue>>;
  let searchRadius = getRadiusForMarketAndTier(marketType, tier);

  // Tier 1: Try with tight radius
  try {
    console.log(`[RentCast] Tier 1 AVM search (${searchRadius}mi radius)...`);
    avmResult = await retryWithBackoff(
      () => getAsIsValue(formData, searchRadius),
      { maxAttempts: 3, operationName: "RentCast AVM" }
    );

    console.log(`[RentCast] Tier 1 found ${avmResult.avmComparables.length} comps`);

    // Only escalate if we have fewer than 20 comps
    if (avmResult.avmComparables.length >= 20) {
      console.log(`[RentCast] Tier 1 sufficient (${avmResult.avmComparables.length} comps), using these results`);
    } else {
      console.log(`[RentCast] Tier 1 returned only ${avmResult.avmComparables.length} comps (need 20+), escalating to Tier 2...`);
      tier = 2;
      searchRadius = getRadiusForMarketAndTier(marketType, tier);

      console.log(`[RentCast] Tier 2 AVM search (${searchRadius}mi radius)...`);
      avmResult = await retryWithBackoff(
        () => getAsIsValue(formData, searchRadius),
        { maxAttempts: 3, operationName: "RentCast AVM" }
      );

      console.log(`[RentCast] Tier 2 found ${avmResult.avmComparables.length} comps`);

      if (avmResult.avmComparables.length >= 20) {
        console.log(`[RentCast] Tier 2 sufficient (${avmResult.avmComparables.length} comps), using these results`);
      } else {
        console.log(`[RentCast] Tier 2 returned only ${avmResult.avmComparables.length} comps (need 20+), escalating to Tier 3...`);
        tier = 3;
        searchRadius = getRadiusForMarketAndTier(marketType, tier);

        console.log(`[RentCast] Tier 3 AVM search (${searchRadius}mi radius, maximum reach)...`);
        avmResult = await retryWithBackoff(
          () => getAsIsValue(formData, searchRadius),
          { maxAttempts: 3, operationName: "RentCast AVM" }
        );

        console.log(`[RentCast] Tier 3 found ${avmResult.avmComparables.length} comps (maximum reach)`);
      }
    }
  } catch (error) {
    console.error(`[RentCast] AVM failed at Tier ${tier}:`, error);
    throw error;
  }

  const { asIsValue, avmComparables, avmMetadata, subjectLatitude, subjectLongitude } = avmResult;

  // Use AVM comparables for ARV calculation
  if (avmComparables.length === 0) {
    const error = new Error("No comparable sales found. Please try a different address.");
    (error as any).code = "NO_COMPS_FOUND";
    throw error;
  }

  console.log(
    `[RentCast] Using ${avmComparables.length} comparables from Tier ${tier} AVM search (${searchRadius}mi radius) for ARV calculation`
  );

  // Calculate ARV using percentile approach with user-provided square footage
  const estimatedARV = calculateARV(avmComparables, formData.rehab, formData.squareFeet);

  // Build market analysis summary
  const avgPricePerSqft =
    avmComparables.reduce((sum, c) => sum + (c.pricePerSqft || 0), 0) / avmComparables.length;

  const avmSource = avmMetadata.source === 'rentcast_avm'
    ? 'RentCast AVM'
    : 'user estimate (AVM unavailable)';

  const marketAnalysis =
    `Based on ${avmComparables.length} comparable sales from RentCast AVM (Tier ${tier} search within ${searchRadius} miles). ` +
    `Average price per square foot: $${avgPricePerSqft.toFixed(2)}. ` +
    `Comps filtered by RentCast's proprietary algorithm for similarity and recency. ` +
    `As-is value from ${avmSource}.`;

  // Determine confidence based on tier, AVM correlation scores and comp count
  let confidence: "high" | "medium" | "low";
  // Calculate average correlation (0-1 scale from AVM)
  const compsWithCorrelation = avmComparables.filter(c => c.correlation !== undefined);
  const avgCorrelation = compsWithCorrelation.length > 0
    ? compsWithCorrelation.reduce((sum, c) => sum + (c.correlation || 0), 0) / compsWithCorrelation.length
    : 0;

  if (tier === 1 && avmComparables.length >= 20 && avgCorrelation >= 0.85) {
    confidence = "high";
  } else if ((tier === 2 && avmComparables.length >= 15) || (tier === 1 && avmComparables.length >= 10) || avgCorrelation >= 0.75) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    estimatedARV,
    asIsValue,
    compsUsed: avmComparables,
    marketAnalysis,
    confidence,
    avmMetadata,
    userEstimatedAsIsValue: formData.userEstimatedAsIsValue, // Optional - preserve if provided
    subjectLatitude, // Subject property latitude from AVM
    subjectLongitude, // Subject property longitude from AVM
  };
}
