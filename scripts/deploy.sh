#!/bin/bash
# Deployment script for Glass Loans
# Handles deploy + migrations

set -e

APP_NAME="glass-loans-brochure-modified-misty-thunder-1484"

echo "🚀 Starting deployment..."
echo ""

# Step 1: Deploy
echo "📦 Deploying to Fly.io..."
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
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_PROMO="price_1TGoUM9pyT4ynYPly2bwWGhR"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "ℹ️  Database migrations run automatically via release_command"
echo "ℹ️  App will restart with new code after migrations succeed"
echo "ℹ️  If migrations fail, deployment will abort (old version stays active)"
echo ""
echo "🎉 Deployment process complete!"
echo "📊 Monitor at: https://fly.io/apps/$APP_NAME/monitoring"
