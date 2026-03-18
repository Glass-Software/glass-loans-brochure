-- ============================================================================
-- GlassCore Database - Initial Schema
-- PostgreSQL Migration
-- ============================================================================
-- This database stores property data from multiple sources and tracks
-- user expectations vs reality for model improvement.
-- ============================================================================

-- 1. Properties (Core Property Data)
-- Source-agnostic storage of property attributes
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL, -- For deduplication
  city TEXT,
  state TEXT,
  zip_code TEXT,
  county TEXT,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms DECIMAL(4, 2),
  square_footage INTEGER,
  lot_size INTEGER,
  year_built INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_normalized_address ON properties(normalized_address);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);

-- 2. Valuations (Multi-Source Property Valuations)
-- Flexible table to store ANY type of valuation from ANY source
CREATE TABLE IF NOT EXISTS valuations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'rentcast_avm', 'realie', 'zillow', 'user_estimate', etc.
  source_record_id TEXT, -- External ID from source system

  -- Valuation data
  value_type TEXT NOT NULL, -- 'as_is', 'arv', 'zestimate', 'user_as_is', 'user_arv'
  estimated_value BIGINT NOT NULL,
  confidence_low BIGINT,
  confidence_high BIGINT,
  confidence_score DECIMAL(5, 4), -- 0-1 or percentage

  -- User context (for user estimates)
  user_id TEXT, -- Who submitted this estimate
  underwriting_id TEXT, -- Link to underwriting submission

  -- Metadata
  valuation_date TIMESTAMP NOT NULL, -- When was this value calculated
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When did we fetch/receive it
  raw_response JSONB, -- JSON blob of full API response

  UNIQUE(property_id, source, value_type, valuation_date)
);

CREATE INDEX IF NOT EXISTS idx_valuations_property ON valuations(property_id);
CREATE INDEX IF NOT EXISTS idx_valuations_source ON valuations(source);
CREATE INDEX IF NOT EXISTS idx_valuations_user ON valuations(user_id);
CREATE INDEX IF NOT EXISTS idx_valuations_date ON valuations(valuation_date);

-- 3. Underwriting Submissions (User Expectations vs Reality)
-- Track user submissions to compare expectations against actual outcomes
CREATE TABLE IF NOT EXISTS underwriting_submissions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- User inputs
  purchase_price BIGINT NOT NULL,
  rehab_budget BIGINT NOT NULL,
  user_estimated_as_is BIGINT NOT NULL,
  user_estimated_arv BIGINT NOT NULL,

  -- Our estimates (from AVM + comps)
  calculated_as_is BIGINT NOT NULL,
  calculated_arv BIGINT NOT NULL,
  calculation_source TEXT NOT NULL, -- 'rentcast_avm', 'realie', etc.

  -- Deal metrics
  final_score INTEGER, -- 0-100 from Gary
  gary_opinion TEXT,
  loan_amount BIGINT,
  interest_rate DECIMAL(5, 2),

  -- Outcome tracking (filled in later)
  actual_purchase_price BIGINT, -- What they actually paid (if they tell us)
  actual_sale_price BIGINT, -- What they actually sold for
  actual_sale_date DATE,
  actual_arv_achieved BOOLEAN, -- Did they hit their ARV target?

  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_property ON underwriting_submissions(property_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON underwriting_submissions(user_email);
CREATE INDEX IF NOT EXISTS idx_submissions_date ON underwriting_submissions(submitted_at);

-- 4. Comparables (Sold/Listed Properties Used for Valuation)
-- Track which properties were used as comps for each valuation
CREATE TABLE IF NOT EXISTS comparables (
  id TEXT PRIMARY KEY,
  subject_property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  comp_property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- Which source provided this comp
  valuation_id TEXT REFERENCES valuations(id) ON DELETE CASCADE, -- Link to specific valuation

  -- Comp-specific data
  sale_price BIGINT,
  sale_date DATE,
  list_price BIGINT,
  list_date DATE,
  distance_miles DECIMAL(8, 2),
  correlation_score DECIMAL(5, 4), -- How similar to subject (0-1)
  price_per_sqft DECIMAL(10, 2),

  -- Why was this selected as a comp?
  selection_reason TEXT, -- 'avm_auto', 'manual_tier1', 'manual_tier2', 'manual_tier3'
  selection_tier INTEGER, -- 1, 2, 3 for manual searches

  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(subject_property_id, comp_property_id, source, valuation_id)
);

CREATE INDEX IF NOT EXISTS idx_comps_subject ON comparables(subject_property_id);
CREATE INDEX IF NOT EXISTS idx_comps_property ON comparables(comp_property_id);
CREATE INDEX IF NOT EXISTS idx_comps_source ON comparables(source);
CREATE INDEX IF NOT EXISTS idx_comps_valuation ON comparables(valuation_id);

-- 5. Sales History (Track Property Sales Over Time)
-- Record all sales transactions for properties
CREATE TABLE IF NOT EXISTS sales_history (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  source TEXT NOT NULL,

  sale_price BIGINT NOT NULL,
  sale_date DATE NOT NULL,
  sale_type TEXT, -- 'MLS', 'foreclosure', 'FSBO', etc.

  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(property_id, sale_date, source)
);

CREATE INDEX IF NOT EXISTS idx_sales_property ON sales_history(property_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_history(sale_date);

-- 6. Data Sources (Track API Sources and Reliability)
-- Metadata about each data source
CREATE TABLE IF NOT EXISTS data_sources (
  source TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'avm', 'mls', 'public_records', 'user_input'
  api_endpoint TEXT,
  reliability_score DECIMAL(3, 2), -- 0-1, how reliable is this source
  cost_per_request DECIMAL(6, 2),
  last_fetched_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Insert default data sources
INSERT INTO data_sources (source, display_name, source_type, api_endpoint, reliability_score, cost_per_request, is_active) VALUES
  ('rentcast_avm', 'RentCast AVM', 'avm', 'https://api.rentcast.io/v1/avm/value', 0.92, 0.05, TRUE),
  ('realie', 'Realie.ai', 'comps', 'https://api.realie.ai/v1/comps', 0.88, 0.10, TRUE),
  ('user_estimate', 'User Estimate', 'user_input', NULL, 0.65, 0.00, TRUE),
  ('glass_loans_percentile', 'Glass Loans Percentile Calculation', 'arv', NULL, 0.90, 0.00, TRUE)
ON CONFLICT (source) DO NOTHING;

-- Create trigger to auto-update updated_at on properties
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_underwriting_submissions_updated_at BEFORE UPDATE ON underwriting_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
