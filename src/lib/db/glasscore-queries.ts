/**
 * GlassCore Database Queries
 *
 * Query functions for properties, valuations, comps, and submissions
 */
import { query, queryOne, execute, transaction } from './glasscore';
import { PoolClient } from 'pg';
import crypto from 'crypto';

// ============================================================================
// Type Definitions
// ============================================================================

export interface Property {
  id: string;
  address: string;
  normalized_address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  lot_size: number | null;
  year_built: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Valuation {
  id: string;
  property_id: string;
  source: string;
  source_record_id: string | null;
  value_type: string;
  estimated_value: number;
  confidence_low: number | null;
  confidence_high: number | null;
  confidence_score: number | null;
  user_id: string | null;
  underwriting_id: string | null;
  valuation_date: Date;
  fetched_at: Date;
  raw_response: any;
}

export interface UnderwritingSubmission {
  id: string;
  property_id: string;
  user_email: string;
  purchase_price: number;
  rehab_budget: number;
  user_estimated_as_is: number;
  user_estimated_arv: number;
  calculated_as_is: number;
  calculated_arv: number;
  calculation_source: string;
  final_score: number | null;
  gary_opinion: string | null;
  loan_amount: number | null;
  interest_rate: number | null;
  actual_purchase_price: number | null;
  actual_sale_price: number | null;
  actual_sale_date: Date | null;
  actual_arv_achieved: boolean | null;
  submitted_at: Date;
  updated_at: Date;
}

export interface Comparable {
  id: string;
  subject_property_id: string;
  comp_property_id: string;
  source: string;
  valuation_id: string | null;
  sale_price: number | null;
  sale_date: Date | null;
  list_price: number | null;
  list_date: Date | null;
  distance_miles: number | null;
  correlation_score: number | null;
  price_per_sqft: number | null;
  selection_reason: string | null;
  selection_tier: number | null;
  fetched_at: Date;
}

export interface SalesHistory {
  id: string;
  property_id: string;
  source: string;
  sale_price: number;
  sale_date: Date;
  sale_type: string | null;
  fetched_at: Date;
}

export interface DataSource {
  source: string;
  display_name: string;
  source_type: string;
  api_endpoint: string | null;
  reliability_score: number | null;
  cost_per_request: number | null;
  last_fetched_at: Date | null;
  is_active: boolean;
}

// ============================================================================
// Property Queries
// ============================================================================

/**
 * Generate a unique property ID
 */
export function generatePropertyId(): string {
  return `prop_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Find property by normalized address
 */
export async function findPropertyByAddress(
  normalizedAddress: string
): Promise<Property | null> {
  return queryOne<Property>(
    'SELECT * FROM properties WHERE normalized_address = $1 LIMIT 1',
    [normalizedAddress]
  );
}

/**
 * Create or update a property
 */
export async function upsertProperty(data: {
  address: string;
  normalizedAddress: string;
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
}): Promise<Property> {
  // Check if property exists
  const existing = await findPropertyByAddress(data.normalizedAddress);

  if (existing) {
    // Update existing property
    const result = await queryOne<Property>(
      `UPDATE properties SET
        address = COALESCE($1, address),
        city = COALESCE($2, city),
        state = COALESCE($3, state),
        zip_code = COALESCE($4, zip_code),
        county = COALESCE($5, county),
        latitude = COALESCE($6, latitude),
        longitude = COALESCE($7, longitude),
        property_type = COALESCE($8, property_type),
        bedrooms = COALESCE($9, bedrooms),
        bathrooms = COALESCE($10, bathrooms),
        square_footage = COALESCE($11, square_footage),
        lot_size = COALESCE($12, lot_size),
        year_built = COALESCE($13, year_built),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING *`,
      [
        data.address,
        data.city || null,
        data.state || null,
        data.zipCode || null,
        data.county || null,
        data.latitude || null,
        data.longitude || null,
        data.propertyType || null,
        data.bedrooms || null,
        data.bathrooms || null,
        data.squareFootage || null,
        data.lotSize || null,
        data.yearBuilt || null,
        existing.id,
      ]
    );
    return result!;
  } else {
    // Create new property
    const id = generatePropertyId();
    const result = await queryOne<Property>(
      `INSERT INTO properties (
        id, address, normalized_address, city, state, zip_code, county,
        latitude, longitude, property_type, bedrooms, bathrooms,
        square_footage, lot_size, year_built
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        id,
        data.address,
        data.normalizedAddress,
        data.city || null,
        data.state || null,
        data.zipCode || null,
        data.county || null,
        data.latitude || null,
        data.longitude || null,
        data.propertyType || null,
        data.bedrooms || null,
        data.bathrooms || null,
        data.squareFootage || null,
        data.lotSize || null,
        data.yearBuilt || null,
      ]
    );
    return result!;
  }
}

// ============================================================================
// Valuation Queries
// ============================================================================

/**
 * Generate a unique valuation ID
 */
