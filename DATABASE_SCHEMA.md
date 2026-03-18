# Glass Loans - Property Data Database Schema

## Core Philosophy: Source-Agnostic Normalized Schema

**Store WHAT, not WHERE** - track hundreds of data sources without table explosion.

This schema is designed to handle data from hundreds of sources (RentCast, Realie, Zillow, CoreLogic, public records, user estimates, etc.) without creating separate tables for each source.

---

## Database Tables

### 1. Properties (Core Property Data)

Source-agnostic storage of property attributes.

```sql
CREATE TABLE properties (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL, -- For deduplication
  city TEXT,
  state TEXT,
  zip_code TEXT,
  county TEXT,
  latitude REAL,
  longitude REAL,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms REAL,
  square_footage INTEGER,
  lot_size INTEGER,
  year_built INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_properties_normalized_address ON properties(normalized_address);
CREATE INDEX idx_properties_location ON properties(latitude, longitude);
```

**Key Design Decisions:**

- `normalized_address` for deduplication (lowercase, standardized abbreviations)
- Single source of truth for each property
- Attributes can be updated/enriched from multiple sources over time

---

### 2. Valuations (Multi-Source Property Valuations)

Flexible table to store ANY type of valuation from ANY source.

```sql
CREATE TABLE valuations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  source TEXT NOT NULL, -- 'rentcast_avm', 'realie', 'zillow', 'user_estimate', etc.
  source_record_id TEXT, -- External ID from source system

  -- Valuation data
  value_type TEXT NOT NULL, -- 'as_is', 'arv', 'zestimate', 'user_as_is', 'user_arv'
  estimated_value INTEGER NOT NULL,
  confidence_low INTEGER,
  confidence_high INTEGER,
  confidence_score REAL, -- 0-1 or percentage

  -- User context (for user estimates)
  user_id TEXT, -- Who submitted this estimate
  underwriting_id TEXT, -- Link to underwriting submission

  -- Metadata
  valuation_date TEXT NOT NULL, -- When was this value calculated
  fetched_at TEXT NOT NULL, -- When did we fetch/receive it
  raw_response TEXT, -- JSON blob of full API response

  UNIQUE(property_id, source, value_type, valuation_date)
);

CREATE INDEX idx_valuations_property ON valuations(property_id);
CREATE INDEX idx_valuations_source ON valuations(source);
CREATE INDEX idx_valuations_user ON valuations(user_id);
CREATE INDEX idx_valuations_date ON valuations(valuation_date);
```

**Example Records:**

```sql
-- User's as-is estimate
('val_001', 'prop_123', 'user_estimate', NULL, 'as_is', 320000, NULL, NULL, NULL, 'user_456', 'uw_789', '2026-03-16', '2026-03-16', NULL)

-- RentCast AVM as-is value
('val_002', 'prop_123', 'rentcast_avm', 'rc_12345', 'as_is', 668000, 574000, 763000, 0.95, NULL, 'uw_789', '2026-03-16', '2026-03-16', '{...}')

-- Our calculated ARV
('val_003', 'prop_123', 'glass_loans_percentile', NULL, 'arv', 895000, NULL, NULL, 0.95, NULL, 'uw_789', '2026-03-16', '2026-03-16', '{...}')
```

**Supported Value Types:**

- `as_is` - Current market value
- `arv` - After Repair Value
- `user_as_is` - User's estimate of as-is value
- `user_arv` - User's estimate of ARV
- `zestimate` - Zillow's estimate
- `redfin_estimate` - Redfin's estimate
- Custom types for future sources

---

### 3. Underwriting Submissions (User Expectations vs Reality)

Track user submissions to compare expectations against actual outcomes.

