/**
 * Realie.ai Premium Comparables Search API Types
 */

// API Request Parameters
export interface RealieCompSearchParams {
  latitude: number;
  longitude: number;
  radius?: number; // miles (default: 1)
  timeFrame?: number; // months (default: 18)
  sqftMin?: number;
  sqftMax?: number;
  bedsMin?: number;
  bedsMax?: number;
  bathsMin?: number;
  bathsMax?: number;
  propertyType?: "any" | "condo" | "house";
  priceMin?: number;
  priceMax?: number;
  maxResults?: number; // 1-50 (default: 25)
}

// API Response Structure (matches actual Realie API response)
export interface RealieComparable {
  address?: string;
  addressFull?: string; // Primary address field
  transferPrice?: number; // Sale price
  buildingArea?: number; // Square footage
  totalBedrooms?: number;
  totalBathrooms?: number;
  yearBuilt?: number;
  transferDate?: string; // Sale date
  distance?: number; // miles from subject
  propertyType?: string;
  lotSize?: number;
}

export interface RealieSearchResponse {
  comparables: RealieComparable[];
  metadata: {
    count: number;
    searchParams: RealieCompSearchParams;
  };
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
}
