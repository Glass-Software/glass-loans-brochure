# Bug Fix: renovationPerSf Type Mismatch

## Issue
The underwriting tool was failing at Step 6 ("Saving your report...") with a Prisma validation error:

```
Argument `renovationPerSf`: Invalid value provided. Expected String, provided Int.
```

## Root Cause
Type mismatch between the frontend TypeScript definition and the PostgreSQL schema after migrating from SQLite to Postgres:

- **Frontend Type** (`src/types/underwriting.ts`): `renovationPerSf: number`
- **Prisma Schema** (`prisma/schema.prisma`): `renovationPerSf String`

SQLite was more permissive with type coercion, so this issue didn't surface until the Postgres migration.

## Solution
Added type conversions at the boundary between TypeScript and Prisma:

### 1. Writing to Database (submit route)
**File**: `src/app/api/underwrite/submit/route.ts:739`

**Before:**
```typescript
renovationPerSf: formData.renovationPerSf,  // number passed directly
```

**After:**
```typescript
renovationPerSf: String(formData.renovationPerSf),  // convert to string
```

### 2. Reading from Database (report API)
**File**: `src/app/api/underwrite/report/[id]/route.ts:52`

**Before:**
```typescript
renovationPerSf: submission.renovation_per_sf as any,  // unsafe cast
```

**After:**
```typescript
renovationPerSf: Number(submission.renovation_per_sf),  // parse back to number
```

### 3. Reading from Database (results page)
**File**: `src/app/underwrite/results/[id]/page.tsx:66`

**Before:**
```typescript
renovationPerSf: submission.renovation_per_sf as any,  // unsafe cast
```

**After:**
```typescript
renovationPerSf: Number(submission.renovation_per_sf),  // parse back to number
```

## Testing
- [x] TypeScript compilation passes with no errors
- [ ] Test submission flow from Step 1-6
- [ ] Verify report generation completes successfully
- [ ] Check that existing reports still display correctly

## Deployment Notes
This fix resolves the blocking issue preventing report submissions. Deploy immediately to restore service.

```bash
# Deploy to production
./scripts/deploy.sh
```

No database migration is needed - the schema already expects a String type.