```sql
CREATE TABLE underwriting_submissions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  user_email TEXT NOT NULL,

  -- User inputs
  purchase_price INTEGER NOT NULL,
  rehab_budget INTEGER NOT NULL,
  user_estimated_as_is INTEGER NOT NULL,
  user_estimated_arv INTEGER NOT NULL,

  -- Our estimates (from AVM + comps)
  calculated_as_is INTEGER NOT NULL,
  calculated_arv INTEGER NOT NULL,
  calculation_source TEXT NOT NULL, -- 'rentcast_avm', 'realie', etc.

  -- Deal metrics
  final_score INTEGER, -- 0-100 from Gary
  gary_opinion TEXT,
  loan_amount INTEGER,
  interest_rate REAL,

  -- Outcome tracking (filled in later)
  actual_purchase_price INTEGER, -- What they actually paid (if they tell us)
  actual_sale_price INTEGER, -- What they actually sold for
  actual_sale_date TEXT,
  actual_arv_achieved BOOLEAN, -- Did they hit their ARV target?

  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_submissions_property ON underwriting_submissions(property_id);
CREATE INDEX idx_submissions_user ON underwriting_submissions(user_email);
CREATE INDEX idx_submissions_date ON underwriting_submissions(submitted_at);
```

**Key Features:**

- Tracks user expectations vs our calculations
- Captures actual outcomes (when available)
- Enables user accuracy tracking over time
- Powers model improvement through outcome analysis

---

### 4. Comparables (Sold/Listed Properties Used for Valuation)

Track which properties were used as comps for each valuation.

```sql
CREATE TABLE comparables (
  id TEXT PRIMARY KEY,
  subject_property_id TEXT NOT NULL REFERENCES properties(id),
  comp_property_id TEXT NOT NULL REFERENCES properties(id),
  source TEXT NOT NULL, -- Which source provided this comp
  valuation_id TEXT REFERENCES valuations(id), -- Link to specific valuation

  -- Comp-specific data
  sale_price INTEGER,
  sale_date TEXT,
  list_price INTEGER,
  list_date TEXT,
  distance_miles REAL,
  correlation_score REAL, -- How similar to subject (0-1)
  price_per_sqft REAL,

  -- Why was this selected as a comp?
  selection_reason TEXT, -- 'avm_auto', 'manual_tier1', 'manual_tier2', 'manual_tier3'
  selection_tier INTEGER, -- 1, 2, 3 for manual searches

  fetched_at TEXT NOT NULL,

  UNIQUE(subject_property_id, comp_property_id, source, valuation_id)
);

CREATE INDEX idx_comps_subject ON comparables(subject_property_id);
CREATE INDEX idx_comps_property ON comparables(comp_property_id);
CREATE INDEX idx_comps_source ON comparables(source);
```

**Selection Reasons:**

- `avm_auto` - Auto-selected by AVM algorithm
- `manual_tier1` - Tight criteria (close radius, similar attributes)
- `manual_tier2` - Moderate criteria (expanded search)
- `manual_tier3` - Expanded criteria (fallback tier)

---

### 5. Sales History (Track Property Sales Over Time)

Record all sales transactions for properties.

```sql
CREATE TABLE sales_history (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id),
  source TEXT NOT NULL,

  sale_price INTEGER NOT NULL,
  sale_date TEXT NOT NULL,
  sale_type TEXT, -- 'MLS', 'foreclosure', 'FSBO', etc.

  fetched_at TEXT NOT NULL,

  UNIQUE(property_id, sale_date, source)
);

CREATE INDEX idx_sales_property ON sales_history(property_id);
CREATE INDEX idx_sales_date ON sales_history(sale_date);
```

---

### 6. Data Sources (Track API Sources and Reliability)

Metadata about each data source.

```sql
CREATE TABLE data_sources (
  source TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'avm', 'mls', 'public_records', 'user_input'
  api_endpoint TEXT,
  reliability_score REAL, -- 0-1, how reliable is this source
  cost_per_request REAL,
  last_fetched_at TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
```

**Example Records:**

