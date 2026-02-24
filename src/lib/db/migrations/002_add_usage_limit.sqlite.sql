-- Add usage_limit column to users table
-- This allows flexible tier management (free users get 3, paid users can get more)

ALTER TABLE users ADD COLUMN usage_limit INTEGER DEFAULT 3;

-- Update existing users to have default limit of 3
UPDATE users SET usage_limit = 3 WHERE usage_limit IS NULL;
