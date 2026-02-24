# User Usage Limits - Database Management

## Overview

Usage limits are now **configurable per user** in the database, making it easy to offer different tiers and upgrades.

- **Free tier**: 3 analyses (default)
- **Paid tiers**: Any number you set
- **Unlimited**: Set to 999999

## Database Schema

The `users` table includes a `usage_limit` column:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  normalized_email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  verification_token_expires TEXT,
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER DEFAULT 3,  -- ← New column
  created_at TEXT DEFAULT (DATETIME('now')),
  updated_at TEXT DEFAULT (DATETIME('now'))
);
```

## Migration

### Local Database
```bash
node migrate-add-usage-limit.js
```

### Production Database
1. SSH into your Fly.io machine
2. Navigate to app directory
3. Run the same migration script

Or manually via SQL:
```sql
ALTER TABLE users ADD COLUMN usage_limit INTEGER DEFAULT 3;
UPDATE users SET usage_limit = 3 WHERE usage_limit IS NULL;
```

## Managing User Limits

### Update a User's Limit

```bash
# Set to 10 analyses
node update-user-limit.js user@example.com 10

# Set to unlimited (high number)
node update-user-limit.js user@example.com 999999

# Reset to free tier (3)
node update-user-limit.js user@example.com reset
```

### Direct SQL Updates

```sql
-- Upgrade specific user to 10 analyses
UPDATE users SET usage_limit = 10 WHERE email = 'user@example.com';

-- Set unlimited for premium user
UPDATE users SET usage_limit = 999999 WHERE email = 'premium@example.com';

-- Reset user back to free tier
UPDATE users SET usage_limit = 3 WHERE email = 'user@example.com';

-- View all users with their limits
SELECT email, usage_count, usage_limit, (usage_limit - usage_count) as remaining
FROM users
WHERE email_verified = 1
ORDER BY created_at DESC;
```

## Example Tier Structure

```sql
-- Free tier: 3 analyses
UPDATE users SET usage_limit = 3 WHERE email = 'free@example.com';

-- Basic tier: 10 analyses/month
UPDATE users SET usage_limit = 10 WHERE email = 'basic@example.com';

-- Pro tier: 50 analyses/month
UPDATE users SET usage_limit = 50 WHERE email = 'pro@example.com';

-- Enterprise: Unlimited
UPDATE users SET usage_limit = 999999 WHERE email = 'enterprise@example.com';
```

## Code Changes

The system now uses `user.usage_limit` instead of hard-coded 3:

### verify-email route
```typescript
if (user.usage_count >= user.usage_limit) {
  return NextResponse.json({
    message: `You've reached your limit of ${user.usage_limit} free underwriting analyses.`,
    usageLimit: user.usage_limit,
    // ...
  });
}
```

### submit route
```typescript
if (user.usage_count >= user.usage_limit) {
  return NextResponse.json({
    error: `You've reached your limit of ${user.usage_limit} free underwriting analyses.`,
    usageLimit: user.usage_limit,
    // ...
  });
}
```

## Future: Upgrade Flow

When you implement paid upgrades, you'll just need to:

1. Process payment
2. Update user's limit:
   ```sql
   UPDATE users SET usage_limit = 10 WHERE email = 'user@example.com';
   ```
3. Optionally reset usage count for monthly subscriptions:
   ```sql
   UPDATE users SET usage_count = 0, usage_limit = 10 WHERE email = 'user@example.com';
   ```

## Monthly Reset (for Subscriptions)

If you implement monthly subscriptions, create a cron job:

```sql
-- Reset usage count on the 1st of each month for paid users
UPDATE users
SET usage_count = 0
WHERE usage_limit > 3; -- Only reset paid users, not free tier
```

## Checking Current Status

```bash
# View user's current usage
sqlite3 glass-loans.db "SELECT email, usage_count, usage_limit FROM users WHERE email = 'user@example.com';"
```

## Notes

- **Email normalization** still prevents abuse via +1 tricks (user+1@gmail.com)
- **Usage limit** is purely a database field you can change at any time
- **No code changes needed** to adjust limits - just update the database
- **Default for new users** is 3 (free tier)
