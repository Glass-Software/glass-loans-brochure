# Stripe Setup Guide - Underwrite Pro

This guide walks you through setting up Stripe products and configuring the Underwrite Pro subscription system.

## Prerequisites

- Stripe account (create at [https://stripe.com](https://stripe.com))
- Access to Stripe Dashboard

## Step 1: Create Stripe Products (Test Mode)

**IMPORTANT:** Start in **Test Mode** for development. Switch to Live Mode only after full testing.

### 1.1 Switch to Test Mode

1. Go to Stripe Dashboard: [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Toggle the switch in the top right corner to **"Test Mode"** (should show "Viewing test data")

### 1.2 Create Product 1: "Underwrite Pro" (Regular Pricing)

1. Navigate to: **Products** → **Add product**
2. Product details:
   - **Name:** `Underwrite Pro`
   - **Description:** `100 underwriting reports per month with AI-powered analysis, permanent report storage, PDF exports, and priority support.`
   - **Image:** (Optional) Upload a product image

3. **Monthly Price:**
   - Click "Add another price"
   - **Price:** `$129.00`
   - **Billing period:** `Monthly`
   - **Price ID:** Copy this (e.g., `price_test_abc123...`) → Save as `STRIPE_PRICE_MONTHLY_REGULAR`

4. **Annual Price:**
   - Click "Add another price"
   - **Price:** `$1199.00`
   - **Billing period:** `Yearly`
   - **Price ID:** Copy this (e.g., `price_test_def456...`) → Save as `STRIPE_PRICE_ANNUAL_REGULAR`

5. Click **Save product**

### 1.3 Create Product 2: "Underwrite Pro (Limited Offer)" (Promo Pricing)

1. Navigate to: **Products** → **Add product**
2. Product details:
   - **Name:** `Underwrite Pro (Limited Offer)`
   - **Description:** `Limited-time promotional pricing for users who reach their free limit. Same features as regular Pro.`
   - **Image:** (Optional) Same as regular Pro

3. **Monthly Promo Price:**
   - Click "Add another price"
   - **Price:** `$99.00`
   - **Billing period:** `Monthly`
   - **Price ID:** Copy this (e.g., `price_test_ghi789...`) → Save as `STRIPE_PRICE_MONTHLY_PROMO`

4. **Annual Promo Price:**
   - Click "Add another price"
   - **Price:** `$799.00`
   - **Billing period:** `Yearly`
   - **Price ID:** Copy this (e.g., `price_test_jkl012...`) → Save as `STRIPE_PRICE_ANNUAL_PROMO`

5. Click **Save product**

## Step 2: Configure Webhook Endpoint (Test Mode)

### 2.1 Create Webhook Endpoint

1. Navigate to: **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:** `https://glassloans.io/api/stripe/webhook`
3. **Description:** `Underwrite Pro subscription events`
4. **Events to send:**
   - Click "Select events"
   - Select the following events:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Click "Add events"
5. Click **Add endpoint**

### 2.2 Get Webhook Signing Secret

1. After creating the endpoint, click on it to view details
2. Under "Signing secret", click **Reveal**
3. Copy the secret (starts with `whsec_test_...`)
4. Save as `STRIPE_WEBHOOK_SECRET` in your environment variables

## Step 3: Get API Keys (Test Mode)

1. Navigate to: **Developers** → **API keys**
2. You should see two keys:
   - **Publishable key** (starts with `pk_test_...`)
     - Copy this → Save as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (starts with `sk_test_...`)
     - Click "Reveal" → Copy this → Save as `STRIPE_SECRET_KEY`

## Step 4: Set Environment Variables

Create a `.env.local` file (or update `.env`) with the following:

```bash
# Stripe Test Mode
STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
STRIPE_WEBHOOK_SECRET=whsec_test_your_actual_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key

# Stripe Price IDs (from Step 1)
STRIPE_PRICE_MONTHLY_REGULAR=price_test_your_monthly_regular_id
STRIPE_PRICE_ANNUAL_REGULAR=price_test_your_annual_regular_id
STRIPE_PRICE_MONTHLY_PROMO=price_test_your_monthly_promo_id
STRIPE_PRICE_ANNUAL_PROMO=price_test_your_annual_promo_id

# Base URL (for redirects)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # For local dev
# NEXT_PUBLIC_BASE_URL=https://glassloans.io  # For production
```

## Step 5: Update deploy.sh (For Production Deployment)

Open `/Users/tydoo/glass-loans-brochure-modified/scripts/deploy.sh` and add the Stripe publishable key build arg:

```bash
fly deploy \
  --build-arg NEXT_PUBLIC_MAPBOX_API_KEY="..." \
  --build-arg NEXT_PUBLIC_GOOGLE_PLACES_API_KEY="..." \
  --build-arg NEXT_PUBLIC_RECAPTCHA_SITE_KEY="..." \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..." # Add this line
```

## Step 6: Set Fly.io Secrets (For Production)

```bash
# Set Stripe secrets on Fly.io
fly secrets set STRIPE_SECRET_KEY=sk_test_your_key
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_test_your_secret

# Set Stripe price IDs
fly secrets set STRIPE_PRICE_MONTHLY_REGULAR=price_test_...
fly secrets set STRIPE_PRICE_ANNUAL_REGULAR=price_test_...
fly secrets set STRIPE_PRICE_MONTHLY_PROMO=price_test_...
fly secrets set STRIPE_PRICE_ANNUAL_PROMO=price_test_...
```

## Step 7: Test Locally

### 7.1 Install Stripe CLI (Optional but Recommended)

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login
stripe login
```

### 7.2 Forward Webhooks to Localhost

```bash
# In a separate terminal
stripe listen --forward-to localhost:3000/api/stripe/webhook

# This will output a webhook signing secret (whsec_...)
# Update your .env.local with this secret for local testing
```

### 7.3 Test Checkout Flow

1. Start your dev server: `npm run dev`
2. Visit: `http://localhost:3000/underwrite-pro`
3. Click "Get Started" on either pricing plan
4. Use Stripe test card: `4242 4242 4242 4242`
   - **Expiry:** Any future date
   - **CVC:** Any 3 digits
   - **ZIP:** Any 5 digits
5. Complete checkout
6. Check terminal for webhook events (if using Stripe CLI)

### 7.4 Test Cards

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Authentication Required:** `4000 0027 6000 3184`
- **Payment Fails:** `4000 0000 0000 0341`

Full list: [https://stripe.com/docs/testing](https://stripe.com/docs/testing)

## Step 8: Production Cutover (After Testing)

### 8.1 Create Live Mode Products

1. Switch to **Live Mode** in Stripe Dashboard
2. **Repeat Step 1** (create both products with same names/prices)
3. Copy the **live price IDs** (will start with `price_live_...`)

### 8.2 Create Live Mode Webhook

1. Switch to **Live Mode**
2. **Repeat Step 2** (create webhook endpoint with same URL)
3. Copy the **live webhook secret** (starts with `whsec_live_...`)

### 8.3 Get Live API Keys

1. Navigate to: **Developers** → **API keys** (in Live Mode)
2. Copy:
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)

### 8.4 Update Environment Variables

```bash
# Update Fly.io secrets with LIVE keys
fly secrets set STRIPE_SECRET_KEY=sk_live_your_live_key
fly secrets set STRIPE_WEBHOOK_SECRET=whsec_live_your_live_secret

# Update Stripe price IDs with LIVE price IDs
fly secrets set STRIPE_PRICE_MONTHLY_REGULAR=price_live_...
fly secrets set STRIPE_PRICE_ANNUAL_REGULAR=price_live_...
fly secrets set STRIPE_PRICE_MONTHLY_PROMO=price_live_...
fly secrets set STRIPE_PRICE_ANNUAL_PROMO=price_live_...
```

### 8.5 Update deploy.sh with Live Publishable Key

```bash
--build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_your_live_key"
```

### 8.6 Deploy

```bash
./scripts/deploy.sh
```

## Step 9: Monitor First Transactions

1. **Stripe Dashboard** → **Payments** → Watch for incoming charges
2. **Fly.io Logs:** `fly logs -a glass-loans-brochure-modified-misty-thunder-1484`
3. **Webhook Events:** Developers → Webhooks → Click your endpoint → See delivery log
4. **Database:** Check subscription records are created correctly

## Troubleshooting

### Webhook Not Firing

1. Check webhook endpoint is active: Developers → Webhooks → Status should be "Active"
2. Check endpoint URL is correct: `https://glassloans.io/api/stripe/webhook`
3. Check logs in Stripe Dashboard: Click webhook → View events → Check for errors
4. Verify `STRIPE_WEBHOOK_SECRET` is set correctly

### Checkout Session Creation Fails

1. Check `STRIPE_SECRET_KEY` is set
2. Check price IDs are correct (must match Stripe dashboard)
3. Check Fly.io logs for detailed error: `fly logs -a glass-loans-brochure-modified-misty-thunder-1484`

### Invalid Price ID Error

1. Verify price IDs in environment variables match Stripe dashboard
2. Ensure you're using Test Mode price IDs with Test Mode keys, and Live Mode price IDs with Live Mode keys
3. Check for typos in price IDs

## Next Steps

After Stripe is configured:

1. **Phase 2:** Implement webhook handler (`/api/stripe/webhook/route.ts`) - See IMPLEMENTATION_PLAN_PRO.md
2. **Phase 3:** Add authentication system for Pro users
3. **Phase 4:** Build Pro user dashboard
4. **Phase 5:** Landing page is complete! ✅
5. **Phase 6:** Add upgrade modal for free users hitting limit

## Resources

- [Stripe Testing Cards](https://stripe.com/docs/testing)
- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
