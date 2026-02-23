# SQLite Migration - Cost Savings

## Why SQLite?

Switched from Managed Postgres ($38/month) to SQLite (FREE + ~$0.15/GB/month for storage).

### Benefits:
- ✅ **FREE** - No database service costs
- ✅ **Simple** - Single file database
- ✅ **Fast** - No network latency
- ✅ **Proven** - You already use it successfully for app.glassloans.io
- ✅ **Perfect fit** - Limited scale, rate limited, not expecting massive traffic

### Trade-offs:
- ⚠️ Single-writer (fine for this use case - form submissions are infrequent)
- ⚠️ Manual backups (but Fly volumes have automatic snapshots)
- ⚠️ No built-in replication (not needed initially)

## What Changed

### 1. Dependencies

**package.json:**
- ❌ Removed: `pg` and `@types/pg`
- ✅ Added: `better-sqlite3` and `@types/better-sqlite3`

### 2. Database Files

**New files:**
- `src/lib/db/sqlite.ts` - SQLite connection and query helpers
- `src/lib/db/queries.ts` - Updated to use SQLite (synchronous)
- `src/lib/db/migrations/001_initial_schema.sqlite.sql` - SQLite migration

**Backed up:**
- `src/lib/db/postgres.ts` → Not used anymore
- `src/lib/db/queries-postgres.ts.backup` → Original Postgres version

### 3. Fly.io Configuration

**fly.toml:**
```toml
[mounts]
  source = "glass_loans_data"
  destination = "/data"
```

This mounts a persistent volume at `/data` where the SQLite database file lives.

### 4. Database Location

- **Production**: `/data/glass-loans.db` (Fly.io persistent volume)
- **Local**: `./glass-loans.db` (project root)

## Deployment Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Fly Volume (One-time)

```bash
# Create a 1GB persistent volume in DFW
fly volumes create glass_loans_data --region dfw --size 1 --app glass-loans-brochure-modified-misty-thunder-1484
```

**Cost**: ~$0.15/month for 1GB

### 3. Run Migration Locally (Optional - for testing)

```bash
# Install better-sqlite3 CLI or use node
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('glass-loans.db');
const sql = fs.readFileSync('src/lib/db/migrations/001_initial_schema.sqlite.sql', 'utf8');
db.exec(sql);
console.log('✅ Migration complete');
db.close();
"

# Start dev server
npm run dev

# Visit http://localhost:3000/underwrite
```

### 4. Deploy to Production

```bash
# Set environment variables (no DATABASE_URL needed!)
./deploy-secrets.sh

# Deploy
fly deploy

# The migration will run automatically on first boot
# OR run it manually via SSH:
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484
```

### 5. Run Migration in Production

**Via SSH:**
```bash
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484

# Inside the container:
cd /app
node -e "
const Database = require('better-sqlite3');
const fs = require('fs');
const db = new Database('/data/glass-loans.db');
const sql = fs.readFileSync('src/lib/db/migrations/001_initial_schema.sqlite.sql', 'utf8');
db.exec(sql);
console.log('✅ Migration complete');
db.close();
"

# Verify tables created:
node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/glass-loans.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all();
console.log('Tables:', tables);
db.close();
"

exit
```

### 6. Test Underwriting Tool

1. Visit: `https://your-app.fly.dev/underwrite`
2. Complete a full underwriting submission
3. Verify email verification works
4. Check database via SSH:

```bash
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484

node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/glass-loans.db');

// Check users
const users = db.prepare('SELECT email, usage_count, email_verified FROM users').all();
console.log('Users:', users);

// Check submissions
const submissions = db.prepare('SELECT property_address, final_score FROM underwriting_submissions ORDER BY created_at DESC LIMIT 5').all();
console.log('Submissions:', submissions);

db.close();
"
```

## Backup Strategy

### Automatic Fly Volume Snapshots
Fly.io automatically snapshots volumes. To create a manual backup:

```bash
# Create volume snapshot
fly volumes snapshots create glass_loans_data --app glass-loans-brochure-modified-misty-thunder-1484

# List snapshots
fly volumes snapshots list glass_loans_data --app glass-loans-brochure-modified-misty-thunder-1484
```

### Manual Backup via SSH

```bash
# Download database file
fly ssh sftp get /data/glass-loans.db --app glass-loans-brochure-modified-misty-thunder-1484

# This downloads to your local machine
# Store in a safe location (S3, Dropbox, etc.)
```

### Automated Backup Script (Optional)

```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
fly ssh sftp get /data/glass-loans.db ./backups/glass-loans-$DATE.db --app glass-loans-brochure-modified-misty-thunder-1484
echo "✅ Backup saved to: ./backups/glass-loans-$DATE.db"

# Set up cron to run daily:
# 0 2 * * * /path/to/backup-db.sh
```

## Troubleshooting

### Issue: Database file not found

```bash
# Check if volume is mounted
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484
ls -la /data

# If empty, run migration
cd /app
node -e "..."  # (migration script from above)
```

### Issue: "database is locked"

SQLite locks when writing. If you see this:
- Ensure WAL mode is enabled (it is by default in our code)
- Check for long-running transactions
- Restart the app: `fly apps restart glass-loans-brochure-modified-misty-thunder-1484`

### Issue: Need to query database

```bash
# Via Node.js in SSH
fly ssh console --app glass-loans-brochure-modified-misty-thunder-1484
node
> const Database = require('better-sqlite3')
> const db = new Database('/data/glass-loans.db')
> db.prepare('SELECT * FROM users').all()
> db.close()
```

## Migration from Postgres (If Needed)

If you had already deployed with Postgres and need to migrate:

1. Export Postgres data
2. Convert to SQLite insert statements
3. Import to SQLite
4. Deploy new version with SQLite
5. Delete old Postgres database

(Not needed since we're starting fresh)

## Cost Comparison

| Solution | Cost/Month | Notes |
|----------|-----------|-------|
| **Fly Managed Postgres** | $38.00 | Fully managed, auto-backups, HA |
| **SQLite + Volume (1GB)** | $0.15 | Manual backups, single-writer |
| **Savings** | **$37.85** | 99.6% cost reduction! |

## When to Switch to Postgres

Consider upgrading to Postgres when:
- You need high availability / replication
- You have multiple write-heavy services
- You need advanced Postgres features (PostGIS, full-text search, etc.)
- Traffic exceeds ~100 concurrent users
- You want managed backups and point-in-time recovery

For now, SQLite is perfect and **FREE**! 🎉

## Additional Resources

- [Fly.io Volumes Documentation](https://fly.io/docs/volumes/)
- [better-sqlite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
- [SQLite Performance Tips](https://www.sqlite.org/speed.html)
