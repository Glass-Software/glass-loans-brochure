# Hard Money Lending Underwriting Engine

## Using BatchData API for Comparable Sales & Risk Assessment

---

## The Problem

Hard money lenders need to make fast, data-backed decisions on whether to fund a deal. Today this involves manually pulling comps, eyeballing Zillow/Redfin, and relying on gut feel. We're going to build a service that ingests a subject property address and returns a structured underwriting package — comparable sales, AVM, risk signals, and a confidence score — that can be fed directly to an LLM for narrative analysis or surfaced in your loan servicing UI.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Your RemixJS App                       │
│              (Loan Servicing Platform)                    │
│                                                          │
│  Loan Officer enters subject property address            │
│         ↓                                                │
│  POST /api/underwriting/analyze                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│            Underwriting Service (Node/TS)                 │
│                                                          │
│  1. Validate & geocode address                           │
│  2. Pull subject property details                        │
│  3. Search for comparable sales                          │
│  4. Compute risk metrics                                 │
│  5. Cache results                                        │
│  6. (Optional) Feed to LLM for narrative                 │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  BatchData   │  │   Redis/     │
│  API         │  │   Postgres   │
│              │  │   Cache      │
└──────────────┘  └──────────────┘
```

---

## BatchData API Endpoints We'll Use

Based on their developer docs, here are the specific endpoints and how they map to our underwriting workflow:

### 1. Address Verification & Geocoding

**Purpose:** Standardize the subject property address before any lookups. Prevents bad data from cascading through the pipeline.

```
POST https://api.batchdata.io/api/v1/address/verify
```

- Validates against USPS
- Returns standardized address, ZIP+4, county FIPS
- Gives us the geocoded lat/lng we'll need for radius-based comp searches

**Billing:** 1 API call

### 2. Subject Property Lookup

**Purpose:** Get the full profile of the property being used as collateral.

```
POST https://api.batchdata.io/api/v1/property/lookup
```

**Key data points we extract:**

| Data Point                              | Why It Matters for Hard Money                 |
| --------------------------------------- | --------------------------------------------- |
| Property type (SFR, multi, condo, etc.) | Determines comp strategy and LTV caps         |
| Bedrooms / bathrooms / sqft             | Primary comp matching criteria                |
| Lot size                                | Especially important for land-heavy deals     |
| Year built                              | Age = maintenance risk                        |
| Last sale date & price                  | Detects recent flips, establishes basis       |
| Tax assessed value                      | Sanity check against claimed value            |
| Tax assessment history                  | Trend: appreciating or depreciating?          |
| Current mortgage/lien info              | Existing encumbrances = senior debt risk      |
| Open liens & pre-foreclosure flags      | Distress signals                              |
| Owner name / entity type                | LLC vs individual, owner-occupied vs investor |
| Zoning code                             | Confirms intended use is permitted            |
| AVM (Automated Valuation Model)         | Machine-generated value estimate              |
| AVM confidence score                    | How much to trust the AVM                     |

**Billing:** 1 API call (returns 700+ attributes in a single response)

### 3. Comparable Sales Search

**Purpose:** Find recently sold properties that are similar to the subject — the backbone of the underwriting decision.

```
POST https://api.batchdata.io/api/v1/property/search
```

**Comp Search Strategy (3-tier approach):**

We run up to 3 searches, progressively widening criteria until we get 5-10 quality comps:

**Tier 1 — Tight Comps (best matches)**

```json
{
  "location": {
    "latitude": "<subject_lat>",
    "longitude": "<subject_lng>",
    "radius": "0.5",
    "radiusUnit": "miles"
  },
  "propertyType": "<subject_type>",
  "bedrooms": { "min": <subject_beds - 1>, "max": <subject_beds + 1> },
  "bathrooms": { "min": <subject_baths - 1>, "max": <subject_baths + 1> },
  "squareFeet": { "min": <subject_sqft * 0.8>, "max": <subject_sqft * 1.2> },
  "yearBuilt": { "min": <subject_year - 10>, "max": <subject_year + 10> },
  "lastSaleDate": { "min": "<6_months_ago>" },
  "lastSalePrice": { "min": 1 }
}
```

**Tier 2 — Wider radius if Tier 1 < 5 results**

- Expand radius to 1 mile
- Expand sale window to 12 months
- Relax sqft to ±30%

**Tier 3 — Maximum reach if Tier 2 < 5 results**

- Expand radius to 2 miles
- Expand sale window to 18 months
- Relax bed/bath by ±2
- Log a "low comp confidence" flag

**Billing:** 1 API call per search × up to 3 tiers = 1-3 API calls. Each returned property counts as a billable record.

### 4. Active Listing Search (Market Context)

**Purpose:** What's currently on the market in the area? Helps gauge supply/demand and validates the ARV if it's a rehab deal.

```
POST https://api.batchdata.io/api/v1/property/search
```

Same search parameters as comps but filtering for active listings instead of sold properties. This tells us:

- Current inventory levels (supply pressure)
- List-to-sale price ratios in the area
- Days on market trends
- Whether the borrower's exit strategy (sell or refi) is realistic

**Billing:** 1 API call

---

## Underwriting Metrics We Compute

Once we have the subject property + comps, we calculate these metrics server-side before sending anything to the LLM or UI:

### Core Valuation Metrics

```typescript
interface UnderwritingReport {
  // Subject Property
  subjectAddress: string;
  subjectPropertyType: string;
  subjectSqft: number;
  subjectBedBath: string;
  subjectLastSalePrice: number | null;
  subjectLastSaleDate: string | null;
  subjectTaxAssessedValue: number;
  subjectAVM: number;
  subjectAVMConfidence: number;

