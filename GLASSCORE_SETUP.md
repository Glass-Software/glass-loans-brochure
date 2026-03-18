# GlassCore Database Setup Guide

## Overview

GlassCore is a shared PostgreSQL database that stores property data accessible by both:
- **Website** (glassloans.io)
- **App** (app.glassloans.io)

This allows both applications to share property valuations, comparables, and user submission data.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Website       │     │   App           │
│ glassloans.io   │     │ app.glassloans  │
│                 │     │                 │
│ SQLite (local)  │     │ SQLite (local)  │
│ - users         │     │ - app_users     │
│ - sessions      │     │ - app_data      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    PostgreSQL         │
         └───────► GlassCore ◄───┘
                  - properties
                  - valuations
                  - comparables
                  - submissions
```

## Setup Instructions

### 1. Create PostgreSQL Database on fly.io

Run the setup script:

```bash
chmod +x scripts/setup-glasscore-db.sh
./scripts/setup-glasscore-db.sh
```

Or manually:

```bash
# Create the database
fly postgres create --name glasscore-db --region iad --vm-size shared-cpu-1x

# Attach to website app
fly postgres attach glasscore-db -a YOUR_WEBSITE_APP --variable-name GLASSCORE_DATABASE_URL

# Attach to app
fly postgres attach glasscore-db -a YOUR_APP_APP --variable-name GLASSCORE_DATABASE_URL
```

### 2. Get Database Connection String

```bash
# Get connection details
fly postgres connect -a glasscore-db

# Or view the connection string
fly secrets list -a YOUR_WEBSITE_APP
```

The connection string will look like:
```
postgres://username:password@hostname.fly.dev:5432/dbname?sslmode=disable
```

### 3. Add to Environment Variables

**Local development (.env):**
```bash
GLASSCORE_DATABASE_URL=postgres://username:password@hostname:5432/dbname
```

**Production (fly.io):**
The database is already attached via `fly postgres attach`, so the environment variable is set automatically.

### 4. Install Dependencies

```bash
npm install pg
npm install -D @types/node
```

### 5. Run Migrations

**Option A: Using the migration script (recommended):**
```bash
npx tsx scripts/migrate-glasscore.ts
```

**Option B: Manually via psql:**
```bash
# Proxy database to localhost
fly proxy 5432 -a glasscore-db

# In another terminal
psql $GLASSCORE_DATABASE_URL < src/lib/db/migrations/001_glasscore_initial.postgres.sql
```

**Option C: Direct connection:**
```bash
fly postgres connect -a glasscore-db
# Then paste the SQL from the migration file
```

### 6. Verify Setup

```bash
# Connect to database
fly postgres connect -a glasscore-db

# List tables
\dt

# Check data sources
SELECT * FROM data_sources;
```

## Using GlassCore in Your Code

### Import Queries

```typescript
import {
  upsertProperty,
  createValuation,
  createUnderwritingSubmission,
  getPropertyValuations,
  getUserAccuracyStats
} from '@/lib/db/glasscore-queries';
```

### Example: Store Underwriting Submission

```typescript
// 1. Create or update property
const property = await upsertProperty({
  address: '1803 Guest Dr',
  normalizedAddress: '1803 guest dr nashville tn 37216',
  city: 'Nashville',
  state: 'TN',
  zipCode: '37216',
  bedrooms: 3,
  bathrooms: 2,
  squareFootage: 1200,
  yearBuilt: 1950
});

// 2. Store user's estimates as valuations
await createValuation({
  propertyId: property.id,
  source: 'user_estimate',
  valueType: 'as_is',
  estimatedValue: 320000,
  userId: userEmail,
  underwritingId: submissionId,
  valuationDate: new Date()
});

await createValuation({
  propertyId: property.id,
  source: 'user_estimate',
  valueType: 'arv',
  estimatedValue: 850000,
  userId: userEmail,
  underwritingId: submissionId,
  valuationDate: new Date()
});

// 3. Store AVM valuation
await createValuation({
  propertyId: property.id,
  source: 'rentcast_avm',
  valueType: 'as_is',
  estimatedValue: 668000,
  confidenceLow: 574000,
  confidenceHigh: 763000,
  confidenceScore: 0.95,
  underwritingId: submissionId,
  valuationDate: new Date(),
  rawResponse: avmResponse
});

// 4. Store calculated ARV
await createValuation({
  propertyId: property.id,
  source: 'glass_loans_percentile',
  valueType: 'arv',
  estimatedValue: 895000,
  confidenceScore: 0.95,
  underwritingId: submissionId,
  valuationDate: new Date()
});

