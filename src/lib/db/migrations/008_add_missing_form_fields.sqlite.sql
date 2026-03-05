-- Migration 008: Add missing form fields to underwriting_submissions
-- These fields align with the UnderwritingFormData TypeScript type

-- Add user's estimate of as-is (current) property value
-- This is a required field used for loan-to-value calculations and AI comparison
ALTER TABLE underwriting_submissions ADD COLUMN user_estimated_as_is_value REAL;

-- Add property county (optional, used for location context)
ALTER TABLE underwriting_submissions ADD COLUMN property_county TEXT;
