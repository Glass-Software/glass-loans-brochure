-- Migration 012: Add marketing consent to users table
-- Stores whether user consented to receive marketing emails from Glass Loans

ALTER TABLE users
ADD COLUMN marketing_consent INTEGER DEFAULT 0;
