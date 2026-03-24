# Underwrite Pro Implementation Plan

## Overview

Add a subscription system for "Underwrite Pro" with pricing tiers:

- **Monthly**: $129/month (100 analyses/month)
- **Annual**: $799/year (100 analyses/month, saves $749/year)
- **Promotional**: $99/month (one-time offer for users hitting free limit)

Free users get 5 analyses (increased from 3).

**New Features:**
- Authentication system for Pro users (no email codes after login)
- Dashboard to view all underwriting reports
- Session-based authentication for seamless experience

---

## 1. Database Schema Changes

### New Migration: 014_add_subscriptions_and_auth.sqlite.sql

**subscriptions table:**

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_type TEXT NOT NULL CHECK(plan_type IN ('monthly', 'annual', 'promotional')),
  status TEXT NOT NULL CHECK(status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing')),
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (DATETIME('now')),
  updated_at TEXT DEFAULT (DATETIME('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
```

**sessions table (for authenticated Pro users):**

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (DATETIME('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
```

**Add new columns to users table:**

```sql
-- For monthly usage resets
ALTER TABLE users ADD COLUMN usage_period_start TEXT DEFAULT (DATETIME('now'));

-- For authentication
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN last_login TEXT;

-- For promotional pricing tracking
ALTER TABLE users ADD COLUMN promo_offer_shown INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN promo_offer_used INTEGER DEFAULT 0;
```

---

## 2. Usage Logic for Pro Users

### Free Users (No Subscription)

- `usage_limit = 5` (lifetime)
- `usage_count` increments forever
- No reset

### Pro Users (Active Subscription)

- `usage_limit = 100` (per month)
- `usage_count` resets to 0 when `usage_period_start` is older than 30 days
- On each request:
  1. Check if 30 days have passed since `usage_period_start`
  2. If yes: reset `usage_count = 0`, update `usage_period_start = now()`
  3. Check if `usage_count < 100`
  4. If yes: allow request and increment

---

## 3. Stripe Integration

### Environment Variables

```bash
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_MONTHLY=price_...           # Regular $129/mo
STRIPE_PRICE_ID_PROMOTIONAL=price_...       # Promo $99/mo
STRIPE_PRICE_ID_ANNUAL=price_...            # $799/yr
JWT_SECRET=...                               # For session tokens
```

### Required npm packages

```bash
npm install stripe @stripe/stripe-js bcryptjs
npm install -D @types/bcryptjs
npm install swr  # For client-side data fetching (dashboard, auth status)
```

### Stripe Products/Prices to Create

1. **Underwrite Pro - Monthly (Regular)**
   - $129/month
   - Recurring billing

2. **Underwrite Pro - Monthly (Promotional)**
   - $99/month
   - One-time offer for first-time limit-reached users
   - Recurring at $99/month (locked in rate)

3. **Underwrite Pro - Annual**
   - $799/year
   - Recurring billing (annual)

---

## 4. API Routes

### `/api/stripe/create-checkout-session` (POST)

- Creates Stripe Checkout session
- Accepts: `{ email, priceId, successUrl, cancelUrl }`
- Returns: `{ sessionId }`
- Includes user's email as customer email
- Metadata: `{ userId, userEmail }`

### `/api/stripe/webhook` (POST)

- Handles Stripe webhooks
- Events to handle:
  - `checkout.session.completed` → Create subscription in DB
  - `customer.subscription.updated` → Update subscription status
  - `customer.subscription.deleted` → Mark subscription as canceled
  - `invoice.payment_succeeded` → Update period dates
  - `invoice.payment_failed` → Mark as past_due

### `/api/stripe/create-portal-session` (POST)

- Creates Stripe Customer Portal session
- Accepts: `{ email }`
- Returns: `{ url }`
- Allows users to manage billing, cancel subscription, update payment method

### `/api/stripe/subscription-status` (GET)

- Get current user's subscription status
- Accepts: `{ email }` or session token
- Returns: `{ subscription, isActive, usageCount, usageLimit, usageResetDate }`

### `/api/stripe/check-promo-eligibility` (POST)

- Check if user is eligible for $99/mo promotional offer
- Accepts: `{ email }`
- Returns: `{ eligible: boolean, priceId: string }`
- Logic: eligible if `usage_count >= 5` AND `promo_offer_used = 0`

---

## 5. Authentication API Routes

### `/api/auth/signup` (POST)

- Create account with password (for Pro users after checkout)
- Accepts: `{ email, password }`
- Returns: `{ success: boolean, sessionToken: string }`
- Hashes password with bcrypt
- Creates session token (JWT or crypto random)
- Sets HTTP-only cookie

### `/api/auth/login` (POST)

- Login existing user
- Accepts: `{ email, password }`
- Returns: `{ success: boolean, sessionToken: string }`
- Verifies password
- Creates session
- Sets HTTP-only cookie

### `/api/auth/logout` (POST)

- Logout current user
- Clears session from DB
- Clears HTTP-only cookie

### `/api/auth/me` (GET)

- Get current authenticated user
- Reads session token from cookie
- Returns: `{ user, subscription, usageCount, usageLimit }`

### `/api/auth/session` (middleware)

- Validates session token
- Used by other API routes to check authentication
- Skips email verification for authenticated Pro users

---

## 6. Dashboard API Routes

### `/api/dashboard/reports` (GET)

- Get all reports for authenticated user
- Requires: Valid session token
- Returns: `{ reports: UnderwritingSubmission[] }`
- Sorted by created_at DESC

### `/api/dashboard/report/:id` (GET)

- Get single report by ID
- Requires: Valid session token + user owns report
- Returns: `{ report: UnderwritingSubmission }`

---

## 7. Frontend Components

### 5.1 Landing Page: `/underwrite-pro`

**Purpose:** Marketing page for Underwrite Pro

**Sections:**

1. **Hero Section**

   - Headline: "Underwrite More. Grow Faster."
   - Subheadline: "Upgrade to Pro and unlock 100 analyses per month"
   - CTA: "Start Pro Now" → Pricing section

2. **Pricing Comparison**

   - Free vs Pro side-by-side table
   - Free: 5 analyses total
   - Pro: 100/month, priority support (future), advanced features (future)

3. **Pricing Cards**

   - Monthly: $129/mo (regular price)
   - Annual: $799/yr (Save $749/year badge)
   - Note: First-time users get special $99/mo offer when hitting free limit
   - Both CTAs → Stripe Checkout

4. **FAQ**

   - What happens to my unused analyses?
   - Can I cancel anytime?
   - Do I get a refund?
   - What payment methods do you accept?

5. **Footer CTA**
   - "Ready to scale your business?"
   - Button → Pricing

### 7.2 Upgrade Modal Component (with Promotional Offer)

**Shown when:** User hits their 5 free analysis limit

**Design (First-Time Limit Reached - Promotional Offer):**

```
┌────────────────────────────────────────────────┐
│  You've Used All 5 Free Analyses! 🎉          │
│                                                │
│  🔥 SPECIAL ONE-TIME OFFER                     │
│  Unlock Underwrite Pro for just $99/mo        │
│  (Regular price: $129/mo)                     │
│                                                │
│  ✓ 100 analyses per month                     │
│  ✓ Monthly usage resets                       │
│  ✓ Dashboard to view all your reports         │
│  ✓ No more email verification codes           │
│  ✓ Lock in $99/mo forever                     │
│                                                │
│  [Claim $99/mo Offer] [View All Plans]        │
│                                                │
│  This offer expires when you close this modal │
└────────────────────────────────────────────────┘
```

**Logic:**
- Check `/api/stripe/check-promo-eligibility` endpoint
- If eligible (first time hitting limit): show promotional offer
- If not eligible: show regular pricing
- After user dismisses modal, set `promo_offer_shown = 1`
- If user completes promo checkout, set `promo_offer_used = 1`

**Files:**

- `src/components/UpgradeModal.tsx`
- Triggered from `Step5EmailVerification.tsx` when `limitReached: true`
- Also shown in `/api/underwrite/submit` error response

### 7.3 Dashboard Page: `/dashboard`

**Purpose:** View all underwriting reports (Pro users only)

**Features:**

1. **Reports List**
   - Table view with columns:
     - Property Address
     - Purchase Price
     - ARV (Gary's estimate)
     - Score
     - Date Created
     - Actions (View Report)
   - Pagination (20 per page)
   - Search/filter by address

2. **Usage Stats Card**
   - "You've used X of 100 analyses this month"
   - Progress bar
   - "Resets on [date]"

3. **Quick Actions**
   - [New Analysis] button → `/underwrite`
   - [Account Settings] button → `/account`

**Access Control:**
- Requires authentication (redirect to login if not authenticated)
- Free users see: "Upgrade to Pro to access dashboard"

**Files:**
- `src/app/dashboard/page.tsx`

### 7.4 Login/Signup Pages

**Login Page: `/login`**

Simple form:
- Email input
- Password input
- [Login] button
- "Don't have an account? Sign up after upgrading"
- Link to password reset (future)

**Signup Flow:**
- After successful Stripe checkout, redirect to `/signup?session_id=xxx`
- Pre-fill email from Stripe session
- User sets password
- Creates account + session
- Redirects to `/dashboard`

**Files:**
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`

### 7.5 Account/Billing Page: `/account`

**Purpose:** Manage subscription and view usage

**Sections:**

1. **Account Info**

   - Email
   - Plan: Free / Pro (Monthly) / Pro (Annual)

2. **Usage Stats**

   - "You've used X of Y analyses this month"
   - Progress bar
   - Reset date (Pro users only)

3. **Subscription Management** (Pro users only)

   - Current plan
   - Next billing date
   - Amount
   - [Manage Billing] button → Stripe Customer Portal

4. **Upgrade Section** (Free users)
   - [Upgrade to Pro] button → `/underwrite-pro`

---

## 8. Authentication Flow for Pro Users

### Key Concept: Skip Email Verification for Authenticated Pro Users

**Problem:** Current flow requires email verification code on every report submission.

**Solution:** Pro users with active subscriptions can login with password and skip email verification.

### Updated Submission Flow

**For Authenticated Pro Users:**
1. User logs in at `/login` (sets session cookie)
2. User fills out underwriting form (Steps 1-4)
3. **Step 5 is SKIPPED** (no email verification needed)
4. User goes directly to Step 6 (comp selection)
5. Submit report → API checks session token instead of email code

**For Free Users / Non-Authenticated:**
1. Current flow unchanged
2. Must enter email and verify with 6-digit code

### Implementation in `/api/underwrite/submit/route.ts`

```typescript
// At the start of the API route:

// Check for authenticated user session
const sessionToken = req.cookies.get('session_token')?.value;
let user: User | null = null;
let isAuthenticated = false;

if (sessionToken) {
  const session = await validateSession(sessionToken);
  if (session) {
    user = await findUserById(session.user_id);
    isAuthenticated = true;
  }
}

// If not authenticated, check for email from body (old flow)
if (!user) {
  const email = formData.get("email");
  if (!email) {
    return sendError(controller, "Email is required", "EMAIL_REQUIRED");
  }
  user = findVerifiedUserByEmail(normalizeEmail(email));
  if (!user || !user.email_verified) {
    return sendError(controller, "Email not verified", "EMAIL_NOT_VERIFIED");
  }
}

// Check if user has active subscription
const subscription = getActiveSubscription(user.id);

if (subscription) {
  // Pro user - check monthly limit with reset
  const periodStart = new Date(user.usage_period_start || user.created_at);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Reset usage if period expired
  if (periodStart < thirtyDaysAgo) {
    resetMonthlyUsage(user.id);
    user.usage_count = 0;
    user.usage_limit = 100;
  } else {
    user.usage_limit = 100;
  }
}

// Now check limit (works for both free and Pro users)
if (user.usage_count >= user.usage_limit) {
  const message = subscription
    ? `You've reached your monthly limit of 100 analyses. Your usage resets on ${nextResetDate}.`
    : `You've reached your limit of 5 free analyses. Upgrade to Pro for 100 analyses per month.`;

  sendError(controller, message, "USAGE_LIMIT");
  controller.close();
  return;
}
```

### Frontend Changes for Authenticated Users

In `src/components/Underwriting/MultiStepForm.tsx`:

```typescript
// Check authentication status on mount
const { data: authStatus } = useSWR('/api/auth/me');

// If authenticated Pro user, skip Step 5
const steps = authStatus?.subscription
  ? [Step1, Step2, Step3, Step4, Step6, FinalSubmit] // Skip Step5
  : [Step1, Step2, Step3, Step4, Step5, Step6, FinalSubmit]; // Full flow
```

---

## 9. Database Query Functions to Add

In `src/lib/db/queries.ts`:

```typescript
// Subscription Interface
export interface Subscription {
  id: number;
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_type: "monthly" | "annual" | "promotional";
  status: "active" | "past_due" | "canceled" | "incomplete" | "trialing";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: number;
  created_at: string;
  updated_at: string;
}

// Session Interface
export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
}

// Subscription Functions
export function getActiveSubscription(userId: number): Subscription | null;
export function createSubscription(data: CreateSubscriptionData): Subscription;
export function updateSubscription(
  subscriptionId: number,
  updates: Partial<Subscription>,
): void;
export function cancelSubscription(userId: number): void;
export function resetMonthlyUsage(userId: number): void;
export function getSubscriptionByStripeId(
  stripeSubscriptionId: string,
): Subscription | null;

// Authentication Functions
export function createSession(userId: number): { session: Session; token: string };
export function validateSession(sessionToken: string): Session | null;
export function deleteSession(sessionToken: string): void;
export function cleanupExpiredSessions(): void;
export function setPassword(userId: number, passwordHash: string): void;
export function verifyPassword(email: string, password: string): User | null;
export function findUserById(userId: number): User | null;

// Promotional Offer Functions
export function markPromoOfferShown(userId: number): void;
export function markPromoOfferUsed(userId: number): void;
export function isPromoEligible(userId: number): boolean;
```

---

## 10. Deployment Steps

1. **Create Stripe Products:**

   - Log in to Stripe Dashboard
   - Create three recurring products with pricing:
     - Monthly Regular: $129/mo
     - Monthly Promotional: $99/mo
     - Annual: $799/yr
   - Copy all three Price IDs

2. **Set Environment Variables:**

   ```bash
   fly secrets set STRIPE_SECRET_KEY="sk_live_..."
   fly secrets set STRIPE_WEBHOOK_SECRET="whsec_..."
   fly secrets set STRIPE_PRICE_ID_MONTHLY="price_..."
   fly secrets set STRIPE_PRICE_ID_PROMOTIONAL="price_..."
   fly secrets set STRIPE_PRICE_ID_ANNUAL="price_..."
   fly secrets set JWT_SECRET="$(openssl rand -base64 32)"
   # Public key via build arg in deploy.sh
   ```

3. **Run Migration:**

   ```bash
   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
   npx tsx scripts/migrate.ts
   ```

4. **Configure Stripe Webhook:**
   - Endpoint URL: `https://glassloans.io/api/stripe/webhook`
   - Events to listen:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

---

## 11. Testing Checklist

### Free User Flow
- [ ] New user gets 5 free analyses
- [ ] Free user hits limit after 5th submission
- [ ] Upgrade modal shows with $99/mo promotional offer
- [ ] Modal marks `promo_offer_shown = 1` on dismiss
- [ ] User can complete promotional checkout at $99/mo
- [ ] Webhook creates subscription with `plan_type = 'promotional'`
- [ ] User redirected to `/signup` to set password
- [ ] Account created successfully

### Pro User Authentication
- [ ] Pro user can login at `/login` with email + password
- [ ] Session cookie is set on successful login
- [ ] Dashboard shows all previous reports
- [ ] Dashboard shows usage stats (X of 100 this month)
- [ ] Pro user can submit reports without email verification (Step 5 skipped)
- [ ] Pro user can submit up to 100 analyses per month
- [ ] Usage resets after 30 days
- [ ] Pro user can logout

### Promotional Pricing
- [ ] First-time limit-reached user sees $99/mo offer
- [ ] Second visit after dismissing shows regular $129/mo price
- [ ] User who used promo never sees it again
- [ ] Promo-locked users continue at $99/mo on renewal

### Subscription Management
- [ ] Pro user can access Stripe Customer Portal from `/account`
- [ ] Annual plan correctly charges $799/year
- [ ] Monthly plan charges $129/month (regular) or $99/month (promo)
- [ ] Canceled Pro user loses dashboard access
- [ ] Canceled Pro user reverts to 5 free analyses

### Edge Cases
- [ ] Authenticated user with expired subscription can't submit
- [ ] Non-Pro user trying to access `/dashboard` redirected to upgrade
- [ ] Session expiration logs user out automatically
- [ ] Password reset flow works (future feature)

---

## 12. Future Enhancements

- **Team Plans:** Multiple users under one subscription
- **Usage Analytics:** Dashboard showing daily/weekly usage trends
- **Priority Support:** Dedicated support channel for Pro users
- **White-label Reports:** Custom branding on reports
- **API Access:** Programmatic access to underwriting API
- **Custom Models:** Ability to tweak Gary's analysis parameters

---

## 13. Files to Create/Modify

### New Files:

**Database & Migrations:**
1. `src/lib/db/migrations/014_add_subscriptions_and_auth.sqlite.sql`

**Stripe API Routes:**
2. `src/app/api/stripe/create-checkout-session/route.ts`
3. `src/app/api/stripe/webhook/route.ts`
4. `src/app/api/stripe/create-portal-session/route.ts`
5. `src/app/api/stripe/subscription-status/route.ts`
6. `src/app/api/stripe/check-promo-eligibility/route.ts`
7. `src/lib/stripe.ts` (Stripe client initialization)

**Authentication API Routes:**
8. `src/app/api/auth/signup/route.ts`
9. `src/app/api/auth/login/route.ts`
10. `src/app/api/auth/logout/route.ts`
11. `src/app/api/auth/me/route.ts`
12. `src/lib/auth.ts` (Session validation middleware)

**Dashboard API Routes:**
13. `src/app/api/dashboard/reports/route.ts`
14. `src/app/api/dashboard/report/[id]/route.ts`

**Frontend Pages:**
15. `src/app/underwrite-pro/page.tsx` (Marketing/landing page)
16. `src/app/dashboard/page.tsx` (Reports dashboard - Pro only)
17. `src/app/login/page.tsx` (Login page)
18. `src/app/signup/page.tsx` (Post-checkout signup)
19. `src/app/account/page.tsx` (Account/billing management)

**Frontend Components:**
20. `src/components/UpgradeModal.tsx` (With promo offer logic)
21. `src/components/PricingCard.tsx` (Pricing display component)
22. `src/components/DashboardNav.tsx` (Navigation for authenticated users)
23. `src/components/ReportsTable.tsx` (Dashboard table component)

### Modified Files:

1. `src/lib/db/queries.ts` - Add subscription, auth, and promo queries
2. `src/app/api/underwrite/submit/route.ts` - Auth check & limit logic
3. `src/components/Underwriting/MultiStepForm.tsx` - Skip Step 5 for Pro users
4. `src/components/Underwriting/Step5EmailVerification.tsx` - Show upgrade modal
5. `scripts/migrate.ts` - Add migration 014
6. `scripts/deploy.sh` - Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY build arg
7. `.env.example` - Document all new env vars
8. `CLAUDE.md` - Update with subscription and auth system docs

---

## 14. Summary

This plan implements a complete subscription and authentication system with:

**Pricing:**
- Free tier: 5 analyses (lifetime)
- Pro Monthly: $129/month (100 analyses/month)
- Pro Promotional: $99/month (one-time offer for first-time limit-reached users)
- Pro Annual: $799/year (100 analyses/month, saves $749/year)

**Key Features:**
- Authentication system for Pro users (login with email + password)
- Skip email verification for authenticated Pro users
- Dashboard to view all reports
- Monthly usage resets for Pro users
- Stripe integration with checkout and billing portal
- Marketing landing page
- Promotional pricing for first-time conversions
- Account management page
- Session-based authentication

**User Flows:**
1. **Free User:** Submit 5 reports with email verification → Hit limit → See $99/mo promo offer
2. **New Pro User:** Subscribe → Create password → Login → Submit reports without email verification → View all reports in dashboard
3. **Returning Pro User:** Login → Dashboard → Submit reports seamlessly

The system is designed to scale and allows for future enhancements like team plans, priority support, and API access.