```sql
INSERT INTO data_sources VALUES
  ('rentcast_avm', 'RentCast AVM', 'avm', 'https://api.rentcast.io/v1/avm/value', 0.92, 0.05, '2026-03-16', TRUE),
  ('realie', 'Realie.ai', 'comps', 'https://api.realie.ai/v1/comps', 0.88, 0.10, '2026-03-16', TRUE),
  ('user_estimate', 'User Estimate', 'user_input', NULL, 0.65, 0.00, NULL, TRUE);
```

---

## Key Queries & Use Cases

### User Expectations vs Reality

Track how accurate user estimates are compared to actual outcomes:

```sql
-- Compare user's as-is estimate vs AVM vs actual sale
SELECT
  s.property_id,
  s.user_estimated_as_is,
  s.calculated_as_is,
  s.actual_sale_price,
  ABS(s.user_estimated_as_is - s.actual_sale_price) as user_error,
  ABS(s.calculated_as_is - s.actual_sale_price) as model_error,
  CASE
    WHEN s.actual_arv_achieved THEN 'Success'
    ELSE 'Miss'
  END as outcome
FROM underwriting_submissions s
WHERE s.actual_sale_price IS NOT NULL;
```

### User Learning Curve

Do users get better at estimating over time?

```sql
SELECT
  user_email,
  COUNT(*) as submission_count,
  AVG(ABS(user_estimated_arv - calculated_arv)) as avg_variance,
  AVG(final_score) as avg_deal_quality
FROM underwriting_submissions
GROUP BY user_email
HAVING submission_count > 5
ORDER BY avg_variance ASC;
```

### Source Accuracy Analysis

Which valuation source is most accurate?

```sql
SELECT
  v.source,
  v.value_type,
  COUNT(*) as sample_size,
  AVG(ABS(v.estimated_value - sh.sale_price)) as avg_error,
  AVG(ABS(v.estimated_value - sh.sale_price) / sh.sale_price * 100) as avg_error_pct
FROM valuations v
JOIN sales_history sh ON v.property_id = sh.property_id
WHERE ABS(JULIANDAY(v.valuation_date) - JULIANDAY(sh.sale_date)) < 180
GROUP BY v.source, v.value_type
ORDER BY avg_error ASC;
```

### Compare All Valuations for a Property

See every estimate from every source for a single property:

```sql
SELECT
  v.source,
  v.value_type,
  v.estimated_value,
  v.confidence_low,
  v.confidence_high,
  v.confidence_score,
  v.valuation_date
FROM valuations v
WHERE v.property_id = 'prop_123'
ORDER BY v.valuation_date DESC, v.source;
```

---

## Data Flow Examples

### User Submits Underwriting

1. **Create/Update Property:**

   ```sql
   INSERT OR IGNORE INTO properties (id, address, normalized_address, ...)
   VALUES ('prop_123', '1803 Guest Dr, Nashville, TN 37216', '1803 guest dr nashville tn 37216', ...);
   ```

2. **Create Underwriting Submission:**

   ```sql
   INSERT INTO underwriting_submissions (id, property_id, user_email, user_estimated_as_is, user_estimated_arv, calculated_as_is, calculated_arv, ...)
   VALUES ('uw_789', 'prop_123', 'investor@example.com', 320000, 850000, 668000, 895000, ...);
   ```

