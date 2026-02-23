# AI Underwriting Tool - Testing Guide

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Local PostgreSQL

#### Option A: Docker (Recommended)

```bash
# Run Postgres in Docker
docker run -d \
  --name glass-loans-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=glass_loans \
  -p 5432:5432 \
  postgres:15

# Update .env with local connection
DATABASE_URL=postgresql://postgres:password@localhost:5432/glass_loans
```

#### Option B: Homebrew (macOS)

```bash
# Install Postgres
brew install postgresql@15

# Start Postgres
brew services start postgresql@15

# Create database
createdb glass_loans

# Update .env
DATABASE_URL=postgresql://localhost:5432/glass_loans
```

### 3. Run Database Migrations

```bash
# Connect to database
psql $DATABASE_URL

# Run migration (paste SQL from file)
\i src/lib/db/migrations/001_initial_schema.sql

# Verify tables created
\dt

# Exit
\q
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Required for local development
DATABASE_URL=postgresql://localhost:5432/glass_loans
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Email (use your SendGrid test key)
SENDGRID_API_KEY=your_test_key
SENDGRID_FROM_EMAIL=test@example.com

# Optional for testing (skip if not available)
ABSTRACT_API_KEY=your_test_key
OPENROUTER_API_KEY=your_test_key

# reCAPTCHA (use test keys or skip for local)
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI

# JWT
JWT_SECRET=test_secret_key_min_32_characters_long
```

**Note**: The reCAPTCHA keys above are Google's official test keys. They always pass validation.

### 5. Start Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## Testing Checklist

### ✅ Phase 1-2: Database & Calculations

- [ ] Database connection works
- [ ] All 3 tables created (users, underwriting_submissions, rate_limits)
- [ ] Test each calculation formula matches Excel:

```javascript
// Test in browser console on /underwrite page
const testData = {
  purchasePrice: 140000,
  rehab: 25000,
  squareFeet: 1150,
  propertyCondition: "Good",
  renovationPerSf: "Light $30/SF",
  interestRate: 12,
  months: 6,
  loanAtPurchase: 110000,
  renovationFunds: 0,
  closingCostsPercent: 6.5,
  points: 3,
  marketType: "Primary"
};

// Expected calculations:
// Renovation $/SF: 25000 / 1150 = 21.74
// Days: 6 * 30 = 180
// Total Cost: 140000 + 25000 = 165000
// Total Loan: 110000 + 0 = 110000
// Closing Costs $: 140000 * 0.065 = 9100
// Points $: 110000 * 0.03 = 3300
// Per Diem: (110000 * 0.12) / 360 = 36.67
// Total Interest: 36.67 * 180 = 6600
// etc.
```

### ✅ Phase 3: Multi-Step Form

- [ ] Step 1: Property details form displays
  - [ ] Address input works
  - [ ] Purchase price formats with commas (e.g., "140,000")
  - [ ] Rehab budget formats with commas
  - [ ] Square feet formats with commas
  - [ ] Validation shows errors for empty fields
  - [ ] Can proceed to next step

- [ ] Step 2: Property condition
  - [ ] Property condition dropdown shows 3 options
  - [ ] Renovation level dropdown shows 3 options
  - [ ] "Previous" button works
  - [ ] Can proceed to next step

- [ ] Step 3: Loan terms
  - [ ] Interest rate input works
  - [ ] Months input works
  - [ ] Loan at purchase formats with commas
  - [ ] Renovation funds formats with commas
  - [ ] Closing costs percent input works
  - [ ] Points percent input works
  - [ ] Can go back and forward

- [ ] Step 4: Market details
  - [ ] Market type dropdown works (Primary/Secondary/Tertiary)
  - [ ] Additional details textarea works
  - [ ] 3 comp link inputs display
  - [ ] Can paste URLs into comp links
  - [ ] Can proceed to Step 5

- [ ] Step 5: Email verification
  - [ ] Email input displays
  - [ ] Shows "3 free analyses" message
  - [ ] Form progress shows 5/5 steps

### ✅ Phase 4: Email Verification

- [ ] Enter new email
  - [ ] Sends verification email (check inbox)
  - [ ] Shows "Check Your Email" screen
  - [ ] Email contains verification link
  - [ ] Link format: `http://localhost:3000/underwrite/verify?token=...`

- [ ] Click verification link
  - [ ] Redirects to `/underwrite`
  - [ ] Email marked as verified in database:
    ```sql
    SELECT email, email_verified FROM users ORDER BY created_at DESC LIMIT 1;
    ```

