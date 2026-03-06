-- Add report ID system and configurable retention
-- Reports are accessible via shareable links for a configurable duration

-- Add report retention setting to users (defaults to 15 days for free tier)
ALTER TABLE users ADD COLUMN report_retention_days INTEGER DEFAULT 15;

-- Add report ID and expiration to submissions
ALTER TABLE underwriting_submissions ADD COLUMN report_id TEXT;
ALTER TABLE underwriting_submissions ADD COLUMN expires_at TEXT;

-- Create unique index for fast report lookup by ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_underwriting_report_id ON underwriting_submissions(report_id);

-- Create index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_underwriting_expires_at ON underwriting_submissions(expires_at);
