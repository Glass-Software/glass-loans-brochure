-- Migration 009: Add email verification code fields
-- Support 6-digit code verification instead of email link verification

-- Add verification code and expiration
ALTER TABLE users ADD COLUMN verification_code TEXT;
ALTER TABLE users ADD COLUMN code_expires_at TEXT;

-- Note: We'll keep the old verification_token columns for backward compatibility
-- but new users will use the code-based verification
