/**
 * Comparable Sales Search Engine
 * Implements 3-tier search strategy to find best comps
 */

import { getBatchDataClient } from "./client";
import { BatchDataPropertyResponse, PropertySearchCriteria, CompFilterConfig } from "./types";
import {
  getCachedComps,
  cacheComps,
  generateSearchHash,
  trackAPIUsage,
} from "./cache";
import { filterComparables } from "./filters";
import { MarketType } from "@/types/underwriting";

interface CompSearchOptions {
  subjectProperty: BatchDataPropertyResponse;
  minComps?: number; // Default 3
  maxTier?: 1 | 2 | 3; // Max tier to attempt
  marketType?: MarketType; // Primary/Secondary/Tertiary for market-aware distances
  userPropertyData?: {
    // User-provided values override BatchData lookup
    bedrooms?: number;
    bathrooms?: number;
    yearBuilt?: number;
    squareFeet?: number;
  };
}

export interface CompSearchResult {
  allComps: any[]; // ALL comps (including flagged)
  comps: any[]; // Clean comps used for calculations (backward compat)
  flaggedComps: any[]; // Outliers, renovated, etc. (display separately)
  tier: 1 | 2 | 3;
  searchRadius: number; // miles
  compDerivedValue: number; // Calculated from clean comps only
  medianPricePerSqft: number; // Calculated from clean comps only
  cached: boolean;

  // NEW: Flagging metadata
  flaggingApplied: boolean;
  flagSummary?: {
    totalFlagged: number;
    flagReasons: { [key: string]: number };
  };
  pricePerSqftStats?: {
    meanPricePerSqft: number; // Stats from clean comps only
    medianPricePerSqft: number;
    stdDevPricePerSqft: number;
  };
}

/**
 * Execute 3-tier comp search strategy with market-aware distance scaling
 *
 * Distance tiers by market type:
 * - Primary (urban/dense):    Tier 1: 1mi,  Tier 2: 3mi,  Tier 3: 5mi
 * - Secondary (suburban):     Tier 1: 2mi,  Tier 2: 5mi,  Tier 3: 8mi
 * - Tertiary (rural):         Tier 1: 5mi,  Tier 2: 10mi, Tier 3: 15mi
 *
 * Tier 1 (strictest):
 * - Bed/Bath: Exact match (0 variance)
 * - Square Feet: ±10%
 * - Year Built: ±10 years
 *
 * Tier 2 & 3 (relaxed):
 * - Bed/Bath: ±1 variance (never more than ±1)
 * - Square Feet: ±20%
 * - Year Built: No constraint
 */
