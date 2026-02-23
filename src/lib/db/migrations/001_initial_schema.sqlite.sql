-- AI Loan Underwriting Tool - Initial Database Schema (SQLite)

-- Users table for email tracking and usage limits
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  normalized_email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  verification_token_expires TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (DATETIME('now')),
  updated_at TEXT DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- Underwriting submissions table
CREATE TABLE IF NOT EXISTS underwriting_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,

  -- User inputs
  property_address TEXT NOT NULL,
  purchase_price REAL NOT NULL,
  rehab REAL NOT NULL,
  square_feet INTEGER NOT NULL,
  property_condition TEXT NOT NULL,
  renovation_per_sf TEXT NOT NULL,
  interest_rate REAL NOT NULL,
  months INTEGER NOT NULL,
  loan_at_purchase REAL NOT NULL,
  renovation_funds REAL DEFAULT 0,
  closing_costs_percent REAL NOT NULL,
  points REAL NOT NULL,
  market_type TEXT NOT NULL,
  additional_details TEXT,
  comp_links TEXT, -- JSON

  -- AI estimates
  estimated_arv REAL,
  as_is_value REAL,
  monthly_rent REAL,

  -- Calculated results (stored for history)
  final_score INTEGER,
  gary_opinion TEXT,
  ai_property_comps TEXT, -- JSON

  -- Metadata
  ip_address TEXT,
  recaptcha_score REAL,
  created_at TEXT DEFAULT (DATETIME('now')),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_underwriting_user_id ON underwriting_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_underwriting_created_at ON underwriting_submissions(created_at);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TEXT DEFAULT (DATETIME('now')),
  created_at TEXT DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- Trigger to automatically update updated_at timestamp on users table
CREATE TRIGGER IF NOT EXISTS update_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
  UPDATE users SET updated_at = DATETIME('now') WHERE id = OLD.id;
END;
