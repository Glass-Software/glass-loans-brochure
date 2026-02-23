-- AI Loan Underwriting Tool - Initial Database Schema

-- Users table for email tracking and usage limits
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  normalized_email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expires TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_normalized_email ON users(normalized_email);
CREATE INDEX idx_users_verification_token ON users(verification_token);

-- Underwriting submissions table
CREATE TABLE IF NOT EXISTS underwriting_submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  -- User inputs
  property_address TEXT NOT NULL,
  purchase_price DECIMAL(12, 2) NOT NULL,
  rehab DECIMAL(12, 2) NOT NULL,
  square_feet INTEGER NOT NULL,
  property_condition VARCHAR(50) NOT NULL,
  renovation_per_sf VARCHAR(50) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  months INTEGER NOT NULL,
  loan_at_purchase DECIMAL(12, 2) NOT NULL,
  renovation_funds DECIMAL(12, 2) DEFAULT 0,
  closing_costs_percent DECIMAL(5, 2) NOT NULL,
  points DECIMAL(5, 2) NOT NULL,
  market_type VARCHAR(50) NOT NULL,
  additional_details TEXT,
  comp_links JSONB,

  -- AI estimates
  estimated_arv DECIMAL(12, 2),
  as_is_value DECIMAL(12, 2),
  monthly_rent DECIMAL(12, 2),

  -- Calculated results (stored for history)
  final_score INTEGER,
  gary_opinion TEXT,
  ai_property_comps JSONB,

  -- Metadata
  ip_address VARCHAR(45),
  recaptcha_score DECIMAL(3, 2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_underwriting_user_id ON underwriting_submissions(user_id);
CREATE INDEX idx_underwriting_created_at ON underwriting_submissions(created_at);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_ip_endpoint ON rate_limits(ip_address, endpoint);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
