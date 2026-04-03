# Cron Job Quick Start

## What Was Created

1. **API Endpoint**: [src/app/api/cron/reset-usage/route.ts](src/app/api/cron/reset-usage/route.ts)
   - Resets Pro users' usage counts every 30 days
   - Protected by `CRON_SECRET` bearer token

2. **Cron Configuration**: [cron.json](cron.json)
   - Defines the schedule (daily at 3 AM UTC)
   - Used by Fly.io cron-manager

3. **Setup Scripts**:
   - [scripts/setup-cron.sh](scripts/setup-cron.sh) - Setup instructions
   - [scripts/test-cron.sh](scripts/test-cron.sh) - Test the endpoint

4. **Documentation**: [CRON_SETUP.md](CRON_SETUP.md) - Full setup guide

## Quick Setup (5 minutes)

### Step 1: Set CRON_SECRET

```bash
# Generate and set the secret
fly secrets set CRON_SECRET="$(openssl rand -hex 32)" -a glass-loans-brochure-modified-misty-thunder-1484
```

### Step 2: Deploy the API Endpoint

```bash
# Deploy your main app (includes the new /api/cron/reset-usage endpoint)
./scripts/deploy.sh
```

### Step 3: Test the Endpoint

```bash
# Test it works
./scripts/test-cron.sh
# Choose option 1 (Production)
```

### Step 4: Setup Cron Manager

```bash
# Clone cron-manager
git clone https://github.com/fly-apps/cron-manager.git /tmp/cron-manager
cd /tmp/cron-manager

# Create and configure the Fly app
fly launch --name glass-loans-brochure-modified-misty-thunder-1484-cron --region dfw --no-deploy

# Copy your cron config
cp /path/to/glass-loans-brochure-modified/cron.json .

# Set the CRON_SECRET (same value as main app)
fly secrets set CRON_SECRET="<paste-the-same-secret-from-step-1>" -a glass-loans-brochure-modified-misty-thunder-1484-cron

# Deploy cron manager
fly deploy -a glass-loans-brochure-modified-misty-thunder-1484-cron
```

### Step 5: Verify It's Working

```bash
# Check cron manager logs
fly logs -a glass-loans-brochure-modified-misty-thunder-1484-cron

# You should see logs like:
# "Loaded 1 cron job(s)"
# "Scheduled: reset-pro-usage at 0 3 * * *"
```

## How It Works

1. **Daily Check**: Cron manager calls `/api/cron/reset-usage` every day at 3 AM UTC
2. **Find Expired Users**: API finds Pro users whose `usagePeriodStart` is 30+ days old
3. **Reset**: For each user, set `usageCount = 0` and `usagePeriodStart = NOW()`
4. **Log**: Returns details of reset users for monitoring

## Monitoring

```bash
# View cron execution logs
fly logs -a glass-loans-brochure-modified-misty-thunder-1484-cron

# View reset API logs
fly logs -a glass-loans-brochure-modified-misty-thunder-1484 | grep "reset-usage"

# Check database directly
fly mpg proxy <cluster-id>
# Then: SELECT email, usage_count, usage_period_start FROM users WHERE tier='pro';
```

## Cost

- **Cron Manager**: ~$2-3/month (lightweight, runs seconds per day)
- **Alternative**: Use GitHub Actions for free (see CRON_SETUP.md)

## Next Steps

1. ✅ Deploy the API endpoint first
2. ✅ Test it manually to ensure it works
3. ✅ Setup cron manager to automate it
4. ✅ Monitor logs for the first few runs
5. Optional: Set up alerts for failed cron runs

For detailed troubleshooting and advanced options, see [CRON_SETUP.md](CRON_SETUP.md).
