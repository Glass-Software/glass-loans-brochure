# Testing Scripts

## Quick Test: Underwriting Form Submission

**File:** `test-underwriting-form.ts`

Skip the manual form filling and directly test the underwriting API endpoint.

### Setup

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. In `.env.local`, configure:
   ```bash
   # Comment out RECAPTCHA_SECRET_KEY to bypass reCAPTCHA validation
   # RECAPTCHA_SECRET_KEY=your_key_here

   # Use production BatchData API
   BATCHDATA_API_KEY=your_key_here
   BATCHDATA_USE_MOCK=false
   ```

3. Edit test data in `test-underwriting-form.ts`:
   ```typescript
   const testFormData = {
     propertyAddress: "YOUR ADDRESS HERE",
     purchasePrice: 450000,
     // ... modify other values as needed
   };
   ```

### Run

```bash
npx tsx scripts/test-underwriting-form.ts
```

### Output

The script will:
- Submit the form data to the API
- Stream progress updates in real-time
- Display the final underwriting results
- Show risk flags, comps, and Gary's analysis

### Example Output

```
🚀 Starting underwriting test...

Property Address: 2316 Fernwood Drive, Nashville, TN 37216
Purchase Price: $450,000
Email: test@example.com

============================================================

📡 Receiving streaming response...

📊 Progress [Step 1]: Verifying security... (10%)
📊 Progress [Step 2]: Verifying address... (20%)
📊 Progress [Step 3]: Looking up property details... (40%)
📊 Progress [Step 4]: Searching for comparable properties... (60%)
📊 Progress [Step 5]: Generating underwriting analysis... (80%)

✅ Processing complete!

============================================================
📋 UNDERWRITING RESULTS
============================================================

🎯 Gary's Recommendation: PASS
Score: 85 / 100

💰 Deal Metrics:
  ARV: $550,000
  As-Is Value: $425,000
  Total Investment: $500,000
  Profit: $50,000
  ROI: 10.0%

⚠️  Risk Flags:
  🟡 [WARNING] Property built in 1975 - higher rehab risk
  ℹ️  [INFO] Market has moderate volatility

🏘️  Comparables Used (5):
  1. 2320 Fernwood Dr - $540,000 (2,100 sqft)
  2. 2310 Fernwood Dr - $535,000 (1,950 sqft)
  ...
```

---

## Other Testing Scripts

- `test-underwriting-mock.ts` - Test with mock BatchData responses
- `test-underwriting-production.ts` - Test with production BatchData API
- `backup-db.sh` - Backup SQLite database
- `check-db-health.sh` - Check database integrity
