-- Migration 004: Add structured location fields to underwriting_submissions
-- Supports accurate AI comp analysis with explicit location constraints

-- Add city, state, and ZIP columns (nullable for backward compatibility)
ALTER TABLE underwriting_submissions ADD COLUMN property_city TEXT;
ALTER TABLE underwriting_submissions ADD COLUMN property_state TEXT;  -- 2-letter state code
ALTER TABLE underwriting_submissions ADD COLUMN property_zip TEXT;

-- Create index on state for analytics queries
CREATE INDEX IF NOT EXISTS idx_underwriting_property_state
ON underwriting_submissions(property_state);

-- Note: Existing rows will have NULL values for these fields (backward compatible)
-- New submissions will populate these fields automatically
