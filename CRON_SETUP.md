# Cron Job Setup - Monthly Usage Reset

This document explains how to set up the automated monthly usage reset for Pro users using Fly.io's cron-manager.

## Overview

Pro users have their `usageCount` reset to 0 every 30 days based on their `usagePeriodStart` date. This cron job runs daily at 3 AM UTC to check all Pro users and reset those whose billing period has ended.

## Architecture

1. **Cron API Endpoint**: [src/app/api/cron/reset-usage/route.ts](src/app/api/cron/reset-usage/route.ts)
   - Handles the actual usage reset logic
   - Protected by `CRON_SECRET` bearer token
   - Returns details of reset users for monitoring

2. **Cron Configuration**: [cron.json](cron.json)
   - Defines the schedule (daily at 3 AM UTC)
   - Specifies the endpoint to call
   - Includes authorization header

3. **Cron Manager App**: Separate Fly.io app that runs the cron jobs
   - Uses [fly-apps/cron-manager](https://github.com/fly-apps/cron-manager)
   - Lightweight Go app that triggers HTTP requests on schedule

## Setup Instructions

### 1. Set the CRON_SECRET on Your Main App

```bash
# Generate a secure random secret
CRON_SECRET=$(openssl rand -hex 32)

# Set it on your main Glass Loans app
fly secrets set CRON_SECRET="$CRON_SECRET" -a glass-loans-brochure-modified-misty-thunder-1484
```

### 2. Clone and Setup Cron Manager

```bash
# Clone the cron-manager repository
git clone https://github.com/fly-apps/cron-manager.git
cd cron-manager

# Create the Fly app (don't deploy yet)
fly launch --name glass-loans-brochure-modified-misty-thunder-1484-cron --region dfw --no-deploy

# Copy your cron.json configuration
cp /path/to/glass-loans-brochure-modified/cron.json .

# Set the same CRON_SECRET on the cron app
fly secrets set CRON_SECRET="<same-value-from-step-1>" -a glass-loans-brochure-modified-misty-thunder-1484-cron
```

### 3. Deploy the Cron Manager

```bash
# Deploy the cron manager app
fly deploy -a glass-loans-brochure-modified-misty-thunder-1484-cron

# Verify it's running
fly status -a glass-loans-brochure-modified-misty-thunder-1484-cron

# Check logs to see cron jobs being scheduled
fly logs -a glass-loans-brochure-modified-misty-thunder-1484-cron
```

## How It Works

### Reset Logic

The cron job runs this query daily:

1. **Find users to reset**:
   ```sql
   SELECT * FROM users
   WHERE tier = 'pro'
     AND usage_period_start IS NOT NULL
     AND usage_period_start <= NOW() - INTERVAL '30 days';
   ```

2. **Reset each user**:
   ```sql
   UPDATE users
   SET usage_count = 0,
       usage_period_start = NOW()
   WHERE id = ?;
   ```

### Example Timeline

- **Day 1** (Jan 1): User signs up for Pro, `usagePeriodStart = Jan 1, usageCount = 0`
- **Day 15** (Jan 15): User makes 5 submissions, `usageCount = 5`
- **Day 31** (Feb 1): Cron runs at 3 AM UTC, resets `usageCount = 0, usagePeriodStart = Feb 1`
- **Day 61** (Mar 3): Cron runs, resets `usageCount = 0, usagePeriodStart = Mar 3`

## Monitoring

### Check Cron Logs

```bash
# View cron manager logs
fly logs -a glass-loans-brochure-modified-misty-thunder-1484-cron

# View main app logs (for reset API endpoint logs)
fly logs -a glass-loans-brochure-modified-misty-thunder-1484 | grep "reset-usage"
```

### Manual Trigger (Testing)

You can manually trigger the reset for testing:

```bash
# Get the CRON_SECRET from your app
fly secrets list -a glass-loans-brochure-modified-misty-thunder-1484

# Trigger the endpoint
curl -X POST https://glassloans.io/api/cron/reset-usage \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Check Database Directly

```bash
# Connect to database
fly mpg proxy <cluster-id>

# In another terminal
psql -h localhost -p 16380 -U fly-user -d fly-db

# Query Pro users and their usage periods
SELECT
  email,
  tier,
  usage_count,
  usage_limit,
  usage_period_start,
  AGE(NOW(), usage_period_start) as period_age
FROM users
WHERE tier = 'pro'
ORDER BY usage_period_start DESC;
```

## Troubleshooting

### Cron Not Running

1. Check cron manager status:
   ```bash
   fly status -a glass-loans-brochure-modified-misty-thunder-1484-cron
   ```

2. Check cron manager logs for errors:
   ```bash
   fly logs -a glass-loans-brochure-modified-misty-thunder-1484-cron
   ```

3. Verify cron.json is correct:
   ```bash
   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484-cron
   cat cron.json
   ```

### Unauthorized Errors (401)

This means the `CRON_SECRET` doesn't match between apps:

```bash
# Check main app has CRON_SECRET
fly secrets list -a glass-loans-brochure-modified-misty-thunder-1484

# Check cron app has CRON_SECRET
fly secrets list -a glass-loans-brochure-modified-misty-thunder-1484-cron

# They must be identical! Re-set if needed:
fly secrets set CRON_SECRET="<same-value>" -a glass-loans-brochure-modified-misty-thunder-1484-cron
```

### No Users Being Reset

Check if users have `usagePeriodStart` set:

```sql
SELECT email, tier, usage_period_start
FROM users
WHERE tier = 'pro';
```

If `usage_period_start` is NULL, users won't be reset. This field is set when:
- User upgrades to Pro tier (see `src/lib/db/queries.ts:updateUserTier`)
- Should be set automatically during Stripe webhook processing

## Cost

The cron-manager app is very lightweight:
- **VM Size**: `shared-cpu-1x` with 256MB RAM
- **Running Time**: ~1-2 seconds per day
- **Estimated Cost**: ~$2-3/month

## Alternative: GitHub Actions

If you prefer not to use a separate Fly app, you can use GitHub Actions instead:

```yaml
# .github/workflows/reset-usage.yml
name: Reset Pro User Usage

on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger usage reset
        run: |
          curl -X POST https://glassloans.io/api/cron/reset-usage \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -f || exit 1
```

Then set `CRON_SECRET` as a GitHub repository secret.

**Pros**: No extra Fly app cost
**Cons**: Depends on GitHub, less integrated with Fly ecosystem