- [ ] Email normalization
  - [ ] Test `user+1@gmail.com` → normalizes to `user@gmail.com`
  - [ ] Test `u.ser@gmail.com` → normalizes to `user@gmail.com`
  - [ ] Cannot create multiple accounts with +1 trick

### ✅ Phase 5: AI Integration

**With OpenRouter API Key:**
- [ ] AI estimates property values
- [ ] Returns ARV, as-is value, monthly rent
- [ ] Uses user-provided comp links if available
- [ ] Gary's opinion is personalized and detailed

**Without API Key (Fallback):**
- [ ] Uses formula-based estimates
- [ ] Shows fallback message
- [ ] Generates mock Gary's opinion
- [ ] Still completes underwriting

### ✅ Phase 6: Results Display

- [ ] Results panel displays after submission
- [ ] Score card shows:
  - [ ] Final score (0-100)
  - [ ] Color coded (red/yellow/green)
  - [ ] Key metrics in grid
  - [ ] Status indicators (good/fair/poor)

- [ ] Gary's Opinion section:
  - [ ] Shows AI narrative
  - [ ] Formatted with paragraphs
  - [ ] Gary avatar icon displays

- [ ] Calculation Breakdown:
  - [ ] Expandable/collapsible
  - [ ] Shows all 20 calculations
  - [ ] Values formatted as currency or percentage
  - [ ] Organized into logical sections

- [ ] Usage tracking:
  - [ ] Shows "Analysis X of 3"
  - [ ] Shows "Start New Underwriting (X remaining)"
  - [ ] After 3rd use, shows "Want More Analyses?" CTA

- [ ] Disclaimer displayed at bottom

### ✅ Phase 7: Security & Polish

- [ ] reCAPTCHA v3:
  - [ ] No visible challenge (invisible)
  - [ ] Browser console shows reCAPTCHA loaded
  - [ ] Submission logs show score in backend
  - [ ] Score >= 0.5 required to proceed

- [ ] Rate limiting:
  - [ ] Make 10+ requests from same IP in <1 hour
  - [ ] 11th request returns 429 error
  - [ ] Error message: "Rate limit exceeded"

- [ ] Usage limits:
  - [ ] Email can submit 3 analyses
  - [ ] 4th attempt shows "limit reached" error
  - [ ] Database shows usage_count = 3:
    ```sql
    SELECT email, usage_count FROM users WHERE email = 'test@example.com';
    ```

- [ ] Number formatting:
  - [ ] All currency inputs show commas while typing
  - [ ] Placeholder shows formatted examples
  - [ ] Stored as numbers in database

- [ ] Loading states:
  - [ ] "Processing..." button while submitting
  - [ ] Button disabled during submission
  - [ ] Cannot double-submit

### ✅ Phase 8: End-to-End Flow

Complete a full underwriting submission:

1. **Start Form**
   - [ ] Visit http://localhost:3000/underwrite
   - [ ] Progress indicator shows Step 1/5

2. **Fill Step 1**
   - [ ] Property Address: "123 Main St, Atlanta, GA 30303"
   - [ ] Purchase Price: 140000 → displays as "140,000"
   - [ ] Rehab Budget: 25000 → displays as "25,000"
   - [ ] Square Feet: 1150 → displays as "1,150"
   - [ ] Click "Next Step"

3. **Fill Step 2**
   - [ ] Property Condition: "Good"
   - [ ] Renovation $/SF: "Light $30/SF"
   - [ ] Click "Next Step"

4. **Fill Step 3**
   - [ ] Interest Rate: 12
   - [ ] Loan Term: 6 months
   - [ ] Loan at Purchase: 110000 → displays as "110,000"
   - [ ] Renovation Funds: 0 → displays as "0"
   - [ ] Closing Costs: 6.5%
   - [ ] Points: 3%
   - [ ] Click "Next Step"

5. **Fill Step 4**
   - [ ] Market Type: "Primary"
   - [ ] Additional Details: "Strong rental market, recent comps trending up"
   - [ ] Comp 1: (optional) paste a Zillow URL
   - [ ] Click "Next: Get Results"

6. **Email Verification**
   - [ ] Enter email: `test+underwriting@example.com`
   - [ ] Click "Get Gary's Opinion"
   - [ ] See "Check Your Email" screen
   - [ ] Receive email with verification link
   - [ ] Click link → redirects to /underwrite

