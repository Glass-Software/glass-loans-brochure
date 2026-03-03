-- Migration 007: Add property detail fields to underwriting submissions
-- These fields are now collected from users in Step 1 for better comp search

-- Add new property detail columns
ALTER TABLE underwriting_submissions ADD COLUMN bedrooms INTEGER;
ALTER TABLE underwriting_submissions ADD COLUMN bathrooms REAL;
ALTER TABLE underwriting_submissions ADD COLUMN year_built INTEGER;
ALTER TABLE underwriting_submissions ADD COLUMN property_type TEXT;
