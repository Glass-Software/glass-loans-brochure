# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Backup Current Database
```bash
# Create timestamped backup
cp glass-loans.db glass-loans.db.backup-$(date +%Y%m%d-%H%M%S)
```

### 2. Verify Environment Variables
Ensure all required environment variables are set in production:

```bash
OPENROUTER_API_KEY=<your-key>
SENDGRID_API_KEY=<your-key>
SENDGRID_FROM_EMAIL=info@glassloans.io
RECAPTCHA_SECRET_KEY=<your-key>
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=<your-key>
NEXT_PUBLIC_BASE_URL=https://glassloans.io
```

### 3. Install Dependencies
```bash
npm install
# Ensure better-sqlite3 is installed for migrations
npm install better-sqlite3
```

---

## Database Migration Process

### Option 1: Run All Pending Migrations (Recommended)

This is the safest method - it checks and applies only what's needed:

```bash
npx tsx scripts/migrate.ts
```

**Output Example**:
```
🚀 Starting migration process...
📁 Database: /path/to/glass-loans.db

🔍 Checking Migration 001: Initial Schema
✅ Migration 001 already applied (tables exist)

🔍 Checking Migration 002: Add Usage Limit
✅ Migration 002 already applied (usage_limit exists)

🔍 Checking Migration 003: Add User ARV Estimate
⏳ Applying Migration 003...
✅ Migration 003 completed: user_estimated_arv column added

🔍 Verifying final schema...
✨ All migrations completed successfully!
```

### Option 2: Run Individual Migration (Legacy)

If you have the old JavaScript migration scripts:

```bash
# For Migration 003 (User ARV) - old script
node migrate-add-user-arv.js
```

**Note:** The TypeScript version (`npx tsx scripts/migrate.ts`) is recommended as it's maintained and included in production deployments.

### Option 3: Manual SQL Execution

If you prefer to run SQL directly:

```bash
sqlite3 glass-loans.db < src/lib/db/migrations/003_add_user_arv.sqlite.sql
```

---

## Verify Migration Success

After running migrations, verify the schema:

```bash
# Check users table
sqlite3 glass-loans.db "PRAGMA table_info(users);" | grep usage_limit

# Check underwriting_submissions table
sqlite3 glass-loans.db "PRAGMA table_info(underwriting_submissions);" | grep user_estimated_arv
```

**Expected Output**:
```
9|usage_limit|INTEGER|0|3|0
32|user_estimated_arv|REAL|0|NULL|0
```

---

## Application Deployment

### 1. Build Application
```bash
npm run build
```

### 2. Run Production Server
```bash
npm run start
# Or with PM2
pm2 start npm --name "glass-loans" -- start
```

### 3. Smoke Test

Test the underwriting flow:
1. Visit `/underwrite`
2. Enter test property details
3. **Enter User ARV estimate** (new required field in Step 2)
4. Complete email verification
5. Submit for underwriting
6. Verify results show both User ARV and Gary's ARV

---

## Rollback Procedure

If issues occur after deployment:

### 1. Restore Database Backup
```bash
# Stop application first
pm2 stop glass-loans

# Restore backup
cp glass-loans.db.backup-YYYYMMDD-HHMMSS glass-loans.db

# Restart application
pm2 start glass-loans
```

### 2. Revert Code
```bash
git revert <commit-hash>
npm run build
pm2 restart glass-loans
```

---

## Migration Tracking

All migrations are documented in [MIGRATIONS.md](./MIGRATIONS.md).

**Current Production Status**:
- Migration 001: ✅ Applied
- Migration 002: ⚠️ Skip (redundant with 001)
- Migration 003: 🔴 **PENDING - Apply during this deployment**

---

## New Feature: Dual ARV Comparison

**What Changed**:
- Users now input their own ARV estimate in the form (Step 2)
- Gary (AI) provides his independent ARV estimate
- Results display both ARVs with side-by-side calculations
- Gary's opinion evaluates the difference between estimates

**Database Impact**:
- New column: `underwriting_submissions.user_estimated_arv`
- Deprecated (not removed): `underwriting_submissions.monthly_rent`
  - Existing records keep values
  - New submissions will have `NULL`
  - Debt Yield metric removed from calculations

---

## Troubleshooting

### Error: "no such table: users"
**Solution**: Database not initialized. Run:
```bash
npx tsx scripts/migrate.ts
```

### Error: "duplicate column name: user_estimated_arv"
**Solution**: Migration already applied. Safe to ignore.
```bash
# Verify column exists
sqlite3 glass-loans.db "PRAGMA table_info(underwriting_submissions);" | grep user_estimated_arv
```

### Error: "database is locked"
**Solution**: Close any open connections:
```bash
# Find processes using the database
lsof | grep glass-loans.db

# Stop application
pm2 stop glass-loans

# Try migration again
npx tsx scripts/migrate.ts
```

---

## Post-Deployment Verification

### 1. Check Application Logs
```bash
pm2 logs glass-loans
```

### 2. Test Underwriting Flow
- [ ] Form loads at `/underwrite`
- [ ] Step 2 shows "Your Estimated ARV" field
- [ ] Form validation requires ARV input
- [ ] Email verification works
- [ ] Results display both User ARV and Gary's ARV
- [ ] Gary's opinion mentions ARV comparison
- [ ] Database stores `user_estimated_arv` value

### 3. Verify Data Persistence
```bash
# Check recent submissions include user ARV
sqlite3 glass-loans.db "SELECT id, property_address, user_estimated_arv, estimated_arv FROM underwriting_submissions ORDER BY created_at DESC LIMIT 5;"
```

---

## Support

If you encounter issues during deployment:
1. Check application logs: `pm2 logs glass-loans`
2. Review [MIGRATIONS.md](./MIGRATIONS.md) for migration details
3. Restore from backup if needed
4. Contact development team

---

**Last Updated**: 2024
**Deployment Guide Version**: 1.0