7. **Complete Submission**
   - [ ] Fill form again (data should be preserved)
   - [ ] Submit with verified email
   - [ ] See results panel

8. **Verify Results**
   - [ ] Score displayed (e.g., 75/100)
   - [ ] Gary's opinion shows personalized analysis
   - [ ] All calculations match expected values
   - [ ] Usage shows "Analysis 1 of 3"
   - [ ] "Start New" button appears

9. **Test Usage Limit**
   - [ ] Click "Start New Underwriting"
   - [ ] Fill and submit 2 more times
   - [ ] After 3rd submission, shows usage limit reached
   - [ ] 4th attempt blocked

### Database Verification

After testing, verify data in database:

```sql
-- Check user created
SELECT * FROM users WHERE email LIKE '%test%';

-- Check submissions
SELECT
  s.id,
  s.property_address,
  s.purchase_price,
  s.final_score,
  s.recaptcha_score,
  s.created_at
FROM underwriting_submissions s
WHERE user_id = (SELECT id FROM users WHERE email LIKE '%test%' LIMIT 1);

-- Check all calculations stored
SELECT
  renovation_per_sf,
  estimated_arv,
  as_is_value,
  monthly_rent,
  final_score
FROM underwriting_submissions
ORDER BY created_at DESC
LIMIT 1;

-- Verify comp links stored as JSONB
SELECT comp_links FROM underwriting_submissions WHERE comp_links IS NOT NULL;

-- Check rate limits
SELECT * FROM rate_limits ORDER BY created_at DESC LIMIT 10;
```

## Manual Testing Scenarios

### Scenario 1: Strong Deal (High Score)

```
Purchase Price: $100,000
Rehab: $20,000
Square Feet: 1,200
Condition: Good
Renovation: Light $30/SF
Interest: 10%
Months: 6
Loan at Purchase: $70,000
Renovation Funds: $15,000
Closing Costs: 5%
Points: 2%
Market: Primary

Expected: Score 80-90 (low LTV, good spread)
```

### Scenario 2: Risky Deal (Low Score)

```
Purchase Price: $200,000
Rehab: $50,000
Square Feet: 1,000
Condition: Really Bad
Renovation: Heavy $70-90/SF
Interest: 15%
Months: 12
Loan at Purchase: $180,000
Renovation Funds: $40,000
Closing Costs: 8%
Points: 4%
Market: Tertiary

Expected: Score 20-40 (high LTV, low spread, risky market)
```

### Scenario 3: Email Tricks

Test email normalization:
- `john+test@gmail.com`
- `j.o.h.n@gmail.com`
- `john@gmail.com`

All should normalize to `john@gmail.com` and share the same 3-use limit.

## Common Issues & Fixes

### Issue: Database connection refused

```bash
# Check if Postgres is running
docker ps  # or
brew services list

# Restart Postgres
docker start glass-loans-postgres  # or
brew services restart postgresql@15
```

### Issue: Email not sending

Check SendGrid logs: https://app.sendgrid.com/email_activity

Or test with a mock email in dev:
```javascript
// In verify-email route, add console.log
console.log('Verification link:', verificationLink);
```

### Issue: reCAPTCHA not working locally

Use Google's test keys in `.env.local`:
```
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
```

### Issue: AI not responding

Check OpenRouter dashboard for quota/errors, or test with fallback:
```javascript
// Comment out API key in .env.local to test fallback
# OPENROUTER_API_KEY=
```

## Performance Testing

Test with realistic data volumes:

```sql
-- Create 100 test users
DO $$
BEGIN
  FOR i IN 1..100 LOOP
    INSERT INTO users (email, normalized_email, email_verified, usage_count)
    VALUES (
      'test' || i || '@example.com',
      'test' || i || '@example.com',
      true,
      FLOOR(RANDOM() * 4)
    );
  END LOOP;
END $$;

-- Check query performance
EXPLAIN ANALYZE
SELECT * FROM underwriting_submissions
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%test%')
ORDER BY created_at DESC
LIMIT 10;
```

## Success Criteria

All checkboxes above should be ✅ before deploying to production.

The application should:
- Handle all valid inputs correctly
- Validate and reject invalid inputs
- Calculate all 20 formulas exactly matching Excel
- Send emails reliably
- Enforce 3-use limit per email
- Block bots with reCAPTCHA
- Rate limit aggressive users
- Display results clearly
- Work on mobile and desktop
- Store all data correctly in Postgres
