-- Migration 013: Add property coordinates for map display
ALTER TABLE underwriting_submissions
ADD COLUMN property_latitude REAL;

ALTER TABLE underwriting_submissions
ADD COLUMN property_longitude REAL;
