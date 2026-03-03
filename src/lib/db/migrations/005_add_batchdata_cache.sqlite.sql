-- BatchData API Response Cache
-- Reduces API costs by caching responses per recommended durations

-- Address verification cache (30 days)
CREATE TABLE IF NOT EXISTS batchdata_address_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL UNIQUE,
  standardized_address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  county_fips TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  validated BOOLEAN NOT NULL,
  raw_response TEXT NOT NULL, -- Full JSON response
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL -- 30 days from creation
);

CREATE INDEX IF NOT EXISTS idx_batchdata_address_normalized ON batchdata_address_cache(normalized_address);
CREATE INDEX IF NOT EXISTS idx_batchdata_address_expires ON batchdata_address_cache(expires_at);

-- Property details cache (7 days)
CREATE TABLE IF NOT EXISTS batchdata_property_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms REAL,
  square_feet INTEGER,
  lot_size INTEGER,
  year_built INTEGER,
  last_sale_date TEXT,
  last_sale_price REAL,
  tax_assessed_value REAL,
  owner_name TEXT,
  owner_type TEXT,
  avm_value REAL,
  avm_confidence REAL,
  avm_date TEXT,
  pre_foreclosure BOOLEAN,
  raw_response TEXT NOT NULL, -- Full JSON response
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL -- 7 days from creation
);

CREATE INDEX IF NOT EXISTS idx_batchdata_property_address ON batchdata_property_cache(address);
CREATE INDEX IF NOT EXISTS idx_batchdata_property_expires ON batchdata_property_cache(expires_at);

-- Comparable sales cache (24 hours)
CREATE TABLE IF NOT EXISTS batchdata_comps_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_address TEXT NOT NULL,
  search_hash TEXT NOT NULL UNIQUE, -- Hash of search criteria
  comp_tier INTEGER NOT NULL, -- 1, 2, or 3
  comp_count INTEGER NOT NULL,
  median_price_per_sqft REAL,
  comp_derived_value REAL,
  raw_response TEXT NOT NULL, -- Full JSON response with all comps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL -- 24 hours from creation
);

CREATE INDEX IF NOT EXISTS idx_batchdata_comps_hash ON batchdata_comps_cache(search_hash);
CREATE INDEX IF NOT EXISTS idx_batchdata_comps_subject ON batchdata_comps_cache(subject_address);
CREATE INDEX IF NOT EXISTS idx_batchdata_comps_expires ON batchdata_comps_cache(expires_at);

-- BatchData API usage tracking
CREATE TABLE IF NOT EXISTS batchdata_api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  cached BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batchdata_usage_date ON batchdata_api_usage(created_at);
