// ============================================================================
// Form Input Types
// ============================================================================

export type PropertyCondition = "Great (Like New)" | "Good" | "Bad" | "Really Bad";
export type RenovationLevel =
  | "Light ≤$30/SF"
  | "Medium $31-50/SF"
  | "Heavy >$50/SF";
export type MarketType = "Urban" | "Suburban" | "Rural";

export type PropertyType = "Single Family" | "Condo" | "Townhouse" | "Multi-Family";

export interface UnderwritingFormData {
  // Step 1: Property Details
  propertyAddress: string;
  propertyCity?: string;              // Extracted from Google Places (e.g., "Nashville")
  propertyState?: string;             // 2-letter state code (e.g., "TN")
  propertyZip?: string;               // ZIP code (e.g., "37201")
  propertyCounty?: string;            // County name (e.g., "Davidson County")
  propertyLatitude?: number;          // Latitude coordinate for comp searches
  propertyLongitude?: number;         // Longitude coordinate for comp searches
  purchasePrice: number;
  rehab: number;
  squareFeet: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  propertyType: PropertyType;

  // Step 2: Property Condition & ARV
  propertyCondition: PropertyCondition;
  renovationPerSf: number; // Calculated: rehab / squareFeet
  userEstimatedAsIsValue?: number; // DEPRECATED: User's estimate of current property value (legacy field for backward compatibility)
  userEstimatedArv?: number; // DEPRECATED: User's estimate of After Repair Value (legacy field for backward compatibility)

  // Step 3: Loan Terms
  interestRate: number; // percentage (e.g., 12 for 12%)
  months: number;
  loanAtPurchase: number;
  renovationFunds: number; // defaults to 0
  closingCostsPercent: number; // percentage (e.g., 6.5 for 6.5%)
  points: number; // percentage (e.g., 3 for 3%)

  // Step 4: Market Details
  marketType: MarketType;
  additionalDetails?: string;
}

// ============================================================================
// Property Comparables Types
// ============================================================================

export interface PropertyComparable {
  address: string;
  price: number;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt?: number;
  distance?: string;
  soldDate?: string;
  pricePerSqft?: number;
  listingUrl?: string; // Google search URL for the property
  correlation?: number; // AVM correlation score (0-1) - only present for AVM comps
  latitude?: number; // Coordinates for map display
  longitude?: number;
}

// Comp selection state for Step 6
export interface CompSelectionState {
  compIndex: number;      // Index in compsUsed array
  emphasized: boolean;    // Green highlight - highly relevant
  removed: boolean;       // Excluded from calculation
}

// PropertyComparable with selection state
export interface PropertyComparableWithState extends PropertyComparable {
  selectionState?: {
    emphasized: boolean;
    removed: boolean;
  };
}

export interface AVMMetadata {
  source: 'rentcast_avm' | 'user_estimate' | 'fallback';
  confidence?: {
    low: number;
    high: number;
    range: number;
    percentRange: number;
  };
  subjectCoordinates?: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
  fallbackReason?: string;
  avmComparables?: PropertyComparable[]; // Comps used by AVM for as-is valuation (for transparency)
}

export interface PropertyComps {
  estimatedARV: number; // Gary's ARV estimate
  asIsValue: number; // Gary's as-is value estimate
  apiAsIsValue?: number; // API's as-is value (Third Party Valuation)
  compsUsed: PropertyComparable[]; // ALL comps (including user-removed ones)
  marketAnalysis: string;
  confidence?: "high" | "medium" | "low";
  avmMetadata?: AVMMetadata; // Optional AVM data for transparency
  userEstimatedAsIsValue?: number; // Preserve user's estimate for comparison
  subjectLatitude?: number; // Subject property latitude for map display
  subjectLongitude?: number; // Subject property longitude for map display
}

// ============================================================================
// Calculated Results Types
// ============================================================================

export interface CalculatedResults {
  // Basic calculations
  renovationDollarPerSf: number;
  days: number;
  totalCost: number; // purchasePrice + rehab
  totalLoanAmount: number; // loanAtPurchase + renovationFunds