export async function searchComparables(
  options: CompSearchOptions
): Promise<CompSearchResult> {
  const { subjectProperty, minComps = 5, maxTier = 3, marketType = "Primary", userPropertyData } = options;
  const client = getBatchDataClient();

  // Tier 1: Tight search
  const tier1Radius = getRadiusForMarketAndTier(marketType, 1);
  console.log(`Starting Tier 1 comp search (${tier1Radius}mi, tight criteria, ${marketType} market)...`);
  const tier1Start = Date.now();
  let tier1Result = await searchTier(client, subjectProperty, 1, marketType, userPropertyData);
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

  // Tier 2: Moderate search
  const tier2Radius = getRadiusForMarketAndTier(marketType, 2);
  console.log(
    `Tier 1 found only ${tier1Result.comps.length} comps, expanding to Tier 2 (${tier2Radius}mi)...`
  );
  const tier2Start = Date.now();
  let tier2Result = await searchTier(client, subjectProperty, 2, marketType, userPropertyData);
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
  const tier3Radius = getRadiusForMarketAndTier(marketType, 3);
  console.log(
    `Tier 2 found only ${tier2Result.comps.length} comps, expanding to Tier 3 (${tier3Radius}mi)...`
  );
  const tier3Start = Date.now();
  let tier3Result = await searchTier(client, subjectProperty, 3, marketType, userPropertyData);
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
  marketType: MarketType,
  userPropertyData?: {
    bedrooms?: number;
    bathrooms?: number;
    yearBuilt?: number;
    squareFeet?: number;
  }
): Promise<CompSearchResult> {
  const options = buildCompSearchOptions(subject, tier, marketType, userPropertyData);
  const searchHash = generateSearchHash(options);

  // Use user-provided sqft if available
  const effectiveSqft = userPropertyData?.squareFeet ?? subject.squareFeet;

  // Check cache
  const cached = getCachedComps(searchHash);
  if (cached) {
    console.log(`Using cached comp results for tier ${tier}`);

    // Apply filtering to cached results
    const filterResult = filterComparables(
      subject,
      cached.properties,
      effectiveSqft,
      getFilterConfigForTier(tier)
    );

    return {
      allComps: filterResult.allComps,
      comps: filterResult.usedForCalculation,
      flaggedComps: filterResult.flaggedComps,
      tier,
      searchRadius: getRadiusForMarketAndTier(marketType, tier),
      compDerivedValue: calculateCompDerivedValue(
        filterResult.usedForCalculation,
        effectiveSqft
      ),
      medianPricePerSqft: calculateMedianPricePerSqft(
        filterResult.usedForCalculation
      ),
      cached: true,
      flaggingApplied: true,
      flagSummary: filterResult.flagSummary,
      pricePerSqftStats: filterResult.statistics,
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

  // Cache BEFORE filtering (preserve raw data)
  cacheComps(subject.address.standardizedAddress, searchHash, tier, response);

  // Apply filtering to fresh results
  const filterResult = filterComparables(
    subject,
    response.properties,
    effectiveSqft,
    getFilterConfigForTier(tier)
  );

  return {
    allComps: filterResult.allComps,
    comps: filterResult.usedForCalculation,
    flaggedComps: filterResult.flaggedComps,
    tier,
    searchRadius: getRadiusForMarketAndTier(marketType, tier),
    compDerivedValue: calculateCompDerivedValue(
      filterResult.usedForCalculation,
      effectiveSqft
    ),
    medianPricePerSqft: calculateMedianPricePerSqft(
      filterResult.usedForCalculation
    ),
    cached: false,
    flaggingApplied: true,
    flagSummary: filterResult.flagSummary,
    pricePerSqftStats: filterResult.statistics,
  };
}

/**
 * Build comparable property search options for each tier
 * Uses relative values as per BatchData documentation
 * Prefers user-provided values over BatchData lookup
 * Applies market-aware distance scaling (Primary/Secondary/Tertiary)
 */
function buildCompSearchOptions(
  subject: BatchDataPropertyResponse,
  tier: 1 | 2 | 3,
  marketType: MarketType,
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
    distanceMiles: getRadiusForMarketAndTier(marketType, tier),
  };

  // Bed/Bath constraints (relative values)
  if (tier === 1) {
    // Tier 1: EXACT match - no variance allowed (tight comps)
    options.minBedrooms = 0;   // Exact match
    options.maxBedrooms = 0;   // Exact match
    options.minBathrooms = 0;  // Exact match
    options.maxBathrooms = 0;  // Exact match
  } else {
    // Tier 2 & 3: ±1 bed/bath variance (never more than 1)
    options.minBedrooms = -1;  // Subject bedrooms - 1
    options.maxBedrooms = 1;   // Subject bedrooms + 1
    options.minBathrooms = -1; // Subject bathrooms - 1
    options.maxBathrooms = 1;  // Subject bathrooms + 1
  }

  // Square footage constraints (percentage values)
  if (tier === 1) {
    // Tier 1: Tight sqft matching (±10%)
    options.minAreaPercent = -10; // 90% of subject sqft
    options.maxAreaPercent = 10;  // 110% of subject sqft
  } else {
    // Tier 2 & 3: Moderate sqft matching (±20%)
    options.minAreaPercent = -20; // 80% of subject sqft
    options.maxAreaPercent = 20;  // 120% of subject sqft
  }

  // Year built (Tier 1 only - relative values)
  if (tier === 1 && yearBuilt) {
    options.minYearBuilt = -10; // Subject year - 10
    options.maxYearBuilt = 10;  // Subject year + 10
  }

  return options;
}

/**
 * Get search radius based on market type and tier
 * Market-aware distance scaling ensures appropriate comp density:
 * - Primary (urban/dense): Tight radii (1/3/5mi) - same neighborhood focus
 * - Secondary (suburban): Moderate radii (2/5/8mi) - broader suburban areas
 * - Tertiary (rural): Wide radii (5/10/15mi) - rural areas need larger search
 */
function getRadiusForMarketAndTier(marketType: MarketType, tier: 1 | 2 | 3): number {
  const radiusMap: Record<MarketType, [number, number, number]> = {
    Primary: [1, 3, 5],
    Secondary: [2, 5, 8],
    Tertiary: [5, 10, 15],
  };

  const radii = radiusMap[marketType] || radiusMap.Primary; // Fallback to Primary
  return radii[tier - 1]; // tier is 1-indexed, array is 0-indexed
}

/**
 * Get filter configuration based on tier
 * Tier 1: Strict filtering (tight comps)
 * Tier 2: Moderate filtering (expanded search)
 * Tier 3: Relaxed filtering (maximum reach - we need comps!)
 *
 * Note: Uses IQR method for outlier detection (robust, not affected by extremes)
 */
function getFilterConfigForTier(tier: 1 | 2 | 3): Partial<CompFilterConfig> {
  if (tier === 1) {
    return {
      strictPropertyType: true,
      removeOutliers: true,
      outlierStdDevThreshold: 2.0, // Deprecated (IQR method used instead)
      pricePerSqftFilter: true,
      pricePerSqftTolerancePercent: 30, // ±30%
      excludeForeclosures: true,
      detectRenovations: false,
    };
  } else if (tier === 2) {
    return {
      strictPropertyType: true,
      removeOutliers: true,
      outlierStdDevThreshold: 2.5, // Deprecated (IQR method used instead)
      pricePerSqftFilter: true,
      pricePerSqftTolerancePercent: 40, // ±40%
      excludeForeclosures: true,
      detectRenovations: false,
    };
  } else {
    // Tier 3: Minimal filtering (we need comps!)
    return {
      strictPropertyType: false, // Allow different property types
      removeOutliers: true,
      outlierStdDevThreshold: 3.0, // Deprecated (IQR method used instead)
      pricePerSqftFilter: false, // Don't filter by price
      excludeForeclosures: true,
      detectRenovations: false,
    };
  }
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
