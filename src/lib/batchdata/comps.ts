/**
 * Comparable Sales Search Engine
 * Implements 3-tier search strategy to find best comps
 */

import { getBatchDataClient } from "./client";
import { BatchDataPropertyResponse, PropertySearchCriteria } from "./types";
import {
  getCachedComps,
  cacheComps,
  generateSearchHash,
  trackAPIUsage,
} from "./cache";

interface CompSearchOptions {
  subjectProperty: BatchDataPropertyResponse;
  minComps?: number; // Default 3
  maxTier?: 1 | 2 | 3; // Max tier to attempt
  userPropertyData?: {
    // User-provided values override BatchData lookup
    bedrooms?: number;
    bathrooms?: number;
    yearBuilt?: number;
    squareFeet?: number;
  };
}

export interface CompSearchResult {
  comps: any[];
  tier: 1 | 2 | 3;
  searchRadius: number; // miles
  compDerivedValue: number;
  medianPricePerSqft: number;
  cached: boolean;
}

/**
 * Execute 3-tier comp search strategy
 * Tier 1: Wide (5mi, ±1 bed/bath, ±20% sqft, 6mo)
 * Tier 2: Wider (10mi, ±30% sqft, 12mo)
 * Tier 3: Maximum (15mi, ±2 bed/bath, 18mo)
 */
export async function searchComparables(
  options: CompSearchOptions
): Promise<CompSearchResult> {
  const { subjectProperty, minComps = 3, maxTier = 3, userPropertyData } = options;
  const client = getBatchDataClient();

  // Tier 1: Wide search
  console.log("Starting Tier 1 comp search (5mi, tight criteria)...");
  const tier1Start = Date.now();
  let tier1Result = await searchTier(client, subjectProperty, 1, userPropertyData);
  trackAPIUsage(
    "/property/search",
    true,
    tier1Result.cached,
    Date.now() - tier1Start
  );

  if (tier1Result.comps.length >= minComps) {
    console.log(`Tier 1 found ${tier1Result.comps.length} comps - using these`);
    return tier1Result;
  }

  if (maxTier < 2) return tier1Result;

  // Tier 2: Wider search
  console.log(
    `Tier 1 found only ${tier1Result.comps.length} comps, expanding to Tier 2...`
  );
  const tier2Start = Date.now();
  let tier2Result = await searchTier(client, subjectProperty, 2, userPropertyData);
  trackAPIUsage(
    "/property/search",
    true,
    tier2Result.cached,
    Date.now() - tier2Start
  );

  if (tier2Result.comps.length >= minComps) {
    console.log(`Tier 2 found ${tier2Result.comps.length} comps - using these`);
    return tier2Result;
  }

  if (maxTier < 3) return tier2Result;

  // Tier 3: Maximum search
  console.log(
    `Tier 2 found only ${tier2Result.comps.length} comps, expanding to Tier 3...`
  );
  const tier3Start = Date.now();
  let tier3Result = await searchTier(client, subjectProperty, 3, userPropertyData);
  trackAPIUsage(
    "/property/search",
    true,
    tier3Result.cached,
    Date.now() - tier3Start
  );

  console.log(`Tier 3 found ${tier3Result.comps.length} comps (maximum reach)`);
  return tier3Result;
}

/**
 * Execute single tier search using Property Search API with compAddress
 */
async function searchTier(
  client: any,
  subject: BatchDataPropertyResponse,
  tier: 1 | 2 | 3,
  userPropertyData?: {
    bedrooms?: number;
    bathrooms?: number;
    yearBuilt?: number;
    squareFeet?: number;
  }
): Promise<CompSearchResult> {
  const options = buildCompSearchOptions(subject, tier, userPropertyData);
  const searchHash = generateSearchHash(options);

  // Use user-provided sqft if available
  const effectiveSqft = userPropertyData?.squareFeet ?? subject.squareFeet;

  // Check cache
  const cached = getCachedComps(searchHash);
  if (cached) {
    console.log(`Using cached comp results for tier ${tier}`);
    return {
      comps: cached.properties,
      tier,
      searchRadius: getRadiusForTier(tier),
      compDerivedValue: calculateCompDerivedValue(
        cached.properties,
        effectiveSqft
      ),
      medianPricePerSqft: calculateMedianPricePerSqft(cached.properties),
      cached: true,
    };
  }

  // Execute search using Property Search API with compAddress
  const subjectAddress = {
    street: subject.address.streetNumber + " " + subject.address.streetName,
    city: subject.address.city,
    state: subject.address.state,
    zip: subject.address.zipCode,
  };

  const response = await client.getComparableProperties(subjectAddress, options);

  // Cache result
  cacheComps(subject.address.standardizedAddress, searchHash, tier, response);

  return {
    comps: response.properties,
    tier,
    searchRadius: getRadiusForTier(tier),
    compDerivedValue: calculateCompDerivedValue(response.properties, effectiveSqft),
    medianPricePerSqft: calculateMedianPricePerSqft(response.properties),
    cached: false,
  };
}

