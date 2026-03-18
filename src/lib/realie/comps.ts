import { getRealieClient } from "./client";
import { RealieCompSearchParams, NormalizedComparable } from "./types";
import { MarketType, UnderwritingFormData } from "@/types/underwriting";

/**
 * Get search radius based on market type and tier (preserved from BatchData)
 */
function getRadiusForMarketAndTier(
  marketType: MarketType,
  tier: 1 | 2 | 3
): number {
  const radii = {
    Urban: [2, 3, 5], // Dense metro areas - Tier 1: 2mi, Tier 2: 3mi, Tier 3: 5mi
    Suburban: [3, 5, 8], // Mid-size cities - Tier 1: 3mi, Tier 2: 5mi, Tier 3: 8mi
    Rural: [7, 10, 15], // Small markets/towns - Tier 1: 7mi, Tier 2: 10mi, Tier 3: 15mi
  };
  return radii[marketType][tier - 1];
}

/**
 * Map internal property type to Realie.ai format
 *
 * Realie API only supports: "any", "condo", "house"
 * - Single Family → "house"
 * - Condo → "condo"
 * - Townhouse → "any" (no specific type, will get generic comps)
 * - Multi-Family → "any" (no specific type, will get generic comps)
 */
function mapPropertyType(
  propertyType: string
): "house" | "condo" | "any" {
  if (propertyType === "Single Family") return "house";
  if (propertyType === "SFR") return "house"; // Legacy backward compatibility
  if (propertyType === "Condo") return "condo";
  if (propertyType === "Townhouse") return "any"; // Generic - no townhouse type available
  if (propertyType === "Multi-Family") return "any"; // Generic - no multi-family type available
  return "any"; // Default to generic for unknown types
}

/**
 * Calculate time frame in months based on tier
 */
function getTimeFrameForTier(tier: 1 | 2 | 3): number {
  // Tier 1: 6 months, Tier 2 & 3: 12 months
  return tier === 1 ? 6 : 12;
}

/**
 * Execute 3-tier comp search strategy
 * Note: We pay per API request, not per comp, so we always use maxResults=50
 */
export async function searchComparables(
  formData: UnderwritingFormData,
  options: {
    maxTier?: 1 | 2 | 3;
    marketType?: MarketType;
  } = {}
): Promise<{
  comps: NormalizedComparable[];
  tier: 1 | 2 | 3;
  searchRadius: number;
}> {
  const { maxTier = 1, marketType = "Urban" } = options;

  // Require coordinates
  if (!formData.propertyLatitude || !formData.propertyLongitude) {
    throw new Error("Property coordinates are required for comp search");
  }

  const client = getRealieClient();

  // Tier 1: Tight search (exact bed match, ±20% sqft, 6 months)
  const tier1Radius = getRadiusForMarketAndTier(marketType, 1);
  const tier1Params: RealieCompSearchParams = {
    latitude: formData.propertyLatitude,
    longitude: formData.propertyLongitude,
    radius: tier1Radius,
    timeFrame: 6, // 6 months for tight criteria
    bedsMin: formData.bedrooms,
    bedsMax: formData.bedrooms, // Exact bedroom match
    sqftMin: Math.floor(formData.squareFeet * 0.8), // ±20% sqft range
    sqftMax: Math.ceil(formData.squareFeet * 1.2),
    propertyType: mapPropertyType(formData.propertyType),
    maxResults: 50, // Get maximum comps per request (we pay per request, not per comp)
  };

  console.log(
    `[Realie] Starting Tier 1 comp search (${tier1Radius}mi, tight criteria)...`
  );
  const tier1Result = await client.searchComparables(tier1Params);
  const tier1Comps = normalizeComparables(tier1Result.comparables, formData.propertyAddress);

  console.log(`[Realie] Tier 1 found ${tier1Comps.length} comps`);

  // Return tier 1 results if maxTier is 1
  if (maxTier < 2) {
    return { comps: tier1Comps, tier: 1, searchRadius: tier1Radius };
  }

  // Only escalate to tier 2 if tier 1 returned zero results
  if (tier1Comps.length > 0) {
    return { comps: tier1Comps, tier: 1, searchRadius: tier1Radius };
  }

  // Tier 2: Moderate search (only if tier 1 returned nothing)
  const tier2Radius = getRadiusForMarketAndTier(marketType, 2);
  const tier2Params: RealieCompSearchParams = {
    ...tier1Params,
    radius: tier2Radius,
    timeFrame: getTimeFrameForTier(2),
    bedsMin: formData.bedrooms - 1,
    bedsMax: formData.bedrooms + 1,
    sqftMin: Math.floor(formData.squareFeet * 0.8),
    sqftMax: Math.ceil(formData.squareFeet * 1.2),
    maxResults: 50,
  };

  console.log(
    `[Realie] Tier 1 returned 0 comps, expanding to Tier 2 (${tier2Radius}mi)...`
  );
  const tier2Result = await client.searchComparables(tier2Params);
  const tier2Comps = normalizeComparables(tier2Result.comparables, formData.propertyAddress);

  console.log(`[Realie] Tier 2 found ${tier2Comps.length} comps`);

  // Return tier 2 results if maxTier is 2 or if we got results
  if (maxTier < 3 || tier2Comps.length > 0) {
    return { comps: tier2Comps, tier: 2, searchRadius: tier2Radius };
  }

  // Tier 3: Maximum search (only if tier 2 returned nothing)
  const tier3Radius = getRadiusForMarketAndTier(marketType, 3);
  const tier3Params: RealieCompSearchParams = {
    ...tier2Params,
    radius: tier3Radius,
    timeFrame: getTimeFrameForTier(2), // Keep 12 months for tier 3
    bedsMin: formData.bedrooms - 2,
    bedsMax: formData.bedrooms + 2,
    sqftMin: Math.floor(formData.squareFeet * 0.7),
    sqftMax: Math.ceil(formData.squareFeet * 1.3),
    maxResults: 50,
  };

  console.log(
    `[Realie] Tier 2 returned 0 comps, expanding to Tier 3 (${tier3Radius}mi)...`
  );
  const tier3Result = await client.searchComparables(tier3Params);
  const tier3Comps = normalizeComparables(tier3Result.comparables, formData.propertyAddress);

  console.log(`[Realie] Tier 3 found ${tier3Comps.length} comps (maximum reach)`);
  return { comps: tier3Comps, tier: 3, searchRadius: tier3Radius };
}

