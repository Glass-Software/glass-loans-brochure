import { getRentCastClient } from "./client";
import { RentCastSearchParams, NormalizedComparable } from "./types";
import { MarketType, UnderwritingFormData } from "@/types/underwriting";

/**
 * Get search radius based on market type and tier
 * Tier 1: Tight radius for best quality comps
 * Tier 2: Moderate radius expansion
 * Tier 3: Maximum radius for data-sparse markets
 */
export function getRadiusForMarketAndTier(
  marketType: MarketType,
  tier: 1 | 2 | 3,
): number {
  const radii = {
    Urban: [1, 2, 3], // Dense metro areas
    Suburban: [2, 3, 4], // Mid-size cities
    Rural: [2, 3, 4], // Small markets/towns
  };
  return radii[marketType][tier - 1];
}

/**
 * Map internal property type to RentCast format
 * RentCast property types (CASE SENSITIVE):
 * - "Single Family"
 * - "Condo"
 * - "Townhouse"
 * - "Multi-Family"
 */
export function mapPropertyType(propertyType: string): string | undefined {
  // If already in RentCast format, return as-is
  const rentCastTypes = ["Single Family", "Condo", "Townhouse", "Multi-Family"];
  if (rentCastTypes.includes(propertyType)) {
    return propertyType;
  }

  // Legacy mapping for backward compatibility (old submissions)
  const legacyMapping: Record<string, string> = {
    SFR: "Single Family",
    Condo: "Condo",
    Townhouse: "Townhouse",
    "Multi-Family": "Multi-Family",
  };
  return legacyMapping[propertyType];
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
 * Check if two properties are the same based on address
 */
function isSamePropertyByAddress(prop: any, subjectAddress: string): boolean {
  // Prefer addressLine1 (street only) over formattedAddress (full address)
  const rawAddress = prop.addressLine1 || prop.formattedAddress;
  const propAddress = normalizeAddress(rawAddress);
  const subject = normalizeAddress(subjectAddress);

  if (!propAddress || !subject) return false;

  // Exact match after normalization
  return propAddress === subject;
}

/**
 * Check if a property is the subject property
 * Uses address matching only
 */
function isSubjectProperty(prop: any, subjectAddress: string): boolean {
  // Prefer addressLine1 (street only) over formattedAddress (full address)
  const rawAddress = prop.addressLine1 || prop.formattedAddress;
  const normalizedProp = normalizeAddress(rawAddress);
  const normalizedSubject = normalizeAddress(subjectAddress);

  console.log(
    `[RentCast] Comparing:\n  Raw Prop: "${rawAddress}"\n  Normalized Prop: "${normalizedProp}"\n  Raw Subject: "${subjectAddress}"\n  Normalized Subject: "${normalizedSubject}"`,
  );

  // Filter by address matching only
  if (isSamePropertyByAddress(prop, subjectAddress)) {
    console.log(
      `[RentCast] ✅ MATCH - Filtering out subject property: ${rawAddress}`,
    );
    return true;
  }

  return false;
}

/**
 * Calculate distance between two lat/lng points in miles
 * Using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Execute 3-tier comp search strategy
 * Note: RentCast charges per API request (not per result), limit set to 50 for optimal data quality
 */
export async function searchComparables(
  formData: UnderwritingFormData,
  options: {
    maxTier?: 1 | 2 | 3;
    marketType?: MarketType;
  } = {},
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

  const client = getRentCastClient();

  // Tier 1: Tight search (±1 bed, ±20% sqft, 12 months = 365 days)
  const tier1Radius = getRadiusForMarketAndTier(marketType, 1);
  const tier1SqftMin = Math.floor(formData.squareFeet * 0.8);
  const tier1SqftMax = Math.ceil(formData.squareFeet * 1.2);

  const tier1Params: RentCastSearchParams = {
    latitude: formData.propertyLatitude,
    longitude: formData.propertyLongitude,
    radius: tier1Radius,
    propertyType: mapPropertyType(formData.propertyType),
    bedrooms: `${formData.bedrooms - 1}:${formData.bedrooms + 1}`, // ±1 bedroom
    squareFootage: `${tier1SqftMin}:${tier1SqftMax}`, // ±20% sqft range
    yearBuilt: formData.yearBuilt
      ? `${formData.yearBuilt - 10}:${formData.yearBuilt + 10}`
      : undefined, // ±10 years
    saleDateRange: `*:365`, // Properties sold within last 365 days (12 months)
    limit: 50,
  };

  console.log(
    `[RentCast] Starting Tier 1 comp search (${tier1Radius}mi, tight criteria)...`,
  );
  const yearBuiltRange = formData.yearBuilt
    ? `, built ${formData.yearBuilt - 10}-${formData.yearBuilt + 10}`
    : "";
  console.log(
    `[RentCast] Tier 1 filters: ${formData.bedrooms - 1}-${formData.bedrooms + 1} beds, ${tier1SqftMin}-${tier1SqftMax} sqft${yearBuiltRange}, sold within 365 days`,
  );

  const tier1Result = await client.searchProperties(tier1Params);

  const tier1Comps = normalizeComparables(
    tier1Result.properties,
    formData.propertyLatitude,
    formData.propertyLongitude,
    formData.propertyAddress,
  );

  console.log(`[RentCast] Tier 1 found ${tier1Comps.length} comps`);

  // Return tier 1 results if maxTier is 1
  if (maxTier < 2) {
    return { comps: tier1Comps, tier: 1, searchRadius: tier1Radius };
  }

  // Only escalate to tier 2 if tier 1 returned fewer than 20 comps
  if (tier1Comps.length >= 20) {
    return { comps: tier1Comps, tier: 1, searchRadius: tier1Radius };
  }

  console.log(
    `[RentCast] Tier 1 returned only ${tier1Comps.length} comps (need 20+), escalating to Tier 2...`,
  );

  // Tier 2: Moderate search (±1 bed, ±20% sqft, 12 months = 365 days)
  const tier2Radius = getRadiusForMarketAndTier(marketType, 2);
  const tier2SqftMin = Math.floor(formData.squareFeet * 0.8);
  const tier2SqftMax = Math.ceil(formData.squareFeet * 1.2);

  const tier2Params: RentCastSearchParams = {
    latitude: formData.propertyLatitude,
    longitude: formData.propertyLongitude,
    radius: tier2Radius,
    propertyType: mapPropertyType(formData.propertyType),
    bedrooms: `${formData.bedrooms - 1}:${formData.bedrooms + 1}`, // ±1 bedroom
    squareFootage: `${tier2SqftMin}:${tier2SqftMax}`, // ±20% sqft range
    yearBuilt: formData.yearBuilt
      ? `${formData.yearBuilt - 10}:${formData.yearBuilt + 10}`
      : undefined, // ±10 years
    saleDateRange: `*:365`, // Properties sold within last 365 days (12 months)
    limit: 50,
  };

  console.log(
    `[RentCast] Tier 2 filters: ${formData.bedrooms - 1}-${formData.bedrooms + 1} beds, ${tier2SqftMin}-${tier2SqftMax} sqft${yearBuiltRange}, sold within 365 days`,
  );

  const tier2Result = await client.searchProperties(tier2Params);

  const tier2Comps = normalizeComparables(
    tier2Result.properties,
    formData.propertyLatitude,
    formData.propertyLongitude,
    formData.propertyAddress,
  );

  console.log(`[RentCast] Tier 2 found ${tier2Comps.length} comps`);

  // Return tier 2 results if maxTier is 2
  if (maxTier < 3) {
    return { comps: tier2Comps, tier: 2, searchRadius: tier2Radius };
  }

  // Only escalate to tier 3 if tier 2 returned fewer than 20 comps
  if (tier2Comps.length >= 20) {
    return { comps: tier2Comps, tier: 2, searchRadius: tier2Radius };
  }

  console.log(
    `[RentCast] Tier 2 returned only ${tier2Comps.length} comps (need 20+), escalating to Tier 3...`,
  );

  // Tier 3: Maximum search (±2 beds, ±30% sqft, 12 months = 365 days)
  const tier3Radius = getRadiusForMarketAndTier(marketType, 3);
  const tier3SqftMin = Math.floor(formData.squareFeet * 0.7);
  const tier3SqftMax = Math.ceil(formData.squareFeet * 1.3);

  const tier3Params: RentCastSearchParams = {
    latitude: formData.propertyLatitude,
    longitude: formData.propertyLongitude,
    radius: tier3Radius,
    propertyType: mapPropertyType(formData.propertyType),
    bedrooms: `${formData.bedrooms - 2}:${formData.bedrooms + 2}`, // ±2 bedrooms
    squareFootage: `${tier3SqftMin}:${tier3SqftMax}`, // ±30% sqft range
    yearBuilt: formData.yearBuilt
      ? `${formData.yearBuilt - 10}:${formData.yearBuilt + 10}`
      : undefined, // ±10 years
    saleDateRange: `*:365`, // Properties sold within last 365 days (12 months)
    limit: 50,
  };

  console.log(
    `[RentCast] Tier 3 filters: ${formData.bedrooms - 2}-${formData.bedrooms + 2} beds, ${tier3SqftMin}-${tier3SqftMax} sqft${yearBuiltRange}, sold within 365 days`,
  );

  const tier3Result = await client.searchProperties(tier3Params);

  const tier3Comps = normalizeComparables(
    tier3Result.properties,
    formData.propertyLatitude,
    formData.propertyLongitude,
    formData.propertyAddress,
  );

  console.log(
    `[RentCast] Tier 3 found ${tier3Comps.length} comps (maximum reach)`,
  );
  return { comps: tier3Comps, tier: 3, searchRadius: tier3Radius };
}

/**
 * Generate Google search URL for a property address
 */
function generateGoogleSearchUrl(prop: any): string {
  const address =
    prop.formattedAddress ||
    [prop.addressLine1, prop.city, prop.state, prop.zipCode]
      .filter(Boolean)
      .join(", ");

  if (!address) {
    return "";
  }

  const encodedAddress = encodeURIComponent(address);
  return `https://www.google.com/search?q=${encodedAddress}`;
}

/**
 * Format ISO date string to readable format
 */
function formatSaleDate(dateString: string | undefined): string | undefined {
  if (!dateString) return undefined;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return undefined;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return undefined;
  }
}

