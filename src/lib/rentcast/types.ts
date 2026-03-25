/**
 * RentCast API Types
 * Documentation: https://developers.rentcast.io/reference/search-queries
 *
 * Range Format: Many parameters support range queries using colon separators:
 * - "min:max" - both minimum and maximum values
 * - "*:max" - only maximum (open-ended minimum)
 * - "min:*" - only minimum (open-ended maximum)
 * Example: bedrooms="2:4" matches properties with 2-4 bedrooms
 */

// API Request Parameters for /properties endpoint
export interface RentCastSearchParams {
  // ===== GEOGRAPHIC / LOCATION PARAMETERS =====
  /** Full property address in "Street, City, State, Zip" format (for single property retrieval) */
  address?: string;
  /** City name for bulk searches */
  city?: string;
  /** Two-character state abbreviation */
  state?: string;
  /** Five-digit zip code */
  zipCode?: string;
  /** Center point latitude for circular area search */
  latitude?: number;
  /** Center point longitude for circular area search */
  longitude?: number;
  /** Search radius in miles for geographic area queries */
  radius?: number;

  // ===== PROPERTY CHARACTERISTICS =====
  /** Property type(s). Supports multiple values with pipe separator: "Condo|Townhouse" */
  propertyType?: string;
  /** Bedroom count. Supports range format: "2:4" or multiple values */
  bedrooms?: string;
  /** Bathroom count. Supports range format: "1:3" or multiple values */
  bathrooms?: string;
  /** Square footage. Supports range format: "1000:2000" */
  squareFootage?: string;
  /** Lot size in square feet. Supports range format: "5000:10000" */
  lotSize?: string;
  /** Year built. Supports range format: "2000:*" for properties built in 2000 or later */
  yearBuilt?: string;

  // ===== DATE / TIME PARAMETERS =====
  /**
   * Sale date range in days. Format: "*:270" for properties sold within last 270 days
   * ONLY for /properties endpoint (sold properties)
   */
  saleDateRange?: string;

  /**
   * Listing age in days. Format: "30:90" for listings between 30-90 days old
   * ONLY for /listings endpoints (NOT for sold properties)
   */
  daysOld?: string;

  // ===== PRICE PARAMETERS =====
  /**
   * Price range. Format: "150000:250000" for prices between $150k-$250k
   * ONLY for /listings endpoints
   */
  price?: string;

  // ===== PAGINATION =====
  /** Maximum results per response (max 500) */
  limit?: number;
  /** Starting position for result set (for pagination) */
  offset?: number;
}

// API Response Structure (RentCast /properties endpoint)
export interface RentCastProperty {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  lastSalePrice?: number;
  lastSaleDate?: string; // ISO date string
  assessedValue?: number;
  taxAssessedValue?: number;
  taxAssessedYear?: number;
  features?: string[];

  // AVM-specific fields (only present in /avm/value comparables)
  price?: number; // Listing price (AVM comps)
  status?: string; // "Active" | "Inactive"
  listingType?: string; // "Standard"
  listedDate?: string; // ISO date string
  removedDate?: string; // ISO date string
  lastSeenDate?: string; // ISO date string
  daysOnMarket?: number;
  distance?: number; // Distance from subject in miles
  daysOld?: number; // Days since last seen
  correlation?: number; // Similarity score (0-1)
}

export interface RentCastSearchResponse {
  properties: RentCastProperty[];
  total?: number;
}

// Internal normalized format (matches existing PropertyComparable)
export interface NormalizedComparable {
  address: string;
  price: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt?: number;
  distance?: string; // "0.5 miles"
  soldDate?: string;
  pricePerSqft?: number;
  listingUrl?: string; // Google search URL for the property
  latitude?: number; // For map display
  longitude?: number; // For map display
  correlation?: number; // Similarity score (0-1) from AVM
}

// ============================================================================
// AVM (Automated Valuation Model) Types
// ============================================================================

/**
 * Request parameters for /avm/value endpoint
 * Documentation: https://developers.rentcast.io/reference/value-estimate
 */
export interface RentCastAVMParams {
  /** Full property address in "Street, City, State, Zip" format */
  address: string;

  /** Property type (e.g., "Single Family", "Condo") */
  propertyType?: string;

  /** Number of bedrooms */
  bedrooms?: number;

  /** Number of bathrooms */
  bathrooms?: number;

  /** Square footage of living area */
  squareFootage?: number;

  /**
   * Whether to lookup and use actual subject property attributes.
   * If true, RentCast will override provided attributes with actual property data.
   * Recommended: true for most accurate valuation.
   * Defaults to true.
   */
  lookupSubjectAttributes?: boolean;

  /**
   * Maximum distance between comparable listings and subject property (miles)
   * Smaller radius may result in more similar properties (including age)
   */
  maxRadius?: number;

  /**
   * Maximum number of days since comparable listings were last seen on market
   * Minimum value: 1
   */
  daysOld?: number;

  /**
   * Number of comparable listings to use when calculating the value estimate
   * Range: 5-25, Defaults to 15
   */
  compCount?: number;

  /**
   * Year built range. Supports range format: "1950:1970" or "*:2000"
   * Not officially documented but worth testing
   */
  yearBuilt?: string;
}

/**
 * Subject property details from AVM response
 */
export interface RentCastAVMSubjectProperty {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
}

/**
 * Response from /avm/value endpoint
 */
export interface RentCastAVMResponse {
  /**
   * Estimated current market value (as-is value)
   * This is the primary value to use for as-is calculations
   */
  price: number;

  /**
   * Lower bound of valuation confidence range
   */
  priceRangeLow: number;

  /**
   * Upper bound of valuation confidence range
   */
  priceRangeHigh: number;

  /**
   * Details about the subject property including coordinates
   * Coordinates are useful for filtering subject from comps
   */
  subjectProperty?: RentCastAVMSubjectProperty;

  /**
   * Comparable properties used in valuation
   * Array of RentCastProperty objects
   */
  comparables?: RentCastProperty[];
}

/**
 * AVM metadata for PropertyComps transparency
 * Tracks the source of as-is value and confidence metrics
 */
export interface AVMMetadata {
  /** Source of the as-is value */
  source: 'rentcast_avm' | 'user_estimate' | 'fallback';

  /** Confidence range from AVM (only present if source is rentcast_avm) */
  confidence?: {
    low: number;
    high: number;
    range: number; // high - low
    percentRange: number; // (range / price) * 100
  };

  /** Subject property coordinates from AVM (useful for filtering) */
  subjectCoordinates?: {
    latitude: number;
    longitude: number;
  };

  /** Timestamp when value was fetched */
  timestamp: string; // ISO date string

  /** Reason for fallback (only present if source is user_estimate or fallback) */
  fallbackReason?: string;

  /** Comparables used by AVM for as-is valuation (for transparency) */
  avmComparables?: NormalizedComparable[];
}