  // Financial calculations
  closingCostsDollar: number;
  pointsDollar: number;
  perDiem: number;
  totalInterest: number;
  totalCosts: number; // closingCosts + interest + points
  totalCostsOverall: number; // totalCost + totalCosts

  // Profitability metrics
  arv: number; // ARV being used for this calculation
  totalProjectCost: number; // purchasePrice + rehab + totalCosts
  borrowerProfit: number;
  borrowerProfitStressTested: number;
  stressTestedLArv: number; // percentage
  stressTestedProfit: number; // Profit if ARV drops 10%

  // Valuation metrics
  isLoanUnderwater: boolean; // Is loan amount > as-is value day 1?
  loanToAsIsValue: number; // percentage
  loanToArv: number; // percentage
  loanToCost: number; // percentage
  borrowerSpread: number;

  // Scoring components (1-10 scale)
  leverageScore: number; // Average of LTV, LARV, LTC scores
  profitScore: number; // Score based on borrower profit
  stressScore: number; // Score based on stress-tested profit
  underwaterScore: number; // Score based on loan-to-as-is ratio
}

// ============================================================================
// Final Results Types
// ============================================================================

export interface UnderwritingResults {
  // User inputs (for display)
  formData: UnderwritingFormData;

  // Property comps (from Realie)
  propertyComps: PropertyComps;

  // Calculated metrics
  calculations: CalculatedResults;

  // AI opinion & score
  garyOpinion: string;
  finalScore: number; // 0-100

  // Metadata
  submittedAt: Date;
  usageCount: number;
  usageLimit: number;

  // Report sharing
  reportId?: string; // Unique ID for shareable report links
  expiresAt?: string; // ISO date string when the report expires

  // Comp selection state (from Step 6)
  compSelectionState?: CompSelectionState[];
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface VerifyEmailRequest {
  email: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  verified: boolean;
  usageCount?: number;
  limitReached?: boolean;
  message?: string;
}

export interface SubmitUnderwritingRequest {
  email: string;
  verificationCode: string;
  recaptchaToken: string;
  formData: UnderwritingFormData;
  compSelectionState?: CompSelectionState[]; // From Step 6
}

export interface SubmitUnderwritingResponse {
  success: boolean;
  results?: UnderwritingResults;
  error?: string;
  code?:
    | "RATE_LIMIT"
    | "INVALID_EMAIL"
    | "USAGE_LIMIT"
    | "RECAPTCHA_FAILED"
    | "AI_ERROR"
    | "SERVER_ERROR";
  limitReached?: boolean;
}

// ============================================================================
// Form State Types
// ============================================================================

export interface UnderwritingContextState {
  currentStep: number; // 1-6
  formData: Partial<UnderwritingFormData>;
  propertyComps: PropertyComps | null; // Fetched comps from Step 5
  compSelectionState: CompSelectionState[]; // User's comp selections from Step 6
  results: UnderwritingResults | null;
  isSubmitting: boolean;
  error: string | null;
  emailVerified: boolean;
  email: string | null;
  usageCount: number;
  usageLimit: number;
}

export type UnderwritingAction =
  | { type: "SET_STEP"; step: number }
  | { type: "UPDATE_FORM_DATA"; data: Partial<UnderwritingFormData> }
  | { type: "SET_EMAIL"; email: string }
  | { type: "SET_EMAIL_VERIFIED"; verified: boolean; usageCount: number }
  | { type: "SET_SUBMITTING"; submitting: boolean }
  | { type: "SET_RESULTS"; results: UnderwritingResults }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET_FORM" };

// ============================================================================
// Validation Error Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Categorize renovation budget ($/SF) into level
 */
export function getRenovationLevel(renovationPerSf: number): RenovationLevel {
  if (renovationPerSf <= 30) return "Light ≤$30/SF";
  if (renovationPerSf <= 50) return "Medium $31-50/SF";
  return "Heavy >$50/SF";
}