/**
 * Build comparable property search options for each tier
 * Uses relative values as per BatchData documentation
 * Prefers user-provided values over BatchData lookup
 */
function buildCompSearchOptions(
  subject: BatchDataPropertyResponse,
  tier: 1 | 2 | 3,
  userPropertyData?: {
    bedrooms?: number;
    bathrooms?: number;
    yearBuilt?: number;
    squareFeet?: number;
  }
): any {
  // Use user-provided values if available, otherwise fall back to BatchData
  const bedrooms = userPropertyData?.bedrooms ?? subject.bedrooms;
  const bathrooms = userPropertyData?.bathrooms ?? subject.bathrooms;
  const yearBuilt = userPropertyData?.yearBuilt ?? subject.yearBuilt;
  const squareFeet = userPropertyData?.squareFeet ?? subject.squareFeet;

  const options: any = {
    distanceMiles: tier === 1 ? 5 : tier === 2 ? 10 : 15,
  };

  // Bed/Bath constraints (relative values)
  if (tier === 1) {
    options.minBedrooms = -1;  // Subject bedrooms - 1
    options.maxBedrooms = 1;   // Subject bedrooms + 1
    options.minBathrooms = -1; // Subject bathrooms - 1
    options.maxBathrooms = 1;  // Subject bathrooms + 1
  } else if (tier === 3) {
    options.minBedrooms = -2;  // Subject bedrooms - 2
    options.maxBedrooms = 2;   // Subject bedrooms + 2
    options.minBathrooms = -2; // Subject bathrooms - 2
    options.maxBathrooms = 2;  // Subject bathrooms + 2
  }
  // Tier 2: No bed/bath constraint

  // Square footage constraints (percentage values)
  if (tier === 1) {
    options.minAreaPercent = -20; // 80% of subject sqft
    options.maxAreaPercent = 20;  // 120% of subject sqft
  } else if (tier === 2) {
    options.minAreaPercent = -30; // 70% of subject sqft
    options.maxAreaPercent = 30;  // 130% of subject sqft
  }
  // Tier 3: No sqft constraint

  // Year built (Tier 1 only - relative values)
  if (tier === 1 && yearBuilt) {
    options.minYearBuilt = -10; // Subject year - 10
    options.maxYearBuilt = 10;  // Subject year + 10
  }

  return options;
}

function getRadiusForTier(tier: 1 | 2 | 3): number {
  return tier === 1 ? 5 : tier === 2 ? 10 : 15;
}

/**
 * Calculate comp-derived value: median $/sqft × subject sqft
 */
function calculateCompDerivedValue(comps: any[], subjectSqft: number): number {
  const medianPricePerSqft = calculateMedianPricePerSqft(comps);
  return Math.round(medianPricePerSqft * subjectSqft);
}

/**
 * Calculate median price per square foot
 */
function calculateMedianPricePerSqft(comps: any[]): number {
  if (!comps || comps.length === 0) return 0;

  const pricesPerSqft = comps
    .filter((c) => c.squareFeet > 0 && c.lastSalePrice > 0)
    .map((c) => c.lastSalePrice / c.squareFeet)
    .sort((a, b) => a - b);

  if (pricesPerSqft.length === 0) return 0;

  const mid = Math.floor(pricesPerSqft.length / 2);
  return pricesPerSqft.length % 2 === 0
    ? (pricesPerSqft[mid - 1] + pricesPerSqft[mid]) / 2
    : pricesPerSqft[mid];
}
