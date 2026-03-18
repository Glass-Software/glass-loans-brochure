import { calculateARV, mapPropertyType } from "./comps";
import { getRentCastClient } from "./client";
import { RentCastAVMParams, AVMMetadata, NormalizedComparable } from "./types";
import { UnderwritingFormData, PropertyComps } from "@/types/underwriting";
import { retryWithBackoff } from "./retry";

/**
 * Get property as-is value from RentCast AVM
 * Falls back to user estimate on error
 */
async function getAsIsValue(
  formData: UnderwritingFormData
): Promise<{
  asIsValue: number;
  avmMetadata: AVMMetadata;
  avmComparables: NormalizedComparable[]; // NEW: Return AVM comps for ARV calculation
  subjectLatitude?: number;
  subjectLongitude?: number;
}> {
  console.log("[RentCast AVM] Fetching as-is value...");

  const client = getRentCastClient();

  const avmParams: RentCastAVMParams = {
    address: formData.propertyAddress,
    propertyType: mapPropertyType(formData.propertyType),
    bedrooms: formData.bedrooms,
    bathrooms: formData.bathrooms,
    squareFootage: formData.squareFeet,
    lookupSubjectAttributes: true, // Use actual property data for best accuracy
    // Comp filtering: tighter radius and more recent listings for better quality
    maxRadius: 3, // Focus on nearby properties
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

    // Validate against user estimate (log warnings, don't reject)
    const userEstimate = formData.userEstimatedAsIsValue;
    const variance = Math.abs((avmResponse.price - userEstimate) / userEstimate) * 100;

    if (variance > 50) {
      console.warn(`[RentCast AVM] Large variance from user estimate: ${variance.toFixed(1)}%`);
      console.warn(`[RentCast AVM] AVM: $${avmResponse.price.toLocaleString()}, User: $${userEstimate.toLocaleString()}`);
    }

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
    console.warn(`[RentCast AVM] Failed: ${error.message}`);
    console.warn(`[RentCast AVM] Falling back to user estimate: $${formData.userEstimatedAsIsValue.toLocaleString()}`);

    return {
      asIsValue: formData.userEstimatedAsIsValue,
      avmComparables: [], // NEW: Empty array when falling back to user estimate
      avmMetadata: {
        source: 'user_estimate',
        timestamp: new Date().toISOString(),
        fallbackReason: error.code || error.message,
      },
    };
  }
}

/**
 * Get property estimates using RentCast AVM endpoint
 * Uses AVM's built-in comparable selection (correlation-ranked) with compCount=50
 * Uses retry logic with email alerts on failure
 */
export async function getRentCastPropertyEstimates(
  formData: UnderwritingFormData
): Promise<PropertyComps> {
  console.log("[RentCast] Starting property estimation...");

  // Execute AVM with retry logic
  // NOTE: AVM endpoint returns comparables, so we no longer need separate property search
  const avmResult = await retryWithBackoff(
    () => getAsIsValue(formData),
    { maxAttempts: 3, operationName: "RentCast AVM" }
  );

  /* DEPRECATED: Using AVM comparables instead of separate property search
  const [avmResult, compsResult] = await Promise.all([
    retryWithBackoff(
      () => getAsIsValue(formData),
      { maxAttempts: 3, operationName: "RentCast AVM" }
    ),
    retryWithBackoff(
      () => searchComparables(formData, {
        maxTier: 1, // Only use Tier 1 (user-selected market type determines radius)
        marketType: formData.marketType,
      }),
      { maxAttempts: 3, operationName: "RentCast Comps Search" }
    ),
  ]);
  */

  const { avmComparables: comps, asIsValue, avmMetadata, subjectLatitude, subjectLongitude } = avmResult;

  if (comps.length === 0) {
    throw new Error("No comparable properties found");
  }

  console.log(
    `[RentCast] Using ${comps.length} comparables from valuation endpoint for ARV calculation`
  );

  // Calculate ARV using percentile approach
  const estimatedARV = calculateARV(comps, formData.rehab, formData.squareFeet);

  // Build market analysis summary
  const avgPricePerSqft =
    comps.reduce((sum, c) => sum + (c.pricePerSqft || 0), 0) / comps.length;

  const avmSource = avmMetadata.source === 'rentcast_avm'
    ? 'RentCast AVM'
    : 'user estimate (AVM unavailable)';

  const marketAnalysis =
    `Based on ${comps.length} comparable sales (correlation-ranked by similarity). ` +
    `Average price per square foot: $${avgPricePerSqft.toFixed(2)}. ` +
    `Search parameters: 3-mile radius, sold within 365 days. ` +
    `As-is value from ${avmSource}.`;

  // AVM comparables are pre-filtered and ranked by correlation score
  const confidence: "high" | "medium" | "low" = "high";

  return {
    estimatedARV,
    asIsValue,
    compsUsed: comps,
    marketAnalysis,
    confidence,
    avmMetadata,
    userEstimatedAsIsValue: formData.userEstimatedAsIsValue, // Preserve for comparison
    subjectLatitude, // Subject property latitude from AVM
    subjectLongitude, // Subject property longitude from AVM
  };
}