/**
 * Normalize RentCast properties to internal format
 * Filters out the subject property to prevent self-comparison
 */
function normalizeComparables(
  properties: any[],
  subjectLat: number,
  subjectLon: number,
  subjectAddress?: string,
): NormalizedComparable[] {
  // Log first property to see the raw data structure
  if (properties.length > 0) {
    console.log(
      `[RentCast] Sample raw property data:`,
      JSON.stringify(properties[0], null, 2),
    );
  }

  console.log(`[RentCast] Subject address for filtering: "${subjectAddress}"`);
  console.log(
    `[RentCast] Total properties before filtering: ${properties.length}`,
  );

  const filtered = properties
    // Filter out subject property FIRST
    .filter((prop) => {
      if (subjectAddress) {
        const isSubject = isSubjectProperty(prop, subjectAddress);
        if (isSubject) {
          console.log(`[RentCast] 🚫 Excluding subject property from comps`);
        }
        return !isSubject;
      }
      return true;
    })
    .filter((prop) => prop.lastSalePrice && prop.lastSalePrice > 0); // Only include properties with sale data

  console.log(`[RentCast] Properties after subject filter: ${filtered.length}`);

  return filtered.map((prop) => {
    const price = prop.lastSalePrice || 0;
    const sqft = prop.squareFootage || 0;

    // Calculate distance from subject property
    const distance =
      prop.latitude && prop.longitude
        ? calculateDistance(
            subjectLat,
            subjectLon,
            prop.latitude,
            prop.longitude,
          )
        : undefined;

    return {
      address: prop.formattedAddress || prop.addressLine1 || "Unknown Address",
      price,
      sqft,
      bedrooms: prop.bedrooms || 0,
      bathrooms: prop.bathrooms || 0,
      yearBuilt: prop.yearBuilt,
      distance: distance ? `${distance.toFixed(1)} miles` : undefined,
      soldDate: formatSaleDate(prop.lastSaleDate),
      pricePerSqft: sqft > 0 ? price / sqft : undefined,
      listingUrl: generateGoogleSearchUrl(prop),
      latitude: prop.latitude, // Include for map display
      longitude: prop.longitude, // Include for map display
    };
  });
}

/**
 * Calculate ARV using percentile-based approach (preserved from BatchData)
 */
export function calculateARV(
  comps: NormalizedComparable[],
  rehabBudget: number,
  squareFeet: number,
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