  // Comp-Derived Valuation
  compMedianPricePerSqft: number;
  compMeanPricePerSqft: number;
  compMedianSalePrice: number;
  compDerivedValue: number; // median $/sqft × subject sqft
  compCount: number;
  compTier: 1 | 2 | 3; // which search tier produced results
  compDateRange: { oldest: string; newest: string };

  // Triangulated Value (weighted blend)
  estimatedMarketValue: number; // weighted avg of AVM + comp-derived
  valueConfidence: "high" | "medium" | "low";

  // Lending Metrics
  requestedLoanAmount: number;
  loanToValue: number; // LTV = loan / estimated value
  loanToCost: number; // LTC = loan / (purchase + rehab)

  // Risk Signals
  riskFlags: RiskFlag[];

  // Comps Detail
  comparables: CompProperty[];

  // Market Context
  activeListingCount: number;
  medianDaysOnMarket: number;
  medianListPrice: number;
}
```

### Risk Flag Detection

```typescript
type RiskFlag = {
  severity: "critical" | "warning" | "info";
  code: string;
  message: string;
};

function detectRiskFlags(subject, comps, loanRequest): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // LTV too high
  if (loanRequest.ltv > 0.75) {
    flags.push({
      severity: "critical",
      code: "HIGH_LTV",
      message: `LTV of ${(loanRequest.ltv * 100).toFixed(1)}% exceeds 75% threshold`,
    });
  }

  // Recent flip (bought < 6 months ago)
  if (subject.lastSaleDateMonthsAgo < 6) {
    flags.push({
      severity: "warning",
      code: "RECENT_ACQUISITION",
      message: `Property was purchased ${subject.lastSaleDateMonthsAgo} months ago for $${subject.lastSalePrice.toLocaleString()}`,
    });
  }

  // Value claim vs AVM divergence
  const avmDivergence =
    Math.abs(loanRequest.claimedValue - subject.avm) / subject.avm;
  if (avmDivergence > 0.2) {
    flags.push({
      severity: "warning",
      code: "VALUE_DIVERGENCE",
      message: `Claimed value diverges ${(avmDivergence * 100).toFixed(0)}% from AVM`,
    });
  }

  // Tax assessed value disconnect
  const taxDivergence =
    Math.abs(loanRequest.claimedValue - subject.taxAssessedValue) /
    subject.taxAssessedValue;
  if (taxDivergence > 0.4) {
    flags.push({
      severity: "info",
      code: "TAX_ASSESSMENT_GAP",
      message: `Claimed value is ${(taxDivergence * 100).toFixed(0)}% above tax assessed value`,
    });
  }

  // Low comp count
  if (comps.length < 3) {
    flags.push({
      severity: "warning",
      code: "LOW_COMP_COUNT",
      message: `Only ${comps.length} comparable sales found — value estimate less reliable`,
    });
  }

  // Comp tier warning
  if (comps.tier === 3) {
    flags.push({
      severity: "warning",
      code: "WIDE_COMP_SEARCH",
      message:
        "Comps required expanded search radius (2mi) and date range (18mo)",
    });
  }

  // Pre-foreclosure / distress
  if (subject.preForeclosure || subject.hasInvoluntaryLiens) {
    flags.push({
      severity: "critical",
      code: "DISTRESSED_PROPERTY",
      message: "Property shows pre-foreclosure activity or involuntary liens",
    });
  }

  // Declining market signal
  if (comps.pricePerSqftTrend < -0.05) {
    flags.push({
      severity: "warning",
      code: "DECLINING_MARKET",
      message: `Comp $/sqft trending down ${(Math.abs(comps.pricePerSqftTrend) * 100).toFixed(1)}% over comp period`,
    });
  }

  // High days on market
  if (activeListings.medianDOM > 90) {
    flags.push({
      severity: "warning",
      code: "SLOW_MARKET",
      message: `Median days on market is ${activeListings.medianDOM} — exit strategy risk`,
    });
  }

  return flags;
}
```

---

## API Cost Estimation

Here's the per-analysis cost breakdown:

| Step                            | API Calls     | Cost @ $0.01/call |
| ------------------------------- | ------------- | ----------------- |
| Address verification            | 1             | $0.01             |
| Subject property lookup         | 1             | $0.01             |
| Comp search (Tier 1)            | 1 + N results | $0.01 + $0.01×N   |
| Comp search (Tier 2, if needed) | 1 + N results | $0.01 + $0.01×N   |
| Active listings search          | 1 + N results | $0.01 + $0.01×N   |

**Typical analysis:** ~$0.15–$0.40 per property (assuming 10-15 comp/listing results returned)

**Monthly cost for 100 loan evaluations:** ~$15–$40

This is absurdly cheap compared to any appraisal or BPO service.

---

## Implementation Phases

### Phase 1: Core Pipeline (Week 1-2)

Build the underwriting service as a standalone module in your Remix app:

1. **BatchData client wrapper** — typed API client with retry logic, rate limiting, and error handling
2. **Address standardization** — verify + geocode on every new loan application
3. **Subject property lookup** — pull and cache the full property profile
4. **Comp search engine** — implement the 3-tier search strategy
5. **Metrics calculator** — compute LTV, risk flags, comp-derived values
6. **Database schema** — store results in Postgres for audit trail

### Phase 2: LLM Integration (Week 3)

Feed the structured underwriting report to Claude (or your model of choice) for:

- **Narrative underwriting summary** — "Based on 7 comparable sales within 0.5 miles sold in the last 6 months, the estimated market value is $X. The borrower's claimed value of $Y represents a Z% premium to comps..."
- **Risk narrative** — human-readable explanation of each risk flag
- **Recommendation** — "Fund at X% LTV" / "Request additional information" / "Decline"

Because we're feeding the LLM **our own verified data** (not asking it to search the internet), the output will be grounded and reliable.

### Phase 3: UI & Workflow (Week 4)

- **Underwriting dashboard** in your Remix app showing the report
- **Comp map** — plot subject + comps on a map
- **One-click PDF report** — generate a professional comp report for the loan file
- **Webhook/automation** — auto-trigger analysis when a new loan application hits the system

### Phase 4: Enhancements (Ongoing)

- **Historical tracking** — re-run analysis monthly to detect market shifts on active loans
- **Portfolio risk dashboard** — aggregate risk flags across all active loans
- **ARV estimation** — for rehab deals, adjust comp values based on planned improvements
- **Borrower profile enrichment** — use BatchData's skip tracing to verify borrower entity info

---

## Caching Strategy

To keep API costs low and response times fast:

| Data                     | Cache Duration | Rationale                                |
| ------------------------ | -------------- | ---------------------------------------- |
| Address verification     | 30 days        | Addresses don't change                   |
| Subject property details | 7 days         | Ownership/lien data can shift            |
| Comparable sales         | 24 hours       | New sales record daily                   |
| Active listings          | 4 hours        | Listings change throughout the day       |
| AVM values               | 7 days         | Models update daily but drift is minimal |

Use Redis for hot cache, Postgres for persistent storage and audit trail.

---

## MCP Server Bonus

BatchData has an official MCP server (`@zellerhaus/batchdata-mcp-real-estate`) that lets Claude query their API directly via natural language. This is interesting for two use cases:

1. **Internal tooling** — your loan officers could ask Claude questions like "Find me comps for 123 Main St within 1 mile" without touching the UI
2. **Ad-hoc analysis** — when a deal is weird and needs manual investigation beyond the standard pipeline

You could set this up alongside your automated pipeline as a power-user tool.

---

## Getting Started

1. **Sign up at** [app.batchdata.com/register](https://app.batchdata.com/register) — free tier includes test calls
2. **Get API key** from Settings → API
3. **Test with a known property** — run a property lookup on an address you already have appraisal data for, and compare BatchData's AVM against the appraised value to calibrate trust
4. **Build the client wrapper** — start with address verify → property lookup → property search
5. **Validate comp quality** — run 10-20 analyses on past deals where you know the outcome, and check whether the comp-derived value would have supported the right lending decision
