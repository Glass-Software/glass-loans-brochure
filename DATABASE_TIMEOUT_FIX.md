# Database Timeout Fix - March 2026

## Problem
Intermittent database timeout errors in production, specifically in the `send-code` route during the multistep underwriting form.

## Root Cause
The PostgreSQL connection pool in `src/lib/db/prisma.ts` was configured with **no timeouts**, causing:

1. **Indefinite waits**: `connectionTimeoutMillis: 0` (default) waits forever for connections
2. **Connection pool exhaustion**: Multiple Fly.io instances × 10 connections each overwhelmed database
3. **Aggressive idle timeout**: Default 10s caused constant reconnections under load

## Solution Applied

Updated [src/lib/db/prisma.ts](src/lib/db/prisma.ts) with production-ready PostgreSQL pool configuration:

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Connection limits (serverless-optimized)
  max: 5,                           // 5 connections per instance (down from 10)
  min: 0,                           // Drain pool when idle

  // Critical timeouts
  connectionTimeoutMillis: 5000,    // 5s timeout acquiring connections
  idleTimeoutMillis: 30000,         // 30s before closing idle connections
  statement_timeout: 2000,          // 2s max query execution time

  // Connection health
  keepAlive: true,                  // Detect dead connections early
  keepAliveInitialDelayMillis: 10000,
  maxUses: 7500,                    // Recycle after 7500 queries (prevent memory leaks)
});
```

### Configuration References
- [node-postgres Pool API](https://node-postgres.com/apis/pool)
- [Prisma Serverless Best Practices](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless)
- [Production Pool Settings Discussion](https://github.com/brianc/node-postgres/issues/1222)

## Why This Works

### 1. `connectionTimeoutMillis: 5000`
- **Before**: `0` (wait forever) - dangerous in production
- **After**: `5000ms` - fails fast if pool is exhausted
- **Source**: [node-postgres docs](https://node-postgres.com/apis/pool) state default is "dangerous"

### 2. `idleTimeoutMillis: 30000`
- **Before**: `10000ms` (10s) - too aggressive for bursty traffic
- **After**: `30000ms` (30s) - recommended for most applications
- **Source**: [GitHub issue #1222](https://github.com/brianc/node-postgres/issues/1222)

### 3. `max: 5` (down from 10)
- **Why**: Fly.io runs multiple instances. With 3 instances: 3 × 10 = 30 total connections
- **Serverless**: [Prisma docs](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless) recommend 1-5 per instance
- **Math**: Total connections = `max × instance_count`

### 4. `statement_timeout: 2000`
- Prevents runaway queries
- Aligns with route-level timeouts (send-code uses 2-3s timeouts)
- Aggressive but appropriate for serverless user-facing queries

### 5. `maxUses: 7500`
- PostgreSQL backend processes slowly leak memory over thousands of queries
- Recycling connections prevents memory bloat in long-running servers
- **Source**: [Connection pooling guide](https://oneuptime.com/blog/post/2026-01-06-nodejs-connection-pooling-postgresql-mysql/view)

## The `send-code` Route

The route performs **4 sequential database queries** per request:
1. `findUserByNormalizedEmail()` (3s timeout)
2. `createUser()` OR `updateMarketingConsent()` (3s/2s timeout)
3. `generateVerificationCode()` (2s timeout)
4. Send email via SendGrid (15s timeout)

Under concurrent load (multiple users submitting simultaneously), this compounds the connection pool pressure.

## What Was Already Working

- ✅ Frontend has double-click protection (`sendingCode` state disables button)
- ✅ Route-level timeouts with `withTimeout()` wrapper
- ✅ Proper error logging and 503 responses

## Deployment

### Testing Locally
```bash
# Start local Postgres (if using docker-compose)
docker-compose up -d

# Test the changes
npm run dev
```

### Deploy to Production
```bash
# Use the deployment script (includes build args)
./scripts/deploy.sh

# Monitor logs after deployment
fly logs -a glass-loans-brochure-modified-misty-thunder-1484
```

No database migration required - this is configuration-only.

## Monitoring

After deploying, watch for:

### 1. Connection Pool Metrics
```bash
fly logs -a glass-loans-brochure-modified-misty-thunder-1484 | grep -i "connection\|pool\|timeout"
```

### 2. send-code Route Performance
Look for these log patterns:
- `🔵 [send-code] User query completed in Xms` (should be < 2000ms)
- `❌ [send-code] Database query timeout` (should disappear)
- `❌ [send-code] Database timeout. Please try again.` (503 responses)

### 3. Database Connection Count
If you have access to the Postgres database:
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db_name';
```
Should be ≤ `max × instance_count` (e.g., 5 × 3 = 15 total)

## Future Optimizations (If Still Having Issues)

### Option 1: Add PgBouncer
External connection pooler between Prisma and Postgres:
- Reduces database connections
- Add `?pgbouncer=true` to DATABASE_URL
- **Source**: [Prisma PgBouncer Guide](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

### Option 2: Batch Database Queries
Combine multiple queries into single transaction:
```typescript
// Instead of 4 separate queries, use prisma.$transaction()
const result = await prisma.$transaction([
  prisma.user.findUnique(...),
  prisma.user.update(...),
]);
```

### Option 3: Add Rate Limiting
Prevent abuse of send-code endpoint:
- Limit to 3 requests per email per 5 minutes
- Already have `RateLimit` table in schema

### Option 4: Reduce Pool Size Further
If connection exhaustion continues:
- Try `max: 3` or `max: 2` per instance
- Prisma docs suggest as low as `connection_limit=1` for serverless

## Related Files
- `src/lib/db/prisma.ts` - Pool configuration (MODIFIED)
- `src/lib/db/queries.ts` - Database queries using Prisma
- `src/app/api/underwrite/send-code/route.ts` - API route with timeouts
- `src/components/Underwriting/Step5EmailVerification.tsx` - Frontend form

## Documentation Sources
- [Prisma ORM Production Guide: Next.js Complete Setup 2025](https://www.digitalapplied.com/blog/prisma-orm-production-guide-nextjs)
- [Best practice for connection pool setup - Prisma Discussion #24497](https://github.com/prisma/prisma/discussions/24497)
- [Connection pooling in Prisma Postgres](https://www.prisma.io/docs/postgres/database/connection-pooling)
- [Database connections | Prisma Documentation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
- [node-postgres Pool API](https://node-postgres.com/apis/pool)
- [Suitable values for poolSize, poolIdleTimeout - GitHub Issue #1222](https://github.com/brianc/node-postgres/issues/1222)
- [How to Implement Connection Pooling in Node.js for PostgreSQL](https://oneuptime.com/blog/post/2026-01-06-nodejs-connection-pooling-postgresql-mysql/view)
- [Deploy a Prisma app to Fly.io](https://www.prisma.io/docs/orm/prisma-client/deployment/traditional/deploy-to-flyio)
- [Connection management | Prisma Documentation](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

---

**Fixed**: March 24, 2026
**Status**: Ready for deployment
