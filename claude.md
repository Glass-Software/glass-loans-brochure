# Claude Development Guide - Glass Loans

This document contains important information for Claude (AI assistant) when working on this codebase.

## Important: Fly.io App Name

**Production App Name:** `glass-loans-brochure-modified-misty-thunder-1484`

All Fly.io commands must use the `-a` flag with this full app name:
```bash
fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
fly logs -a glass-loans-brochure-modified-misty-thunder-1484
fly deploy
```

(Note: `fly deploy` reads the app name from `fly.toml` automatically)

## Database Migrations

### Overview
This project uses SQLite with a custom migration system managed by `scripts/migrate.ts`. Migrations are applied sequentially and tracked to prevent re-application.

### Running Migrations

**Local Development:**
```bash
npx tsx scripts/migrate.ts
```

**Production (Fly.io):**
```bash
# SSH into the Fly.io instance
fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484

# Run migrations
npx tsx scripts/migrate.ts
```

### Migration System Details

- **Database Location:**
  - **Production:** `/data/glass-loans.db` (Fly.io persistent volume)
  - **Development:** `./glass-loans.db` (project root)

- **Migration Files:** Located in `src/lib/db/migrations/`
- **Naming Convention:** `XXX_description.sqlite.sql` (e.g., `011_add_comp_selection.sqlite.sql`)

### Current Migrations (as of Migration 013)

1. **001_initial_schema.sqlite.sql** - Initial database schema (users, underwriting_submissions)
2. **002_add_usage_limit.sqlite.sql** - Add usage tracking
3. **003_add_user_arv_estimate.sqlite.sql** - User ARV estimates
4. **004_add_location_fields.sqlite.sql** - Property location data
5. **005_add_batchdata_cache.sqlite.sql** - BatchData API cache tables
6. **006_add_report_ids.sqlite.sql** - Report IDs and retention
7. **007_add_property_details.sqlite.sql** - Extended property details
8. **008_add_missing_form_fields.sqlite.sql** - As-is value & county
9. **009_add_verification_code.sqlite.sql** - Email verification codes
10. **010_add_realie_cache.sqlite.sql** - Realie API cache tables
11. **011_add_comp_selection.sqlite.sql** - Comp selection state (JSON column)
12. **012_add_marketing_consent.sqlite.sql** - Marketing consent flag
13. **013_add_property_coordinates.sqlite.sql** - Property latitude/longitude coordinates

### Adding New Migrations

When adding a new migration:

1. **Create the SQL file:**
   ```bash
   # Create file in src/lib/db/migrations/
   touch src/lib/db/migrations/012_your_migration_name.sqlite.sql
   ```

2. **Write the migration SQL:**
   ```sql
   -- Migration 012: Description of what this does
   ALTER TABLE table_name
   ADD COLUMN column_name TYPE;
   ```

3. **Update scripts/migrate.ts:**
   ```typescript
   // Add new migration check block
   console.log("🔍 Checking Migration 012: Your Migration Name");

   try {
     // Check if migration already applied
     const columns = db.pragma("table_info(table_name)");
     const hasColumn = columns.some(col => col.name === "column_name");

     if (!hasColumn) {
       console.log("⏳ Applying Migration 012...");
       const migrationSql = fs.readFileSync(
         path.join(process.cwd(), "src/lib/db/migrations/012_your_migration_name.sqlite.sql"),
         "utf8"
       );
       db.exec(migrationSql);
       console.log("✅ Migration 012 completed: description");
     } else {
       console.log("✅ Migration 012 already applied (column_name exists)");
     }
   } catch (error: any) {
     console.error("❌ Migration 012 failed:", error.message);
     db.close();
     process.exit(1);
   }
   ```

4. **Update the summary section:**
   ```typescript
   console.log("   • Migration 012: Your migration name ✅");
   ```

5. **Test locally:**
   ```bash
   npx tsx scripts/migrate.ts
   ```

### Migration Best Practices

- **Always check before applying:** Use `db.pragma("table_info(table_name)")` or similar to check if migration is needed
- **Idempotent migrations:** Ensure migrations can be run multiple times without errors
- **Sequential numbering:** Migrations must be numbered sequentially (001, 002, 003, etc.)
- **Add to version control:** Commit both the SQL file and the updated migrate.ts script
- **Test thoroughly:** Run migrations on a copy of production data before deploying
- **Document changes:** Add clear comments explaining what the migration does

### Troubleshooting

**Migration fails on production:**
1. SSH into Fly.io: `fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484`
2. Check database exists: `ls -la /data/glass-loans.db`
3. Check disk space: `df -h`
4. View migration output for specific error
5. Manual rollback if needed (no automated rollback - be careful!)