// 5. Create underwriting submission
await createUnderwritingSubmission({
  propertyId: property.id,
  userEmail: userEmail,
  purchasePrice: 600000,
  rehabBudget: 100000,
  userEstimatedAsIs: 320000,
  userEstimatedArv: 850000,
  calculatedAsIs: 668000,
  calculatedArv: 895000,
  calculationSource: 'rentcast_avm',
  finalScore: 85,
  garyOpinion: 'Great deal!',
  loanAmount: 560000,
  interestRate: 12.5
});
```

### Example: Store Comparables

```typescript
import { createComparable } from '@/lib/db/glasscore-queries';

// For each comp property, create a property record first
const compProperty = await upsertProperty({
  address: comp.formattedAddress,
  normalizedAddress: normalizeAddress(comp.formattedAddress),
  city: comp.city,
  state: comp.state,
  zipCode: comp.zipCode,
  bedrooms: comp.bedrooms,
  bathrooms: comp.bathrooms,
  squareFootage: comp.squareFootage,
  yearBuilt: comp.yearBuilt
});

// Then create the comparable relationship
await createComparable({
  subjectPropertyId: property.id,
  compPropertyId: compProperty.id,
  source: 'rentcast_manual',
  valuationId: valuationId,
  salePrice: comp.price,
  saleDate: new Date(comp.lastSaleDate),
  distanceMiles: comp.distance,
  correlationScore: comp.correlation,
  pricePerSqft: comp.pricePerSquareFoot,
  selectionReason: 'manual_tier1',
  selectionTier: 1
});
```

### Example: Get User Accuracy Stats

```typescript
import { getUserAccuracyStats } from '@/lib/db/glasscore-queries';

const stats = await getUserAccuracyStats('investor@example.com');
console.log(`Total submissions: ${stats.totalSubmissions}`);
console.log(`Avg ARV variance: $${stats.avgArvVariance.toFixed(0)}`);
console.log(`Successful deals: ${stats.successfulDeals}`);
```

## Database Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete schema documentation.

### Key Tables

1. **properties** - Core property data
2. **valuations** - Multi-source property valuations (AVM, user estimates, etc.)
3. **underwriting_submissions** - User expectations vs our calculations
4. **comparables** - Comp properties linked to valuations
5. **sales_history** - Historical sales data
6. **data_sources** - Metadata about data providers

## Maintenance

### Connect to Database

```bash
# Direct connection
fly postgres connect -a glasscore-db

# Proxy to localhost
fly proxy 5432 -a glasscore-db
# Then: psql $GLASSCORE_DATABASE_URL
```

### Check Database Status

```bash
fly status -a glasscore-db
fly postgres db list -a glasscore-db
```

### Backup Database

```bash
# Create backup
fly postgres backup create -a glasscore-db

# List backups
fly postgres backup list -a glasscore-db
```

### Monitor Performance

```bash
# View logs
fly logs -a glasscore-db

# Check metrics
fly dashboard -a glasscore-db
```

## Costs

**fly.io Postgres Pricing:**
- shared-cpu-1x: $1.94/month
- 1GB volume: Included
- Additional volume: $0.15/GB/month

**Estimated total:** ~$2-5/month depending on usage

## Troubleshooting

### Connection Issues

If you can't connect to the database:

1. Check if the database is running:
   ```bash
   fly status -a glasscore-db
   ```

2. Verify environment variable is set:
   ```bash
   fly secrets list -a YOUR_APP
   ```

3. Test connection:
   ```bash
   fly postgres connect -a glasscore-db
   ```

### Migration Failed

If migration fails:

1. Check if tables already exist:
   ```bash
   fly postgres connect -a glasscore-db
   \dt
   ```

2. Drop all tables and re-run:
   ```sql
   DROP TABLE IF EXISTS comparables CASCADE;
   DROP TABLE IF EXISTS sales_history CASCADE;
   DROP TABLE IF EXISTS valuations CASCADE;
   DROP TABLE IF EXISTS underwriting_submissions CASCADE;
   DROP TABLE IF EXISTS properties CASCADE;
   DROP TABLE IF EXISTS data_sources CASCADE;
   ```

3. Re-run migration:
   ```bash
   npx tsx scripts/migrate-glasscore.ts
   ```

### SSL/TLS Errors

If you see SSL errors, update your connection string:

```typescript
// In glasscore.ts
ssl: process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: false
} : false
```

## Next Steps

1. ✅ Database created and migrated
2. ✅ Connected to both apps
3. 🔄 Start storing property data
4. 🔄 Build analytics dashboards
5. 🔄 Train ML models on actual outcomes
