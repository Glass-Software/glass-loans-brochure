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
  mortgageInfo: MortgageInfo | null;
  liens: Lien[];
  ownerName: string;
  ownerType: "Individual" | "LLC" | "Trust" | "Corporation";
  zoning: string;
  avm: AVMData;
  preForeclosure: boolean;
}

export interface TaxAssessment {
  year: number;
  assessedValue: number;
}

export interface MortgageInfo {
  lenderName: string;
  amount: number;
  recordDate: string;
  loanType: string;
}

export interface Lien {
  type: string;
  amount: number;
  recordDate: string;
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
  lastSaleDate: string;
  lastSalePrice: number;
  distance: number; // miles from subject
  daysOnMarket?: number;
}
