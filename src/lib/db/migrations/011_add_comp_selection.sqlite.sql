-- Migration 011: Add comp selection state to underwriting_submissions
-- This stores which comps were emphasized/removed during Step 6
-- JSON structure: [{ "compIndex": 0, "emphasized": false, "removed": false }, ...]

ALTER TABLE underwriting_submissions
ADD COLUMN comp_selection_state TEXT;