export function generateValuationId(): string {
  return `val_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Create a valuation record
 */
export async function createValuation(data: {
  propertyId: string;
  source: string;
  sourceRecordId?: string;
  valueType: string;
  estimatedValue: number;
  confidenceLow?: number;
  confidenceHigh?: number;
  confidenceScore?: number;
  userId?: string;
  underwritingId?: string;
  valuationDate: Date;
  rawResponse?: any;
}): Promise<Valuation> {
  const id = generateValuationId();
  const result = await queryOne<Valuation>(
    `INSERT INTO valuations (
      id, property_id, source, source_record_id, value_type,
      estimated_value, confidence_low, confidence_high, confidence_score,
      user_id, underwriting_id, valuation_date, raw_response
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (property_id, source, value_type, valuation_date)
    DO UPDATE SET
      estimated_value = EXCLUDED.estimated_value,
      confidence_low = EXCLUDED.confidence_low,
      confidence_high = EXCLUDED.confidence_high,
      confidence_score = EXCLUDED.confidence_score,
      raw_response = EXCLUDED.raw_response,
      fetched_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      id,
      data.propertyId,
      data.source,
      data.sourceRecordId || null,
      data.valueType,
      data.estimatedValue,
      data.confidenceLow || null,
      data.confidenceHigh || null,
      data.confidenceScore || null,
      data.userId || null,
      data.underwritingId || null,
      data.valuationDate,
      data.rawResponse ? JSON.stringify(data.rawResponse) : null,
    ]
  );
  return result!;
}

/**
 * Get all valuations for a property
 */
export async function getPropertyValuations(
  propertyId: string
): Promise<Valuation[]> {
  return query<Valuation>(
    `SELECT * FROM valuations
     WHERE property_id = $1
     ORDER BY valuation_date DESC, source`,
    [propertyId]
  );
}

// ============================================================================
// Underwriting Submission Queries
// ============================================================================

/**
 * Generate a unique underwriting submission ID
 */
export function generateUnderwritingId(): string {
  return `uw_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Create an underwriting submission
 */
export async function createUnderwritingSubmission(data: {
  propertyId: string;
  userEmail: string;
  purchasePrice: number;
  rehabBudget: number;
  userEstimatedAsIs: number;
  userEstimatedArv: number;
  calculatedAsIs: number;
  calculatedArv: number;
  calculationSource: string;
  finalScore?: number;
  garyOpinion?: string;
  loanAmount?: number;
  interestRate?: number;
}): Promise<UnderwritingSubmission> {
  const id = generateUnderwritingId();
  const result = await queryOne<UnderwritingSubmission>(
    `INSERT INTO underwriting_submissions (
      id, property_id, user_email, purchase_price, rehab_budget,
      user_estimated_as_is, user_estimated_arv, calculated_as_is, calculated_arv,
      calculation_source, final_score, gary_opinion, loan_amount, interest_rate
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      id,
      data.propertyId,
      data.userEmail,
      data.purchasePrice,
      data.rehabBudget,
      data.userEstimatedAsIs,
      data.userEstimatedArv,
      data.calculatedAsIs,
      data.calculatedArv,
      data.calculationSource,
      data.finalScore || null,
      data.garyOpinion || null,
      data.loanAmount || null,
      data.interestRate || null,
    ]
  );
  return result!;
}

/**
 * Update underwriting submission with actual outcomes
 */
export async function updateUnderwritingOutcome(
  submissionId: string,
  data: {
    actualPurchasePrice?: number;
    actualSalePrice?: number;
    actualSaleDate?: Date;
    actualArvAchieved?: boolean;
  }
): Promise<UnderwritingSubmission | null> {
  return queryOne<UnderwritingSubmission>(
    `UPDATE underwriting_submissions SET
      actual_purchase_price = COALESCE($1, actual_purchase_price),
      actual_sale_price = COALESCE($2, actual_sale_price),
      actual_sale_date = COALESCE($3, actual_sale_date),
      actual_arv_achieved = COALESCE($4, actual_arv_achieved),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *`,
    [
      data.actualPurchasePrice || null,
      data.actualSalePrice || null,
      data.actualSaleDate || null,
      data.actualArvAchieved !== undefined ? data.actualArvAchieved : null,
      submissionId,
    ]
  );
}

/**
 * Get submissions by user email
 */
export async function getUserSubmissionsByEmail(
  userEmail: string,
  limit = 10
): Promise<UnderwritingSubmission[]> {
  return query<UnderwritingSubmission>(
    `SELECT * FROM underwriting_submissions
     WHERE user_email = $1
     ORDER BY submitted_at DESC
     LIMIT $2`,
    [userEmail, limit]
  );
}

// ============================================================================
// Comparable Queries
// ============================================================================

/**
 * Generate a unique comparable ID
 */
