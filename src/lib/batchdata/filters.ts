/**
 * Post-API Comparable Property Flagging & Filtering
 * Flags outliers, renovated properties, and quality issues while KEEPING all comps for display
 */

import {
  PropertySearchResult,
  CompFilterConfig,
  FilteredCompResult,
  BatchDataPropertyResponse,
} from "./types";

/**
 * Default filter configuration
 */
const DEFAULT_FILTER_CONFIG: CompFilterConfig = {
  strictPropertyType: true,
  removeOutliers: true,
  outlierStdDevThreshold: 2.0,
  pricePerSqftFilter: true,
  pricePerSqftTolerancePercent: 30,
  minAvmConfidence: 0,
  excludeForeclosures: true,
  detectRenovations: false,
  renovationThreshold: 1.5,
};

/**
 * Apply all filters to comparable properties
 * Returns ALL comps but separates them into clean vs flagged
 */
export function filterComparables(
  subjectProperty: BatchDataPropertyResponse,
  rawComps: PropertySearchResult[],
  userSquareFeet?: number,
  config: Partial<CompFilterConfig> = {}
): FilteredCompResult {
  const filterConfig = { ...DEFAULT_FILTER_CONFIG, ...config };
  const flagReasons: { [key: string]: number } = {};

  // Make a copy of comps to avoid mutating the original array
  let comps = rawComps.map((comp) => ({ ...comp }));

  // Step 1: Property type matching (flag mismatches)
  if (filterConfig.strictPropertyType) {
    flagPropertyTypeMismatch(
      subjectProperty.propertyType,
      comps,
      flagReasons
    );
  }

  // Step 2: Flag foreclosures
  if (filterConfig.excludeForeclosures) {
    flagForeclosures(comps, flagReasons);
  }

  // Step 3: Flag comps with missing critical data
  flagMissingData(comps, flagReasons);

  // Step 4: Calculate statistics from comps with valid data
  const validComps = comps.filter(
    (c) => c.squareFeet > 0 && c.lastSalePrice > 0 && c.pricePerSqft && c.pricePerSqft > 0 && !c.isOutlier
  );

  if (validComps.length === 0) {
    // No valid comps - return all as flagged
    return {
      allComps: comps,
      usedForCalculation: [],
      flaggedComps: comps,
      flagSummary: {
        totalFlagged: comps.length,
        flagReasons,
      },
      statistics: {
        meanPricePerSqft: 0,
        medianPricePerSqft: 0,
        stdDevPricePerSqft: 0,
      },
    };
  }

  const statistics = calculatePricePerSqftStats(validComps);

  // Step 5: Flag statistical outliers (but KEEP them)
  if (filterConfig.removeOutliers && validComps.length >= 3) {
    flagOutliers(
      comps,
      statistics.meanPricePerSqft,
      statistics.stdDevPricePerSqft,
      filterConfig.outlierStdDevThreshold!,
      flagReasons
    );
  }

  // Step 6: Flag price per sqft proximity divergence
  if (filterConfig.pricePerSqftFilter && validComps.length >= 3) {
    const effectiveSqft = userSquareFeet || subjectProperty.squareFeet;
    const subjectPricePerSqft = calculateSubjectPricePerSqft(
      subjectProperty,
      effectiveSqft
    );

    if (subjectPricePerSqft > 0) {
      flagPricePerSqftDivergence(
        comps,
        subjectPricePerSqft,
        filterConfig.pricePerSqftTolerancePercent!,
        flagReasons
      );
    }
  }

  // Step 7: Flag likely renovations (optional)
  if (filterConfig.detectRenovations && filterConfig.renovationThreshold) {
    flagRenovations(comps, filterConfig.renovationThreshold, flagReasons);
  }

  // Step 8: Separate clean comps from flagged comps
  const { usedForCalculation, flaggedComps } = separateComps(comps);

  // Recalculate statistics using only clean comps
  const finalStats =
    usedForCalculation.length > 0
      ? calculatePricePerSqftStats(usedForCalculation)
      : statistics;

  return {
    allComps: comps,
    usedForCalculation,
    flaggedComps,
    flagSummary: {
      totalFlagged: flaggedComps.length,
      flagReasons,
    },
    statistics: finalStats,
  };
}

/**
 * Flag property type mismatches
 */
