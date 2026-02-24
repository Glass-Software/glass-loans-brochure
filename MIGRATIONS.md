# Database Migrations

## Migration History

This document tracks all database schema changes for the AI Loan Underwriting Tool.

**Current Database**: SQLite (`glass-loans.db`)

---

## Migrations

### 001 - Initial Schema (SQLite)
**File**: [src/lib/db/migrations/001_initial_schema.sqlite.sql](src/lib/db/migrations/001_initial_schema.sqlite.sql)
**Status**: ✅ Applied (initial setup)
**Date Applied**: Initial deployment

**Changes**:
- Creates `users` table with email verification and usage tracking
- Creates `underwriting_submissions` table for storing submissions
- Creates `rate_limits` table for API rate limiting
- Includes `usage_limit` column (default: 3) in users table
- Creates indexes for performance
- Adds trigger for `updated_at` auto-update

**Tables Created**:
- `users` (id, email, normalized_email, email_verified, verification_token, verification_token_expires, usage_count, usage_limit, created_at, updated_at)
- `underwriting_submissions` (id, user_id, property_address, purchase_price, rehab, square_feet, property_condition, renovation_per_sf, interest_rate, months, loan_at_purchase, renovation_funds, closing_costs_percent, points, market_type, additional_details, comp_links, estimated_arv, as_is_value, monthly_rent, final_score, gary_opinion, ai_property_comps, ip_address, recaptcha_score, created_at)
- `rate_limits` (id, ip_address, endpoint, request_count, window_start, created_at)

---

### 002 - Add Usage Limit (SQLite)
**File**: [src/lib/db/migrations/002_add_usage_limit.sqlite.sql](src/lib/db/migrations/002_add_usage_limit.sqlite.sql)
**Script**: [migrate-add-usage-limit.js](migrate-add-usage-limit.js)
**Status**: ⚠️ REDUNDANT (usage_limit already in 001 schema)
**Date Applied**: N/A (column already exists in 001_initial_schema.sqlite.sql)

**Changes**:
- Attempts to add `usage_limit` column to `users` table
- **Note**: This column already exists in the initial SQLite schema

**Action Required**:
- If running fresh deployment with 001_initial_schema.sqlite.sql, SKIP this migration
- Migration script checks if column exists before adding, so safe to run

---

### 003 - Add User ARV Estimate
**File**: [src/lib/db/migrations/003_add_user_arv.sqlite.sql](src/lib/db/migrations/003_add_user_arv.sqlite.sql)
**Script**: [migrate-add-user-arv.js](migrate-add-user-arv.js)
**Status**: ✅ Applied locally
**Date Applied**: 2024 (local dev)
**Production Status**: 🔴 **PENDING - NOT YET APPLIED TO PRODUCTION**

**Changes**:
- Adds `user_estimated_arv` column to `underwriting_submissions` table
- Supports dual ARV comparison feature (user's estimate vs Gary's estimate)

**SQL**:
```sql
ALTER TABLE underwriting_submissions ADD COLUMN user_estimated_arv DECIMAL(12, 2);
```

**How to Apply**:
```bash
npx tsx scripts/migrate.ts
```

**Verification**:
The script automatically verifies the migration by checking the table schema. Success output:
```
✅ Migration completed successfully!

📊 Updated schema:
  - user_estimated_arv (REAL)
  - estimated_arv (REAL)
  - as_is_value (REAL)
  - monthly_rent (REAL)

✨ Ready for dual ARV comparison feature!
```

---

## Production Deployment Checklist

### Prerequisites
- [ ] Backup production database before running migrations
- [ ] Verify Node.js is installed on production server
- [ ] Install dependencies: `npm install better-sqlite3`

### For Fresh Production Deployment (New Database)
Run migrations in order:

1. **Initial Schema**:
   ```bash
   # Option 1: Use sqlite3 CLI
   sqlite3 glass-loans.db < src/lib/db/migrations/001_initial_schema.sqlite.sql

   # Option 2: Use Node.js
   node -e "const db = require('better-sqlite3')('glass-loans.db'); const fs = require('fs'); const sql = fs.readFileSync('src/lib/db/migrations/001_initial_schema.sqlite.sql', 'utf8'); db.exec(sql); console.log('✅ Initial schema created');"
   ```

2. **Skip Migration 002** (usage_limit already in schema)

3. **Add User ARV**:
   ```bash
   npx tsx scripts/migrate.ts
   ```

### For Existing Production Database (Incremental Updates)

**If production was deployed before dual ARV feature**:

1. **Check if usage_limit exists**:
   ```bash
   sqlite3 glass-loans.db "PRAGMA table_info(users);" | grep usage_limit
   ```
   - If missing: Run `npx tsx scripts/migrate.ts` (will apply all pending migrations)
   - If exists: Skip migration 002

2. **Apply User ARV Migration**:
   ```bash
   npx tsx scripts/migrate.ts
   ```

---

## Migration Script Pattern

All migration scripts follow this pattern for safety:

```javascript
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "glass-loans.db");
const migrationPath = path.join(__dirname, "src/lib/db/migrations/XXX_migration_name.sqlite.sql");

console.log("🔄 Running migration: <Description>");

try {
  const db = new Database(dbPath);

  // Check if already applied
  const result = db.pragma("table_info(<table_name>)");
  const hasColumn = result.some((col) => col.name === "<column_name>");

  if (hasColumn) {
    console.log("✅ Migration already applied");
    db.close();
    process.exit(0);
  }

  // Apply migration
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  db.exec(migrationSql);

  // Verify
  const updated = db.pragma("table_info(<table_name>)");
  const verified = updated.some((col) => col.name === "<column_name>");

  if (verified) {
    console.log("✅ Migration completed successfully!");
  } else {
    throw new Error("Migration verification failed");
  }

  db.close();
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exit(1);
}
```

---

## Database Location

**Local Development**: `/Users/tydoo/glass-loans-brochure-modified/glass-loans.db`
**Production**: TBD (set DATABASE_URL or use default path)

---

## Notes

### Monthly Rent Column (Deprecated)
- `monthly_rent` column still exists in schema but is no longer used
- SQLite doesn't support DROP COLUMN easily
- New submissions will have `monthly_rent = NULL`
- Debt Yield calculation removed from application logic

### Postgres vs SQLite
- Original schema was designed for Postgres ([001_initial_schema.sql](src/lib/db/migrations/001_initial_schema.sql))
- Project switched to SQLite ([001_initial_schema.sqlite.sql](src/lib/db/migrations/001_initial_schema.sqlite.sql))
- Postgres schema is NOT compatible with current codebase

---

## Quick Reference

| Migration | Description | Status | Prod Action Required |
|-----------|-------------|--------|---------------------|
| 001 | Initial schema | ✅ Applied | Already deployed |
| 002 | Add usage_limit | ⚠️ Redundant | Skip (already in 001) |
| 003 | Add user_estimated_arv | 🔴 Pending | **RUN THIS** |

---

## Rollback Procedures

### Rollback 003 (User ARV)
```sql
-- SQLite doesn't support DROP COLUMN
-- To rollback, restore from backup or manually set to NULL
UPDATE underwriting_submissions SET user_estimated_arv = NULL;
```

### Full Database Restore
```bash
# Restore from backup
cp glass-loans.db.backup glass-loans.db
```

---

**Last Updated**: 2024
**Current Schema Version**: 003 (local), 001 (production)
