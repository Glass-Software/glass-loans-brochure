# Production SQLite Database Protection Guide

## What Caused the Corruption (Dev Environment)

The corruption happened due to **improper manual database deletion** while SQLite was in WAL (Write-Ahead Logging) mode. The WAL files (`.db-wal`, `.db-shm`) became orphaned and couldn't reconcile with the main database.

**This won't happen in production** with proper safeguards in place.

---

## Protection Measures Implemented

### 1. ✅ Graceful Shutdown Handlers

**File**: `src/lib/db/sqlite.ts`

Automatically closes database connections when the server shuts down:
- `SIGTERM` - Fly.io sends this when scaling down or restarting
- `SIGINT` - Ctrl+C in development
- `exit` - Process exit

This prevents corruption from incomplete transactions.

### 2. ✅ Automatic WAL Checkpointing

**File**: `src/lib/db/sqlite.ts`

- **Auto-checkpoint**: Every 1000 pages written
- **Periodic checkpoint**: Every 5 minutes
- **Mode**: PASSIVE (doesn't block readers)

This ensures the WAL is regularly merged into the main database, preventing:
- WAL files growing indefinitely
- Data loss on crashes
- Corruption from orphaned WAL files

### 3. ✅ Database Backups

**Script**: `scripts/backup-db.sh`

**Features**:
- Uses SQLite's `.backup` command (safe for live databases)
- Verifies backup integrity with `PRAGMA integrity_check`
- Compresses backups with gzip
- Retains 7 days of backups
- Safe to run while app is running

**Setup on Fly.io**:

Add to your `fly.toml`:
```toml
[[services.checks]]
  http_path = "/api/health"
  interval = 60000
  timeout = 5000

# Optional: Schedule backups via external cron service
# Or use Fly.io Machines to run periodic tasks
```

**Manual backup**:
```bash
# SSH into Fly.io machine
fly ssh console

# Run backup
/app/scripts/backup-db.sh

# Download backup
fly ssh console --command "cat /data/backups/glass-loans_*.db.gz" > backup.db.gz
```

### 4. ✅ Health Monitoring

**Script**: `scripts/check-db-health.sh`

**Checks**:
- Database file exists
- Integrity check passes
- Table count (should be 7)
- WAL file size (warns if > 10MB)

**Setup**:
```bash
# Add to Fly.io healthcheck
fly deploy --health-check-path=/api/health

# Monitor locally
./scripts/check-db-health.sh
```

---

## Production Deployment Checklist

### Fly.io Configuration

1. **Persistent Volume** (already configured):
   ```bash
   fly volumes list
   # Should show: data_volume mounted at /data
   ```

2. **Environment Variables**:
   ```bash
   fly secrets set BATCHDATA_API_KEY=your_key_here
   fly secrets set BATCHDATA_USE_MOCK=false
   ```

3. **Health Checks** (add to `fly.toml`):
   ```toml
   [[services.checks.database]]
     type = "script"
     command = ["/app/scripts/check-db-health.sh"]
     interval = "5m"
     timeout = "10s"
   ```

### Backup Strategy

**Option 1: Manual Backups** (run weekly)
```bash
fly ssh console --command "/app/scripts/backup-db.sh"
```

**Option 2: Automated Backups** (recommended)

Use a service like:
- **GitHub Actions** (free, runs on schedule)
- **Uptime Robot** (calls webhook that triggers backup)
- **Fly.io Machines** (run backup script on schedule)

**Example GitHub Action**:
```yaml
name: Database Backup
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Backup Database
        run: |
          flyctl ssh console -C "/app/scripts/backup-db.sh"
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Monitoring

**Set up alerts for**:
- Database integrity check failures
- WAL file size > 50MB
- Backup failures
- Disk space < 20%

**Fly.io Metrics**:
```bash
fly dashboard -a your-app-name
# Monitor disk usage under "Metrics"
```

---

## Recovery Procedures

### If Database is Corrupted

1. **Stop the app**:
   ```bash
   fly scale count 0
   ```

2. **SSH into the machine**:
   ```bash
   fly ssh console
   ```

3. **Check corruption**:
   ```bash
   sqlite3 /data/glass-loans.db "PRAGMA integrity_check;"
   ```

4. **Restore from backup**:
   ```bash
   cd /data/backups
   gunzip glass-loans_YYYYMMDD_HHMMSS.db.gz
   mv glass-loans_YYYYMMDD_HHMMSS.db /data/glass-loans.db
   ```

5. **Restart the app**:
   ```bash
   fly scale count 1
   ```

### If Backup is Lost

SQLite has built-in recovery tools:
```bash
# Dump to SQL and re-import
sqlite3 /data/glass-loans.db ".dump" > dump.sql
mv /data/glass-loans.db /data/glass-loans.db.corrupt
sqlite3 /data/glass-loans.db < dump.sql
```

---

## Best Practices

### DO ✅
- Let the app shut down gracefully (wait for SIGTERM)
- Run regular backups (daily minimum)
- Monitor disk space (SQLite needs 2x free space for WAL)
- Use `PRAGMA integrity_check` in health checks
- Keep backups off-server (download periodically)

### DON'T ❌
- Never delete `.db`, `.db-wal`, or `.db-shm` files manually
- Don't kill the process with `kill -9` (use `kill` or `fly scale count 0`)
- Don't run migrations without testing in staging first
- Don't disable WAL mode (needed for concurrency)
- Don't modify the database directly with `sqlite3` CLI while app is running

---

## Migration Safety

Always test migrations in a separate environment first:

```bash
# 1. Take a backup BEFORE migration
./scripts/backup-db.sh

# 2. Test migration locally
npx tsx migrate-all.js

# 3. Verify integrity
./scripts/check-db-health.sh

# 4. Deploy to production
fly deploy

# 5. Verify production
fly ssh console --command "/app/scripts/check-db-health.sh"
```

---

## Performance Tuning

For production, consider these SQLite optimizations:

```sql
-- Already configured in code
PRAGMA journal_mode = WAL;              -- Write-Ahead Logging
PRAGMA foreign_keys = ON;               -- Referential integrity
PRAGMA wal_autocheckpoint = 1000;       -- Checkpoint every 1000 pages

-- Optional (if performance issues)
PRAGMA synchronous = NORMAL;            -- Faster writes (safe with WAL)
PRAGMA cache_size = -64000;             -- 64MB cache
PRAGMA temp_store = MEMORY;             -- Store temp tables in RAM
```

---

## Questions?

- **What if the volume fills up?** - Fly.io volumes can be expanded without downtime
- **How do I migrate to Postgres later?** - Export with `.dump` and import to Postgres
- **Is SQLite production-ready?** - Yes! Powers millions of apps (Expensify, Notion, etc.)
- **What about high concurrency?** - WAL mode handles 100+ concurrent reads, 1 write at a time

**SQLite is perfect for this use case**: thousands of users, mostly reads, simple transactions.