**Column already exists error:**
- Migration system should prevent this, but if it happens, update the migration check logic in `migrate.ts`

**Database locked:**
- Ensure no other processes are accessing the database
- On Fly.io, scale down to 1 instance before migrating
- Consider implementing a migration lock table for future safety

## Database Schema Key Tables

### `underwriting_submissions`
Core table for underwriting reports. Key columns:
- `comp_selection_state` (TEXT, JSON) - Stores user's comp selections from Step 6
  - Structure: `[{ "compIndex": 0, "emphasized": false, "removed": false }, ...]`
- `estimated_arv` (REAL) - Gary's ARV estimate from comps
- `as_is_value` (REAL) - Gary's as-is value estimate
- `user_estimated_arv` (DECIMAL) - User's ARV input
- `user_estimated_as_is_value` (REAL) - User's as-is value input
- `ai_property_comps` (TEXT, JSON) - All comparable properties
- `property_latitude`, `property_longitude` (REAL) - For maps

### `users`
User accounts and email verification.

### Cache Tables
- `batchdata_cache` - BatchData API responses (deprecated)
- `realie_cache` - Realie API responses

## Environment Variables

See `.env.example` for full list. Critical for development:

- `NEXT_PUBLIC_MAPBOX_API_KEY` - Required for Step 6 comp selection maps
- `REALIE_API_KEY` or `RENTCAST_API_KEY` - Required for comp data
- `OPENROUTER_API_KEY` - Required for Gary's AI analysis

## Recent Major Changes

### Comp Selection Feature (Migration 011)
- Added Step 6 to underwriting flow for manual comp selection
- Users can emphasize or remove comps before report generation
- Mapbox integration for visual comp selection
- Results page restructured with 4 sections:
  1. Score & Metrics Comparison (User vs Gary)
  2. Gary's Full Opinion
  3. Comps with Map
  4. Detailed Calculations

### Key Files Updated:
- `src/components/Underwriting/Step6CompSelection.tsx` - New step
- `src/components/Underwriting/ScoreMetricsComparison.tsx` - New comparison view
- `src/components/Underwriting/CompsMapSection.tsx` - New map section
- `src/app/underwrite/results/[id]/page.tsx` - Complete restructure
- `src/app/api/underwrite/fetch-comps/route.ts` - New endpoint
- `src/app/api/underwrite/verify-code/route.ts` - New endpoint

## Production Deployment

**IMPORTANT:** Always use the deployment script for production deploys. Migrations are NOT run automatically on deploy due to Fly.io volume mount limitations with `release_command`.

### The Deployment Script (Recommended Method)

Use the deployment script at [scripts/deploy.sh](scripts/deploy.sh) for all production deployments:

```bash
./scripts/deploy.sh
```

**What this script does:**
1. Runs `fly deploy` to deploy your code changes
2. Prompts you to run database migrations (via SSH on the production machine)
3. Prompts you to restart the app (recommended after migrations)
4. Provides a monitoring link to track the deployment

**First-time setup:**
```bash
# Make the script executable (if not already)
chmod +x scripts/deploy.sh

# Ensure it's in version control
git add scripts/deploy.sh
```

**When to skip migrations:**
If you're deploying code changes without any database schema changes, you can answer 'n' when prompted for migrations.

### Manual Deployment (Not Recommended)

Only use this if the deployment script is unavailable:

1. **Deploy the code:**
   ```bash
   fly deploy
   ```

2. **Run migrations manually:**
   ```bash
   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
   npx tsx scripts/migrate.ts
   exit
   ```

3. **Restart the app:**
   ```bash
   fly apps restart glass-loans-brochure-modified-misty-thunder-1484
   ```

### Why Manual Migrations Are Required

The `release_command` in fly.toml runs on a temporary machine without access to the persistent volume at `/data/`. This causes:
- Database file not found (creates new empty database)
- Migrations timeout
- Production data not accessible

Therefore, migrations must be run via SSH on the actual app machine that has the volume mounted. The deployment script handles this automatically.

### Post-Deployment Checklist

After deploying:
- Monitor first few submissions for errors
- Check logs: `fly logs -a glass-loans-brochure-modified-misty-thunder-1484`
- Verify Mapbox usage/quotas if changes affect Step 6

## Database Backup

**Important:** Always backup before running migrations in production.

```bash
# On Fly.io
fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
cp /data/glass-loans.db /data/glass-loans.db.backup-$(date +%Y%m%d)
```
