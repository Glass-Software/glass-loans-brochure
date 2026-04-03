#!/bin/bash
set -e

# Setup Fly.io cron-manager for Glass Loans
# This script sets up automated monthly usage resets for Pro users

APP_NAME="glass-loans-brochure-modified-misty-thunder-1484"
CRON_APP_NAME="${APP_NAME}-cron"

echo "🚀 Setting up Fly.io cron-manager for Glass Loans"
echo ""

# Step 1: Generate a secure CRON_SECRET if not already set
echo "📝 Step 1: Setting CRON_SECRET..."
if ! fly secrets list -a "$APP_NAME" | grep -q "CRON_SECRET"; then
  CRON_SECRET=$(openssl rand -hex 32)
  echo "Generated new CRON_SECRET"
  fly secrets set CRON_SECRET="$CRON_SECRET" -a "$APP_NAME"
  echo "✅ CRON_SECRET set on main app"
else
  echo "✅ CRON_SECRET already exists"
fi

echo ""
echo "📦 Step 2: Deploy cron-manager app"
echo "Run the following commands manually:"
echo ""
echo "  # Clone cron-manager (if not already cloned)"
echo "  git clone https://github.com/fly-apps/cron-manager.git /tmp/cron-manager"
echo "  cd /tmp/cron-manager"
echo ""
echo "  # Create fly.toml for cron app"
echo "  fly launch --name $CRON_APP_NAME --region dfw --no-deploy"
echo ""
echo "  # Copy our cron.json to the cron-manager directory"
echo "  cp $(pwd)/cron.json ."
echo ""
echo "  # Set the CRON_SECRET on the cron app (same value as main app)"
echo "  fly secrets set CRON_SECRET=<same-value-as-main-app> -a $CRON_APP_NAME"
echo ""
echo "  # Deploy the cron manager"
echo "  fly deploy -a $CRON_APP_NAME"
echo ""
echo "  # Verify it's running"
echo "  fly logs -a $CRON_APP_NAME"
echo ""
echo "✅ Setup instructions displayed"
echo ""
echo "📚 For more info: https://github.com/fly-apps/cron-manager"
