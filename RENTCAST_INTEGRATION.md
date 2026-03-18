# RentCast API Integration

## Overview
Successfully integrated RentCast as a 3rd real estate data provider with automatic fallback support to Realie.ai and AI estimation.

## Features Implemented

### 1. RentCast API Client (`src/lib/rentcast/`)
- **client.ts**: Full API client with comprehensive parameter support
- **types.ts**: Complete TypeScript definitions for all API parameters
- **comps.ts**: 3-tier comparable search strategy
- **underwriting.ts**: Property estimation entry point

### 2. Provider Abstraction Layer (`src/lib/comps/`)
- **provider.ts**: Intelligent provider system that:
  - Supports multiple APIs (RentCast, Realie, BatchData)
  - Automatic fallback if primary fails
  - Configurable via `COMPS_PROVIDER` environment variable
- **types.ts**: Common interfaces for all providers

### 3. API Configuration
- **Environment Variables**:
  - `RENTCAST_API_KEY`: Your RentCast API key
  - `COMPS_PROVIDER`: Primary provider (default: "rentcast")
  - `REALIE_API_KEY`: Fallback Realie API key

## RentCast API Parameters

All parameters documented in `src/lib/rentcast/types.ts`. Key features:

### Range Query Support
Many parameters support range format using colon separators:
```
bedrooms="2:4"           // 2-4 bedrooms
squareFootage="1000:2000" // 1000-2000 sqft
saleDateRange="*:180"     // Sold within last 180 days
yearBuilt="2000:*"        // Built in 2000 or later
```

### Geographic Filters
- `latitude`, `longitude`, `radius` - Circular area search
- `address`, `city`, `state`, `zipCode` - Location filters

### Property Characteristics
- `propertyType` - e.g., "Single Family"
- `bedrooms` - Exact or range: "3:3" or "2:4"
- `bathrooms` - Exact or range
- `squareFootage` - Range format
- `lotSize` - Range format
- `yearBuilt` - Range format

### Date/Time Filters
- `saleDateRange` - For /properties endpoint (sold properties)
  - Format: "*:270" = sold within last 270 days
- `daysOld` - For /listings endpoints only (NOT for sales)

### Pagination
- `limit` - Max results per request (max 500)
- `offset` - Starting position

## 3-Tier Search Strategy

### Tier 1 (Tight Criteria)
- **Radius**: Market-dependent (1mi Primary, 2mi Secondary, 5mi Tertiary)
- **Bedrooms**: Exact match
- **Square Footage**: ±20% range
- **Sale Date**: Last 180 days (6 months)

### Tier 2 (Moderate Criteria)
- **Radius**: Wider (3mi Primary, 5mi Secondary, 10mi Tertiary)
- **Bedrooms**: ±1 bedroom
- **Square Footage**: ±20% range
- **Sale Date**: Last 365 days (12 months)

### Tier 3 (Expanded Criteria)
- **Radius**: Maximum (5mi Primary, 8mi Secondary, 15mi Tertiary)
- **Bedrooms**: ±2 bedrooms
- **Square Footage**: ±30% range
- **Sale Date**: Last 365 days (12 months)

## Cost Optimization

**IMPORTANT**: RentCast charges **per API request**, not per result.
- Always use `limit: 500` to get maximum data per request
- This is already implemented in all tier searches

## Testing

Run the test script to verify the integration:

```bash
npx tsx scripts/test-rentcast-comps.ts
```

This will search for 4-bedroom comparables near 1803 Guest Dr, Nashville using Tier 1 criteria.

## Switching Between Providers

### Option 1: Environment Variable
Edit `.env`:
```bash
# Use RentCast (default)
COMPS_PROVIDER=rentcast

# Use Realie instead
COMPS_PROVIDER=realie

# Use BatchData (if re-enabled)
COMPS_PROVIDER=batchdata
```

### Option 2: Automatic Fallback
The system automatically tries providers in this order:
1. Primary provider (from `COMPS_PROVIDER`)
2. Fallback providers (any others with API keys)
3. AI estimation (if all data providers fail)

## Data Quality

RentCast provides **significantly richer data** than Realie:
- ✅ Sale prices and dates
- ✅ Tax assessments (multiple years)
- ✅ Property taxes
- ✅ Owner information and occupancy status
- ✅ Detailed features (cooling, heating, garage, etc.)
- ✅ Lot size
- ✅ Complete property history
- ✅ Legal descriptions
- ✅ Subdivision and zoning info

## Integration Points

### Submit Route
The underwriting submit route ([src/app/api/underwrite/submit/route.ts:193-226](src/app/api/underwrite/submit/route.ts)) now uses the provider abstraction:

```typescript
const { getPropertyEstimates, hasAvailableProvider } = await import("@/lib/comps/provider");

if (hasAvailableProvider()) {
  const result = await getPropertyEstimates(formData);
  // result.providerUsed tells you which API was used
}
```

## Files Created/Modified

### New Files
- `src/lib/rentcast/client.ts`
- `src/lib/rentcast/types.ts`
- `src/lib/rentcast/comps.ts`
- `src/lib/rentcast/underwriting.ts`
- `src/lib/comps/provider.ts`
- `src/lib/comps/types.ts`
- `scripts/test-rentcast-comps.ts`

### Modified Files
- `src/app/api/underwrite/submit/route.ts` - Uses provider abstraction
- `.env.example` - Added RentCast configuration
- `.env` - Added RentCast API key

## Next Steps

1. Monitor API usage and costs in RentCast dashboard
2. Adjust tier criteria based on comp quality
3. Consider caching results to reduce API calls
4. Add analytics to track which provider is used most often