3. **Store Valuations:**

   ```sql
   -- User's estimates
   INSERT INTO valuations (id, property_id, source, value_type, estimated_value, user_id, underwriting_id, ...)
   VALUES ('val_001', 'prop_123', 'user_estimate', 'as_is', 320000, 'user_456', 'uw_789', ...);

   INSERT INTO valuations (id, property_id, source, value_type, estimated_value, user_id, underwriting_id, ...)
   VALUES ('val_002', 'prop_123', 'user_estimate', 'arv', 850000, 'user_456', 'uw_789', ...);

   -- RentCast AVM
   INSERT INTO valuations (id, property_id, source, value_type, estimated_value, confidence_low, confidence_high, underwriting_id, raw_response, ...)
   VALUES ('val_003', 'prop_123', 'rentcast_avm', 'as_is', 668000, 574000, 763000, 'uw_789', '{...}', ...);

   -- Our ARV calculation
   INSERT INTO valuations (id, property_id, source, value_type, estimated_value, confidence_score, underwriting_id, ...)
   VALUES ('val_004', 'prop_123', 'glass_loans_percentile', 'arv', 895000, 0.95, 'uw_789', ...);
   ```

4. **Store Comparables:**

   ```sql
   -- AVM comparables
   INSERT INTO comparables (id, subject_property_id, comp_property_id, source, valuation_id, sale_price, correlation_score, selection_reason, ...)
   VALUES ('comp_001', 'prop_123', 'prop_456', 'rentcast_avm', 'val_003', 529900, 0.9823, 'avm_auto', ...);

   -- Manual search comparables
   INSERT INTO comparables (id, subject_property_id, comp_property_id, source, valuation_id, sale_price, selection_reason, selection_tier, ...)
   VALUES ('comp_020', 'prop_123', 'prop_789', 'rentcast_manual', 'val_004', 615000, 'manual_tier1', 1, ...);
   ```

### Property Sells (User Reports Back)

1. **Update Submission with Actual Outcome:**

   ```sql
   UPDATE underwriting_submissions
   SET actual_sale_price = 875000,
       actual_sale_date = '2026-12-01',
       actual_arv_achieved = TRUE,
       updated_at = '2026-12-01'
   WHERE id = 'uw_789';
   ```

2. **Record Sale in History:**

   ```sql
   INSERT INTO sales_history (id, property_id, source, sale_price, sale_date, sale_type, fetched_at)
   VALUES ('sale_001', 'prop_123', 'user_reported', 875000, '2026-12-01', 'MLS', '2026-12-01');
   ```

3. **Trigger Model Retraining** (application logic, not SQL)

---

## Benefits

### 1. User Feedback Loop

- "Your ARV estimates are typically 8% optimistic"
- "You've improved 15% in accuracy over the last 10 submissions"
- Show user their historical accuracy compared to platform average

### 2. Model Improvement

- Train better valuation models using actual outcomes
- Weight sources by historical accuracy
- Identify which market conditions cause larger errors

### 3. Market Sentiment Analysis

- Track whether users are optimistic/pessimistic about ARV
- Identify bull vs bear market sentiment
- Geographic trends in user expectations

### 4. Deal Quality Scoring

- Weight user estimates by their historical accuracy
- Flag unrealistic expectations early
- Prioritize experienced users with proven track records

### 5. Exit Strategy Tracking

- Identify which users successfully execute deals
- Correlate Gary scores with actual outcomes
- Refine scoring algorithm based on real results

### 6. Multi-Source Validation

- Compare RentCast vs Realie vs Zillow accuracy
- Blend multiple sources for higher confidence
- Identify when sources disagree significantly

---

## Migration from Current Schema

**Existing SQLite Database:** `glass-loans.db`

**Keep As-Is:**

- `users` table
- `user_verifications` table

**Add New Tables:**

- All tables defined above

**Mapping Current `UnderwritingResults` to New Schema:**

- Create record in `underwriting_submissions`
- Create records in `valuations` for user estimates and calculated values
- Create records in `comparables` for both AVM and manual search comps
- Store raw API responses in `valuations.raw_response` as JSON

---

## Future Enhancements

- [ ] Caching layer (24-hour cache for repeat addresses)
- [ ] User accuracy dashboard
- [ ] Model retraining pipeline
- [ ] Multi-source blending algorithm
- [ ] Geographic market sentiment analysis
- [ ] Deal outcome prediction model
- [ ] API cost optimization based on source reliability
