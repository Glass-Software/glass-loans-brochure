-- Realie API Response Cache
-- Reduces API costs by caching comparable searches

-- Comparable sales cache (30 days)
-- Keyed by search parameters (lat/long, radius, beds, sqft, etc.)
CREATE TABLE IF NOT EXISTS realie_comps_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_hash TEXT NOT NULL UNIQUE, -- Hash of search criteria (lat, long, radius, beds, sqft, etc.)
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius REAL NOT NULL,
  search_tier INTEGER NOT NULL, -- 1, 2, or 3
  comp_count INTEGER NOT NULL,
  median_price_per_sqft REAL,
  estimated_arv REAL,
  raw_response TEXT NOT NULL, -- Full JSON response with all comps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL -- 30 days from creation
);

CREATE INDEX IF NOT EXISTS idx_realie_comps_hash ON realie_comps_cache(search_hash);
CREATE INDEX IF NOT EXISTS idx_realie_comps_location ON realie_comps_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_realie_comps_expires ON realie_comps_cache(expires_at);

-- Realie API usage tracking
CREATE TABLE IF NOT EXISTS realie_api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  cached BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_realie_usage_date ON realie_api_usage(created_at);
