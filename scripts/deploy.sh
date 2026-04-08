#!/bin/bash
# Deployment script for Glass Loans
# Handles deploy + migrations

set -e

APP_NAME="glass-loans-brochure-modified-misty-thunder-1484"

echo "🚀 Starting deployment..."
echo ""

# Step 1: Deploy
echo "📦 Deploying to Fly.io..."

# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be set in your environment before deploying.
# Generate once with: openssl rand -base64 32
# Then add to your shell profile or .env.local:
#   export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="<your-key>"
if [ -z "$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" ]; then
  # Try loading from .env.local if not already set
  if [ -f "$(dirname "$0")/../.env.local" ]; then
    export $(grep -E '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=' "$(dirname "$0")/../.env.local" | xargs)
  fi
fi

if [ -z "$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" ]; then
  echo "❌ ERROR: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is not set."
  echo "   Generate it once with: openssl rand -base64 32"
  echo "   Then either:"
  echo "     export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY='<key>'  (in your shell)"
  echo "     or add it to .env.local"
  exit 1
fi

# Pass public API keys as build args (required for client-side bundle)
# These are public keys restricted by domain in their respective dashboards
fly deploy \
  --build-arg NEXT_PUBLIC_MAPBOX_API_KEY="pk.eyJ1IjoiMHh0eWRvbyIsImEiOiJjbW11cmFxdnAyOHI1MnJwdWh0bzg4MDU4In0.jtitLpJ6BngOUU64Evr5qA" \
  --build-arg NEXT_PUBLIC_GOOGLE_PLACES_API_KEY="AIzaSyCzo2p73EbPwY4lTNT9PiF6xU-J4AZX3yQ" \
  --build-arg NEXT_PUBLIC_RECAPTCHA_SITE_KEY="6Le7v3QsAAAAAP2GYcBPteIjGmNgtNbtGNY6CVR_" \
  --build-arg NEXT_PUBLIC_GTM_ID="GTM-TBTJ7F7L" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_51S5Cgn9pyT4ynYPl5Ad3Zyr20C8RX4mhuu46IoHa66m0tCN9g7xcHcP9alkFfsh3sAAKiHCZW3C6e7vd2mjlkqzI00fyGaDLO6" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_REGULAR="price_1TGoUM9pyT4ynYPlvBrseH3U" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_REGULAR="price_1TGoUM9pyT4ynYPlaeAj3eSo" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_PROMO="price_1TGoUM9pyT4ynYPlQqS026zi" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PROMO="price_1TGoUM9pyT4ynYPly2bwWGhR" \
  --build-arg NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "ℹ️  Database migrations run automatically via release_command"
echo "ℹ️  App will restart with new code after migrations succeed"
echo "ℹ️  If migrations fail, deployment will abort (old version stays active)"
echo ""
echo "🎉 Deployment process complete!"
echo "📊 Monitor at: https://fly.io/apps/$APP_NAME/monitoring"