/**
 * Extract just the street portion from a full address
 * Example: "123 Main St, Nashville, TN 37201" → "123 Main St"
 */
function extractStreetAddress(fullAddress: string): string {
  if (!fullAddress) return "";

  // Split by comma - street is typically the first part
  const parts = fullAddress.split(",");
  return parts[0].trim();
}

/**
 * Normalize address for comparison
 * Removes common variations and standardizes format
 */
function normalizeAddress(address: string | undefined): string {
  if (!address) return "";

  // First extract just the street portion (in case it's a full address)
  const streetOnly = extractStreetAddress(address);

  return (
    streetOnly
      .toLowerCase()
      .trim()
      // Remove unit/apt numbers
      .replace(/\s+(unit|apt|apartment|#)\s*[\w-]+/gi, "")
      // Remove trailing punctuation
      .replace(/[.,;]+$/, "")
      // Standardize directional prefixes/suffixes (N, S, E, W, etc.)
      .replace(/\bnorth\b/gi, "n")
      .replace(/\bsouth\b/gi, "s")
      .replace(/\beast\b/gi, "e")
      .replace(/\bwest\b/gi, "w")
      .replace(/\bnortheast\b/gi, "ne")
      .replace(/\bnorthwest\b/gi, "nw")
      .replace(/\bsoutheast\b/gi, "se")
      .replace(/\bsouthwest\b/gi, "sw")
      // Standardize street abbreviations
      .replace(/\bstreet\b/gi, "st")
      .replace(/\bdrive\b/gi, "dr")
      .replace(/\bavenue\b/gi, "ave")
      .replace(/\broad\b/gi, "rd")
      .replace(/\bcourt\b/gi, "ct")
      .replace(/\blane\b/gi, "ln")
      .replace(/\bcircle\b/gi, "cir")
      .replace(/\bboulevard\b/gi, "blvd")
      .replace(/\bparkway\b/gi, "pkwy")
      .replace(/\bplace\b/gi, "pl")
      .replace(/\bterrace\b/gi, "ter")
      .replace(/\bhighway\b/gi, "hwy")
      // Remove periods from abbreviations (e.g., "St." → "St")
      .replace(/\./g, "")
      // Remove extra whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Check if a property is the subject property
 * Uses address matching only
 */
function isSubjectProperty(comp: any, subjectAddress: string): boolean {
  // Prefer address field over addressFull (address = street only, addressFull = full address)
  const rawAddress = comp.address || comp.addressFull;
  const normalizedComp = normalizeAddress(rawAddress);
  const normalizedSubject = normalizeAddress(subjectAddress);

  console.log(
    `[Realie] Comparing:\n  Raw Comp: "${rawAddress}"\n  Normalized Comp: "${normalizedComp}"\n  Raw Subject: "${subjectAddress}"\n  Normalized Subject: "${normalizedSubject}"`,
  );

  // Exact match after normalization
  if (normalizedComp === normalizedSubject) {
    console.log(
      `[Realie] ✅ MATCH - Filtering out subject property: ${rawAddress}`,
    );
    return true;
  }

  return false;
}

/**
 * Generate Google search URL for a property address
 * @param comp - Raw Realie comparable data
 * @returns Google search URL or empty string if no address available
 */
function generateGoogleSearchUrl(comp: any): string {
  // Use addressFull (e.g., "4017 IVY DR, NASHVILLE, TN 37216")
  // This is the most complete address field from Realie API
  const address = comp.addressFull ||
    // Fallback: construct from individual parts if addressFull is missing
    [comp.address, comp.city, comp.state, comp.zipCode]
      .filter(Boolean)
      .join(', ');

  if (!address) {
    return ''; // No valid address data
  }

  // URL encode and create Google search link
  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/search?q=${encodedAddress}`;
}

/**
 * Format YYYYMMDD date string to readable format
 * @param dateString - Date in YYYYMMDD format (e.g., "20251003")
 * @returns Formatted date string (e.g., "Oct 3, 2025") or undefined if invalid
 */
function formatTransferDate(dateString: string | undefined): string | undefined {
  if (!dateString || dateString.length !== 8) {
    return undefined;
  }

  try {
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);

    const date = new Date(`${year}-${month}-${day}`);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return undefined;
    }

    // Format as "Oct 3, 2025"
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return undefined;
  }
}

/**
 * Normalize Realie.ai comps to internal format
 * Filters out the subject property to prevent self-comparison
 */
function normalizeComparables(
  comps: any[],
  subjectAddress?: string,
): NormalizedComparable[] {
  // Log first comp to see the raw data structure
  if (comps.length > 0) {
    console.log(`[Realie] Sample raw comp data:`, JSON.stringify(comps[0], null, 2));
  }

  console.log(`[Realie] Subject address for filtering: "${subjectAddress}"`);
  console.log(`[Realie] Total comps before filtering: ${comps.length}`);

  const filtered = comps
    // Filter out subject property FIRST
    .filter((comp) => {
      if (subjectAddress) {
        const isSubject = isSubjectProperty(comp, subjectAddress);
        if (isSubject) {
          console.log(`[Realie] 🚫 Excluding subject property from comps`);
        }
        return !isSubject;
      }
      return true;
    })
    .filter((comp) => comp.transferPrice && comp.transferPrice > 0); // Only include properties with sale data

  console.log(`[Realie] Comps after subject filter: ${filtered.length}`);

  return filtered.map((comp) => {
    // Realie API field mapping:
    // - transferPrice = sale price
    // - buildingArea = square footage
    // - totalBedrooms = bedrooms
    // - totalBathrooms = bathrooms
    // - addressFull = full address
    // - transferDate = sale date (YYYYMMDD format)

    const price = comp.transferPrice || 0;
    const sqft = comp.buildingArea || 0;

    return {
      address: comp.addressFull || comp.address,
      price,
      sqft,
      bedrooms: comp.totalBedrooms || 0, // Default to 0 instead of undefined
      bathrooms: comp.totalBathrooms || 0, // Default to 0 instead of undefined
      yearBuilt: comp.yearBuilt,
      distance: comp.distance
        ? `${comp.distance.toFixed(1)} miles`
        : undefined,
      soldDate: formatTransferDate(comp.transferDate), // Format YYYYMMDD to readable date
      pricePerSqft: sqft > 0 ? price / sqft : undefined,
      listingUrl: generateGoogleSearchUrl(comp),
    };
  });
}

/**
 * Calculate ARV using percentile-based approach (preserved from BatchData)
 */
export function calculateARV(
  comps: NormalizedComparable[],
  rehabBudget: number,
  squareFeet: number
): number {
  if (comps.length === 0) return 0;

  // Calculate renovation intensity ($/sqft)
  const renovationPerSf = squareFeet > 0 ? rehabBudget / squareFeet : 0;

  // Determine percentile based on renovation level (preserved from BatchData)
  let percentile: number;
  if (renovationPerSf <= 30) {
    percentile = 50; // Light rehab: median
  } else if (renovationPerSf <= 50) {
    percentile = 65; // Medium rehab: 65th percentile
  } else {
    percentile = 80; // Heavy rehab: 80th percentile
  }

  // Calculate ARV using percentile
  const prices = comps.map((c) => c.price).sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * prices.length) - 1;
  return prices[Math.max(0, index)];
}