function flagPropertyTypeMismatch(
  subjectType: string,
  comps: PropertySearchResult[],
  flagReasons: { [key: string]: number }
): void {
  const normalizedSubject = normalizePropertyType(subjectType);

  comps.forEach((comp) => {
    const normalizedComp = normalizePropertyType(comp.propertyType);
    if (normalizedSubject !== normalizedComp) {
      comp.isOutlier = true;
      comp.outlierReason = `Property type mismatch (${comp.propertyType} vs ${subjectType})`;
      flagReasons["property_type_mismatch"] =
        (flagReasons["property_type_mismatch"] || 0) + 1;
    }
  });
}

/**
 * Normalize property type strings for consistent comparison
 */
function normalizePropertyType(type: string): string {
  const normalized = type.toLowerCase().trim();

  // Single Family Residential
  if (normalized.includes("single") || normalized.includes("sfr")) {
    return "single_family";
  }
  // Condo/Condominium
  if (normalized.includes("condo")) {
    return "condo";
  }
  // Townhouse/Townhome
  if (normalized.includes("town")) {
    return "townhouse";
  }
  // Multi-Family
  if (normalized.includes("multi")) {
    return "multi_family";
  }

  return normalized;
}

/**
 * Flag foreclosures
 */
function flagForeclosures(
  comps: PropertySearchResult[],
  flagReasons: { [key: string]: number }
): void {
  comps.forEach((comp) => {
    if (comp.preForeclosure) {
      comp.isOutlier = true;
      comp.outlierReason = "Pre-foreclosure (distressed property)";
      flagReasons["foreclosure"] = (flagReasons["foreclosure"] || 0) + 1;
    }
  });
}

/**
 * Flag comps missing critical data
 */
function flagMissingData(
  comps: PropertySearchResult[],
  flagReasons: { [key: string]: number }
): void {
  comps.forEach((comp) => {
    if (
      comp.squareFeet <= 0 ||
      comp.lastSalePrice <= 0 ||
      !comp.pricePerSqft ||
      comp.pricePerSqft <= 0
    ) {
      comp.isOutlier = true;
      comp.outlierReason = "Missing critical data (sqft or sale price)";
      flagReasons["missing_data"] = (flagReasons["missing_data"] || 0) + 1;
    }
  });
}

/**
 * Calculate price per sqft statistics
 */
