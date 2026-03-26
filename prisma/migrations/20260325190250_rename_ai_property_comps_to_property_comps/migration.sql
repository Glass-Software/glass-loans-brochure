-- Rename column from ai_property_comps to property_comps
-- This field stores comp data from Rentcast/Realie API, not AI-generated data
ALTER TABLE "underwriting_submissions" RENAME COLUMN "ai_property_comps" TO "property_comps";
