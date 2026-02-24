-- Migration 003: Add user ARV estimate and remove monthly rent
-- This migration supports the new dual ARV comparison feature

-- Add user's ARV estimate column
ALTER TABLE underwriting_submissions ADD COLUMN user_estimated_arv DECIMAL(12, 2);

-- Note: SQLite doesn't support DROP COLUMN easily, so we'll leave monthly_rent
-- It will simply not be populated going forward (will be NULL for new submissions)
-- To fully remove it, you would need to recreate the table

-- Update comment for as_is_value to clarify it's still used for underwater check
-- (No actual change needed - just documenting that we're keeping this column)
