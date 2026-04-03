# Claude Development Guide - Glass Loans

This document contains important information for Claude (AI assistant) when working on this codebase.

## ⚠️ IMPORTANT: Deployment

**Always use the deployment script for production:**
```bash
./scripts/deploy.sh
```

**DO NOT use `fly deploy` directly** - it will fail or break features without required build arguments. See [Production Deployment](#production-deployment) section below for details.

## Important: Fly.io App Name

**Production App Name:** `glass-loans-brochure-modified-misty-thunder-1484`

Fly.io commands must use the `-a` flag with this full app name:
```bash
fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
fly logs -a glass-loans-brochure-modified-misty-thunder-1484
```

(Note: For deployment, use `./scripts/deploy.sh` instead of `fly deploy`)

## fly.toml Configuration - Critical Information

### ⚠️ Common Mistakes That Cause "legacy hyper error" and Connection Issues

**1. Using `processes = ['app']` without defining processes:**

The `processes` field in `[http_service]` is **ONLY for apps with multiple process groups** (e.g., separate web and worker processes).

```toml
# ❌ WRONG - causes "legacy hyper error: client error (SendRequest)"
[http_service]
  processes = ['app']  # Don't use this unless you have a [processes] section!
```

**For single-process apps (most Next.js apps), REMOVE the `processes` line entirely:**

```toml
# ✅ CORRECT - no processes field for single-process apps
[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'off'
  auto_start_machines = true
  min_machines_running = 1
  # NO processes line!
```

**If you DO have multiple processes, you MUST define them:**

```toml
# Only use this pattern if you have separate worker processes
[processes]
  app = "node server.js"
  worker = "node worker.js"

[http_service]
  processes = ['app']  # Now this is valid because 'app' is defined above
```

**2. Unnecessary volume mounts:**

Remove volume mounts if you migrated from SQLite to Postgres:

```toml
# ❌ Remove this if using Postgres (not SQLite)
[mounts]
  source = "glass_loans_data"
  destination = "/data"
```

Volume mounts are only needed for persistent file storage, SQLite, or uploaded files. **NOT needed for Postgres** (database is external via DATABASE_URL).

### Health Check Configuration

```toml
[[http_service.checks]]
  grace_period = "30s"  # Give app time to start (must be > startup time)
  interval = "15s"      # How often to check
  method = "GET"
  timeout = "10s"       # Max time for health check to respond
  path = "/"
```

**Important:** If health checks fail, deployment will roll back.

### Auto-start/Auto-stop Settings

```toml
[http_service]
  auto_stop_machines = 'off'   # 'off', 'stop', or 'suspend'
  auto_start_machines = true   # true or false
  min_machines_running = 1     # Machines to keep running (primary region only)
```

**⚠️ Always configure both together:**
- Both enabled: Machines stop when idle, start on traffic (cost-effective for low traffic)
- Both disabled: Machines always running (recommended for production)
- **Mismatched settings can cause Machines that never start or never stop**

### Minimal fly.toml for Next.js App

```toml
app = 'your-app-name'
primary_region = 'dfw'

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'off'
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "30s"
    interval = "15s"
    method = "GET"
    timeout = "10s"
    path = "/"

[[vm]]
  memory = '1gb'
  cpu_kind = 'shared'
  cpus = 1
```

**Reference:** Full fly.toml documentation at https://fly.io/docs/reference/configuration/

## Cron Jobs

This project uses **Fly.io cron-manager** for scheduled tasks.

**Current Cron Jobs:**
- **Monthly Usage Reset**: Resets Pro users' `usageCount` to 0 every 30 days based on their `usagePeriodStart`
  - Schedule: Daily at 3 AM UTC
  - Endpoint: `/api/cron/reset-usage`
  - Documentation: See [CRON_SETUP.md](CRON_SETUP.md)

**Cron Manager App Name:** `glass-loans-brochure-modified-misty-thunder-1484-cron`

**View cron logs:**
```bash
fly logs -a glass-loans-brochure-modified-misty-thunder-1484-cron
```

**Manual trigger (testing):**
```bash
curl -X POST https://glassloans.io/api/cron/reset-usage \
  -H "Authorization: Bearer $CRON_SECRET"
```

For setup instructions, see [CRON_SETUP.md](CRON_SETUP.md).

## Database: Managed Postgres

This project uses **Fly.io Managed Postgres (MPG)** with Prisma ORM.

### Common Database Commands

**List all Managed Postgres clusters:**
```bash
fly mpg list
```

**Connect to database via psql:**
```bash
fly mpg connect <cluster-id>
```

**Proxy database to localhost (for local tools):**
```bash
fly mpg proxy <cluster-id>
# Then connect to: postgres://fly-user:<password>@localhost:16380/fly-db
```

**Attach database to an app:**
```bash
fly mpg attach <cluster-id> -a glass-loans-brochure-modified-misty-thunder-1484
```

**View database connection details:**
- View in Fly.io Dashboard → Managed Postgres → Your Cluster → "Connection" tab
- Shows both pooled (PgBouncer) and direct connection strings
- The pooled connection URL is recommended for most apps

**Note:** MPG clusters run in your Fly.io private network and are not accessible over the public internet. Use `fly mpg proxy` or WireGuard to connect from your local machine.

## Database Migrations

### Overview
This project uses **Prisma ORM** with **PostgreSQL** (Fly.io Managed Postgres). Migrations are managed via Prisma's migration system.

### Running Migrations

**Local Development:**
```bash
# Generate migration from schema changes
npx prisma migrate dev --name your_migration_name

# Apply existing migrations
npx prisma migrate deploy
```

**Production (Fly.io):**
```bash
# Option 1: Via SSH (manual)
fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
npx prisma migrate deploy
exit

# Option 2: Via deployment script (prompted)
./scripts/deploy.sh
# (Script will prompt you to run migrations)
```

### Migration System Details

- **Database Type:** PostgreSQL (Managed Postgres on Fly.io)
- **ORM:** Prisma
- **Schema File:** `prisma/schema.prisma`
- **Migration Files:** Generated in `prisma/migrations/`
- **Connection:** Via `DATABASE_URL` secret (set via `fly mpg attach`)

### Database Schema Location
- **Schema Definition:** `prisma/schema.prisma`
- **Generated Client:** `node_modules/.prisma/client/`
- **Queries:** `src/lib/db/queries.ts` (Prisma queries)
- **Connection Pool:** `src/lib/db/prisma.ts` (pg Pool + Prisma adapter)

### Adding New Migrations with Prisma

When you need to make schema changes:

1. **Update the Prisma schema:**
   ```bash
   # Edit prisma/schema.prisma to add/modify models
   ```

2. **Generate and apply migration locally:**
   ```bash
   # Create a new migration
   npx prisma migrate dev --name add_your_feature

   # This will:
   # - Generate migration SQL in prisma/migrations/
   # - Apply it to your local database
   # - Regenerate Prisma Client
   ```

3. **Review the generated migration:**
   ```bash
   # Check the generated SQL file in:
   # prisma/migrations/YYYYMMDDHHMMSS_add_your_feature/migration.sql
   ```

4. **Commit the migration:**
   ```bash
   git add prisma/schema.prisma prisma/migrations/
   git commit -m "feat: add your feature to database schema"
   ```

5. **Deploy to production:**
   ```bash
   # Deploy the code
   ./scripts/deploy.sh

   # Then run migrations on production
   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
   npx prisma migrate deploy
   exit
   ```

### Migration Best Practices

- **Test locally first:** Always run `npx prisma migrate dev` locally before deploying
- **Review generated SQL:** Check the migration file in `prisma/migrations/` to ensure it does what you expect
- **Backup before major migrations:** For schema changes that could lose data, backup the database first
- **Use transactions:** Prisma migrations are wrapped in transactions by default (PostgreSQL supports this)
- **Version control:** Always commit migration files to git
- **Document breaking changes:** Add comments in the migration SQL for complex changes

### Troubleshooting

**Migration fails on production:**
1. Check migration status:
   ```bash
   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
   npx prisma migrate status
   ```
2. View detailed error logs in the migration output
3. Check database connectivity:
   ```bash
   echo $DATABASE_URL  # Should show postgres://... connection string
   ```
4. For failed migrations, Prisma tracks state in `_prisma_migrations` table

**Migration is out of sync:**
```bash
# Mark a migration as applied without running it (use carefully!)
npx prisma migrate resolve --applied "MIGRATION_NAME"

# Mark a migration as rolled back
npx prisma migrate resolve --rolled-back "MIGRATION_NAME"
```

**Database connection issues:**
- Verify `DATABASE_URL` secret is set: `fly secrets list -a glass-loans-brochure-modified-misty-thunder-1484`
- Check if MPG cluster is running: `fly mpg list`
- Ensure cluster is in the same organization as your app

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

## Database Connection Pool Configuration

The application uses a **node-postgres (pg) Pool** with Prisma adapter for connection management.

**Configuration:** See `src/lib/db/prisma.ts`

**Key Settings:**
- `max: 5` connections per instance
- `connectionTimeoutMillis: 5000` (5s) - Fail fast if pool exhausted
- `idleTimeoutMillis: 30000` (30s) - Close idle connections
- `statement_timeout: 30000` (30s) - Max query execution time
- `keepAlive: true` - Detect dead connections
- `maxUses: 7500` - Recycle connections to prevent memory leaks

**Note:** This is a traditional long-running Fly.io server (not serverless). Long-running AI queries (60+ seconds) are expected and normal.

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

**IMPORTANT:** You MUST use the deployment script for all production deploys. Do NOT use `fly deploy` directly without build arguments.

### The Deployment Script (REQUIRED)

Use the deployment script at [scripts/deploy.sh](scripts/deploy.sh) for **ALL** production deployments:

```bash
./scripts/deploy.sh
```

**What this script does:**
1. Runs `fly deploy` with required build arguments (public API keys)
2. Prompts you to run database migrations (via SSH on the production machine)
3. Prompts you to restart the app (recommended after migrations)
4. Provides a monitoring link to track the deployment

**Why you MUST use this script:**
The script passes required public API keys as build arguments. Without these, the Docker build will fail or features will break:
- `NEXT_PUBLIC_MAPBOX_API_KEY` - Required for Step 6 comp selection maps
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` - Required for address autocomplete in Step 1
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - Required for spam protection

These are **public** keys (safe to embed in client-side code) that are restricted by domain in their dashboards.

**First-time setup:**
```bash
# Make the script executable (if not already)
chmod +x scripts/deploy.sh

# Ensure it's in version control
git add scripts/deploy.sh
```

### Automated Database Migrations

**Migrations run automatically** on every deployment via the `release_command` configured in fly.toml:

```toml
[deploy]
  release_command = 'npx prisma migrate deploy'
```

**How it works:**
1. Fly.io runs the release command on a temporary machine before switching traffic to the new version
2. The command applies any pending migrations from `prisma/migrations/`
3. If migrations fail, the deployment is aborted and traffic stays on the old version
4. If migrations succeed, traffic is switched to the new version

**Why this works with Managed Postgres:**
- The database is external (Fly.io Managed Postgres), not a local volume
- The release machine can access the production database via `DATABASE_URL` secret
- No manual intervention required

**First deployment / Baseline:**
When deploying to a new environment with an existing database, you must first baseline the migration history:

```bash
# On production (one-time setup)
fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
npx prisma migrate resolve --applied 0_init
exit
```

After baselining, all future deployments will automatically run `npx prisma migrate deploy`.

### Manual Deployment (Only if Script Unavailable)

⚠️ **WARNING:** Only use this if the deployment script is broken or unavailable.

```bash
fly deploy \
  --build-arg NEXT_PUBLIC_MAPBOX_API_KEY="pk.eyJ1IjoiMHh0eWRvbyIsImEiOiJjbW11cmFxdnAyOHI1MnJwdWh0bzg4MDU4In0.jtitLpJ6BngOUU64Evr5qA" \
  --build-arg NEXT_PUBLIC_GOOGLE_PLACES_API_KEY="AIzaSyCzo2p73EbPwY4lTNT9PiF6xU-J4AZX3yQ" \
  --build-arg NEXT_PUBLIC_RECAPTCHA_SITE_KEY="6Le7v3QsAAAAAP2GYcBPteIjGmNgtNbtGNY6CVR_"
```

**DO NOT** forget any of these build args or features will break! Migrations will run automatically via release_command.

### Post-Deployment Checklist

After deploying:
- Monitor first few submissions for errors
- Check logs: `fly logs -a glass-loans-brochure-modified-misty-thunder-1484`
- Verify Mapbox usage/quotas if changes affect Step 6

### Public API Keys Configuration

**CRITICAL:** All `NEXT_PUBLIC_*` API keys are passed as **build arguments** during deployment (not as Fly secrets).

**Why build-time, not runtime?**
According to [Next.js documentation](https://nextjs.org/docs/pages/guides/environment-variables), all `NEXT_PUBLIC_` environment variables are "frozen with the value evaluated at build time" and embedded into the client-side bundle. They cannot be changed at runtime.

Fly secrets are only injected at runtime, which is **too late** - the JavaScript bundle is already compiled without them.

**How it works:**
1. The `Dockerfile` accepts build ARGs and converts them to ENV variables
2. The deployment script (`scripts/deploy.sh`) passes all keys via `--build-arg` flags
3. Next.js embeds the keys into the JavaScript bundle during `npm run build`
4. The `.dockerignore` excludes `.env` files to prevent accidental key leakage

**Public keys currently required:**
- `NEXT_PUBLIC_MAPBOX_API_KEY` - Mapbox public token (pk.)
  - Restricted in Mapbox dashboard to `https://glassloans.io/*`
  - Used for Step 6 comp selection maps
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` - Google Places API key
  - Restricted in Google Cloud Console to `https://glassloans.io/*` and Places API only
  - Used for address autocomplete in Step 1
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - reCAPTCHA v3 site key
  - Public by design (paired with server-side secret key)
  - Used for spam protection

**Security:**
These keys are **meant** to be public (visible in browser JavaScript). They are secured via:
- Domain/URL restrictions in their respective dashboards
- API restrictions (e.g., only allow Places API for Google key)
- Server-side validation (reCAPTCHA secret key stays server-only)

**Server-only secrets** (OpenRouter, SendGrid, etc.) remain as Fly secrets and are NEVER passed as build args.

**Local development:**
Uses keys from `.env.local` (different tokens restricted to `localhost:3000`)

## Database Backup

**Important:** Always backup before running major migrations in production.

### Manual Backup via pg_dump

```bash
# Connect via proxy and backup locally
fly mpg proxy <cluster-id>

# In another terminal, create backup
pg_dump -h localhost -p 16380 -U fly-user -d fly-db > backup-$(date +%Y%m%d).sql

# Restore from backup (if needed)
psql -h localhost -p 16380 -U fly-user -d fly-db < backup-20260324.sql
```

### Automated Backups

Fly.io Managed Postgres includes automated daily backups:
- View backups in Fly.io Dashboard → Managed Postgres → Your Cluster → "Backups" tab
- Restore from backup via dashboard or `fly mpg` commands
- Backups are retained based on your plan

For critical migrations, consider creating a manual backup immediately before applying changes.