export function generateComparableId(): string {
  return `comp_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Create a comparable record
 */
export async function createComparable(data: {
  subjectPropertyId: string;
  compPropertyId: string;
  source: string;
  valuationId?: string;
  salePrice?: number;
  saleDate?: Date;
  listPrice?: number;
  listDate?: Date;
  distanceMiles?: number;
  correlationScore?: number;
  pricePerSqft?: number;
  selectionReason?: string;
  selectionTier?: number;
}): Promise<Comparable> {
  const id = generateComparableId();
  const result = await queryOne<Comparable>(
    `INSERT INTO comparables (
      id, subject_property_id, comp_property_id, source, valuation_id,
      sale_price, sale_date, list_price, list_date, distance_miles,
      correlation_score, price_per_sqft, selection_reason, selection_tier
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    ON CONFLICT (subject_property_id, comp_property_id, source, valuation_id)
    DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      sale_date = EXCLUDED.sale_date,
      list_price = EXCLUDED.list_price,
      distance_miles = EXCLUDED.distance_miles,
      correlation_score = EXCLUDED.correlation_score,
      price_per_sqft = EXCLUDED.price_per_sqft,
      fetched_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      id,
      data.subjectPropertyId,
      data.compPropertyId,
      data.source,
      data.valuationId || null,
      data.salePrice || null,
      data.saleDate || null,
      data.listPrice || null,
      data.listDate || null,
      data.distanceMiles || null,
      data.correlationScore || null,
      data.pricePerSqft || null,
      data.selectionReason || null,
      data.selectionTier || null,
    ]
  );
  return result!;
}

/**
 * Get comparables for a subject property
 */
export async function getComparablesForProperty(
  subjectPropertyId: string,
  valuationId?: string
): Promise<Comparable[]> {
  if (valuationId) {
    return query<Comparable>(
      `SELECT * FROM comparables
       WHERE subject_property_id = $1 AND valuation_id = $2
       ORDER BY correlation_score DESC NULLS LAST, distance_miles ASC`,
      [subjectPropertyId, valuationId]
    );
  } else {
    return query<Comparable>(
      `SELECT * FROM comparables
       WHERE subject_property_id = $1
       ORDER BY correlation_score DESC NULLS LAST, distance_miles ASC`,
      [subjectPropertyId]
    );
  }
}

// ============================================================================
// Sales History Queries
// ============================================================================

/**
 * Generate a unique sales history ID
 */
export function generateSalesHistoryId(): string {
  return `sale_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Create a sales history record
 */
export async function createSalesHistory(data: {
  propertyId: string;
  source: string;
  salePrice: number;
  saleDate: Date;
  saleType?: string;
}): Promise<SalesHistory> {
  const id = generateSalesHistoryId();
  const result = await queryOne<SalesHistory>(
    `INSERT INTO sales_history (
      id, property_id, source, sale_price, sale_date, sale_type
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (property_id, sale_date, source)
    DO UPDATE SET
      sale_price = EXCLUDED.sale_price,
      sale_type = EXCLUDED.sale_type,
      fetched_at = CURRENT_TIMESTAMP
    RETURNING *`,
    [
      id,
      data.propertyId,
      data.source,
      data.salePrice,
      data.saleDate,
      data.saleType || null,
    ]
  );
  return result!;
}

/**
 * Get sales history for a property
 */
export async function getPropertySalesHistory(
  propertyId: string
): Promise<SalesHistory[]> {
  return query<SalesHistory>(
    `SELECT * FROM sales_history
     WHERE property_id = $1
     ORDER BY sale_date DESC`,
    [propertyId]
  );
}

// ============================================================================
// Analytics Queries
// ============================================================================

/**
 * Compare user estimates vs actual outcomes
 */
export async function getUserAccuracyStats(userEmail: string): Promise<{
  totalSubmissions: number;
  avgAsIsVariance: number;
  avgArvVariance: number;
  successfulDeals: number;
}> {
  const result = await queryOne<any>(
    `SELECT
      COUNT(*) as total_submissions,
      AVG(ABS(user_estimated_as_is - calculated_as_is)) as avg_as_is_variance,
      AVG(ABS(user_estimated_arv - calculated_arv)) as avg_arv_variance,
      COUNT(CASE WHEN actual_arv_achieved = TRUE THEN 1 END) as successful_deals
    FROM underwriting_submissions
    WHERE user_email = $1`,
    [userEmail]
  );

  return {
    totalSubmissions: parseInt(result?.total_submissions || '0'),
    avgAsIsVariance: parseFloat(result?.avg_as_is_variance || '0'),
    avgArvVariance: parseFloat(result?.avg_arv_variance || '0'),
    successfulDeals: parseInt(result?.successful_deals || '0'),
  };
}

/**
 * Get source accuracy comparison
 */
export async function getSourceAccuracyStats(): Promise<Array<{
  source: string;
  valueType: string;
  sampleSize: number;
  avgError: number;
  avgErrorPct: number;
}>> {
  return query<any>(
    `SELECT
      v.source,
      v.value_type,
      COUNT(*) as sample_size,
      AVG(ABS(v.estimated_value - sh.sale_price)) as avg_error,
      AVG(ABS(v.estimated_value - sh.sale_price)::DECIMAL / sh.sale_price * 100) as avg_error_pct
    FROM valuations v
    JOIN sales_history sh ON v.property_id = sh.property_id
    WHERE ABS(EXTRACT(EPOCH FROM (v.valuation_date - sh.sale_date)) / 86400) < 180
    GROUP BY v.source, v.value_type
    ORDER BY avg_error ASC`
  );
}