function calculatePricePerSqftStats(
  comps: PropertySearchResult[]
): {
  meanPricePerSqft: number;
  medianPricePerSqft: number;
  stdDevPricePerSqft: number;
} {
  if (comps.length === 0) {
    return {
      meanPricePerSqft: 0,
      medianPricePerSqft: 0,
      stdDevPricePerSqft: 0,
    };
  }

  const pricesPerSqft = comps
    .filter((c) => c.pricePerSqft && c.pricePerSqft > 0)
    .map((c) => c.pricePerSqft!);

  if (pricesPerSqft.length === 0) {
    return {
      meanPricePerSqft: 0,
      medianPricePerSqft: 0,
      stdDevPricePerSqft: 0,
    };
  }

  // Mean
  const mean =
    pricesPerSqft.reduce((sum, val) => sum + val, 0) / pricesPerSqft.length;

  // Median
  const sorted = [...pricesPerSqft].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  // Standard deviation
  const squaredDiffs = pricesPerSqft.map((val) => Math.pow(val - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / pricesPerSqft.length;
  const stdDev = Math.sqrt(variance);

  return {
    meanPricePerSqft: mean,
    medianPricePerSqft: median,
    stdDevPricePerSqft: stdDev,
  };
}

/**
 * Flag statistical outliers using IQR (Interquartile Range) method
 * IQR is more robust than mean±σ and not affected by extreme outliers
 * IMPORTANT: Flags but doesn't remove - comps stay in array
 */
function flagOutliers(
  comps: PropertySearchResult[],
  mean: number,
  stdDev: number,
  threshold: number, // Unused in IQR, kept for backward compatibility
  flagReasons: { [key: string]: number }
): void {
  // Get all valid price per sqft values
  const pricesPerSqft = comps
    .filter((c) => c.pricePerSqft && c.pricePerSqft > 0 && !c.isOutlier)
    .map((c) => c.pricePerSqft!)
    .sort((a, b) => a - b);

  if (pricesPerSqft.length < 4) return; // Need at least 4 comps for IQR

  // Calculate Q1 (25th percentile) and Q3 (75th percentile)
  const q1Index = Math.floor(pricesPerSqft.length * 0.25);
  const q3Index = Math.floor(pricesPerSqft.length * 0.75);
  const q1 = pricesPerSqft[q1Index];
  const q3 = pricesPerSqft[q3Index];
  const iqr = q3 - q1;

  // Standard IQR outlier boundaries: Q1 - 1.5×IQR and Q3 + 1.5×IQR
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Flag outliers
  comps.forEach((comp) => {
    if (!comp.pricePerSqft || comp.isOutlier) return; // Skip already flagged

    if (comp.pricePerSqft < lowerBound || comp.pricePerSqft > upperBound) {
      const median = pricesPerSqft[Math.floor(pricesPerSqft.length / 2)];
      const percentDiff = ((Math.abs(comp.pricePerSqft - median) / median) * 100).toFixed(0);
      comp.isOutlier = true;
      comp.outlierReason = `Statistical outlier (${percentDiff}% ${comp.pricePerSqft > median ? "above" : "below"} median, outside IQR bounds)`;
      flagReasons["statistical_outlier"] =
        (flagReasons["statistical_outlier"] || 0) + 1;
    }
  });
}

/**
 * Calculate subject property's implied price per sqft
 * Uses AVM or tax assessment as baseline
 */
function calculateSubjectPricePerSqft(
  subject: BatchDataPropertyResponse,
  effectiveSqft: number
): number {
  if (effectiveSqft === 0) return 0;

  // Prefer AVM value if confidence is high
  if (subject.avm.confidenceScore >= 60 && subject.avm.value > 0) {
    return subject.avm.value / effectiveSqft;
  }

  // Fallback to tax assessed value
  if (subject.taxAssessedValue > 0) {
    return subject.taxAssessedValue / effectiveSqft;
  }

  // Last resort: recent sale price
  if (subject.lastSalePrice && subject.lastSalePrice > 0) {
    return subject.lastSalePrice / effectiveSqft;
  }

  return 0;
}

/**
 * Flag comps by price per sqft proximity
 * Flags but doesn't remove
 */
function flagPricePerSqftDivergence(
  comps: PropertySearchResult[],
  targetPricePerSqft: number,
  tolerancePercent: number,
  flagReasons: { [key: string]: number }
): void {
  const lowerBound = targetPricePerSqft * (1 - tolerancePercent / 100);
  const upperBound = targetPricePerSqft * (1 + tolerancePercent / 100);

  comps.forEach((comp) => {
    if (!comp.pricePerSqft || comp.isOutlier) return; // Skip already flagged

    if (comp.pricePerSqft < lowerBound || comp.pricePerSqft > upperBound) {
      const percentDiff = ((Math.abs(comp.pricePerSqft - targetPricePerSqft) / targetPricePerSqft) * 100).toFixed(0);
      comp.isOutlier = true;
      comp.outlierReason = `Price divergence (${percentDiff}% ${comp.pricePerSqft > targetPricePerSqft ? "above" : "below"} subject $/sqft)`;
      flagReasons["price_divergence"] =
        (flagReasons["price_divergence"] || 0) + 1;
    }
  });
}

/**
 * Flag likely renovations (sale price > threshold × tax assessment)
 */
function flagRenovations(
  comps: PropertySearchResult[],
  threshold: number,
  flagReasons: { [key: string]: number }
): void {
  comps.forEach((comp) => {
    if (!comp.taxAssessmentRatio) return;

    if (comp.taxAssessmentRatio > threshold) {
      comp.isRenovated = true;
      comp.outlierReason = comp.outlierReason
        ? `${comp.outlierReason}; Likely renovated (sale ${comp.taxAssessmentRatio.toFixed(1)}x tax assessment)`
        : `Likely renovated (sale ${comp.taxAssessmentRatio.toFixed(1)}x tax assessment)`;
      flagReasons["likely_renovated"] =
        (flagReasons["likely_renovated"] || 0) + 1;
    }
  });
}

/**
 * Separate comps into calculation vs flagged arrays
 * NOTE: ALL comps are included in usedForCalculation (outliers are labeled but not excluded)
 * flaggedComps is a subset for UI display with warnings
 */
function separateComps(comps: PropertySearchResult[]): {
  usedForCalculation: PropertySearchResult[];
  flaggedComps: PropertySearchResult[];
} {
  const flaggedComps: PropertySearchResult[] = [];

  comps.forEach((comp) => {
    if (comp.isOutlier || comp.isRenovated) {
      flaggedComps.push(comp);
    }
  });

  // ALL comps used for calculations (outliers are labeled but not excluded)
  return { usedForCalculation: comps, flaggedComps };
}
