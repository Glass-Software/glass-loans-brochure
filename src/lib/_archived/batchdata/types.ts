/**
 * BatchData API Request/Response Types
 * Based on BatchData API documentation
 */

// Address Input
export interface AddressInput {
  street: string;
  city: string;
  state: string;
  zip: string;
}

// Address Verification
export interface BatchDataAddressResponse {
  standardizedAddress: string;
  streetNumber: string;
  streetName: string;
  city: string;
  state: string;
  zipCode: string;
  zipPlus4: string;
  county: string;
  countyFips: string;
  latitude: number;
  longitude: number;
  validated: boolean;
}

// Property Lookup
export interface BatchDataPropertyResponse {
  address: BatchDataAddressResponse;
  propertyType: string; // "SFR", "Condo", "Townhouse", "Multi-Family"
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  lotSize: number;
  yearBuilt: number;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  taxAssessedValue: number;
  taxAssessmentHistory: TaxAssessment[];
  zoning: string;
  avm?: AVMData; // Optional - may not be available for all properties
  preForeclosure: boolean;
}

export interface TaxAssessment {
  year: number;
  assessedValue: number;
}

export interface AVMData {
  value: number;
  confidenceScore: number; // 0-100
  valuationDate: string;
  lowEstimate: number;
  highEstimate: number;
}

// Property Search
export interface PropertySearchCriteria {
  location: {
    latitude: number;
    longitude: number;
    radius: string; // "0.5", "1", "2"
    radiusUnit: "miles";
  };
  propertyType?: string;
  bedrooms?: { min: number; max: number };
  bathrooms?: { min: number; max: number };
  squareFeet?: { min: number; max: number };
  yearBuilt?: { min: number; max: number };
  lastSaleDate?: { min: string }; // ISO date
  lastSalePrice?: { min: number };
}

export interface BatchDataSearchResponse {
  properties: PropertySearchResult[];
  totalResults: number;
  tier?: 1 | 2 | 3; // Which tier produced these results
}

export interface PropertySearchResult {
  address: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  yearBuilt?: number; // Year built (optional)
  lotSize?: number; // Lot size in square feet (optional)
  lastSaleDate: string;
  lastSalePrice: number;
  distance: number; // miles from subject
  daysOnMarket?: number;

  // NEW: Valuation metrics (optional for backward compatibility)
  avm?: {
    value: number;
    confidenceScore: number;
    valuationDate: string;
  };
  taxAssessedValue?: number;
  preForeclosure?: boolean;

  // NEW: Derived metrics for filtering
  pricePerSqft?: number;
  taxAssessmentRatio?: number; // lastSalePrice / taxAssessedValue

  // NEW: Comp quality flags
  isOutlier?: boolean; // Statistical outlier (outside IQR bounds: Q1 - 1.5×IQR to Q3 + 1.5×IQR)
  isRenovated?: boolean; // Likely renovated (sale price > 1.5x tax assessment)
  outlierReason?: string; // Why this comp is flagged (for display)

  // NEW: Listing URL for hyperlinks
  listingUrl?: string; // URL to property listing for user to view details
}

// ============================================================================
// Comp Filtering Configuration
// ============================================================================

/**
 * Configuration for post-API comp flagging and filtering
 */
export interface CompFilterConfig {
  strictPropertyType?: boolean; // Default: true - Enforce exact property type matching
  removeOutliers?: boolean; // Default: true - Flag outliers using IQR method (but keep for display)
  pricePerSqftFilter?: boolean; // Default: false - DISABLED (counterproductive for rehab projects - comps with higher $/sqft are desirable)
  pricePerSqftTolerancePercent?: number; // Default: 30 - ±30% tolerance
  minAvmConfidence?: number; // Default: 0 - Minimum AVM confidence to include
  excludeForeclosures?: boolean; // Default: true - Exclude foreclosures from calculations
  detectRenovations?: boolean; // Default: false - Flag likely renovated properties
  renovationThreshold?: number; // Default: 1.5 - Sale price > 1.5x tax = renovated
  lotSizeFilter?: boolean; // Default: false - Only enable for Primary/Secondary markets (urban/suburban density matters)
  lotSizeTolerancePercent?: number; // Default: 50 - ±50% tolerance (lot size can vary significantly)
}

/**
 * Result of filtering operation with separated clean and flagged comps
 */
export interface FilteredCompResult {
  allComps: PropertySearchResult[]; // ALL comps (including flagged ones)
  usedForCalculation: PropertySearchResult[]; // Only clean comps used for median
  flaggedComps: PropertySearchResult[]; // Outliers, renovated, etc. (display separately)
  flagSummary: {
    totalFlagged: number;
    flagReasons: { [key: string]: number }; // "outlier": 2, "renovated": 1, etc.
  };
  statistics: {
    meanPricePerSqft: number; // Stats from usedForCalculation only
    medianPricePerSqft: number;
    stdDevPricePerSqft: number;
  };
}
