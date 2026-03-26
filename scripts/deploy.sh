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
  --build-arg NEXT_PUBLIC_RECAPTCHA_SITE_KEY="6Le7v3QsAAAAAP2GYcBPteIjGmNgtNbtGNY6CVR_"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "ℹ️  Database migrations run automatically via release_command"
echo "ℹ️  App will restart with new code after migrations succeed"
echo "ℹ️  If migrations fail, deployment will abort (old version stays active)"
echo ""
echo "🎉 Deployment process complete!"
echo "📊 Monitor at: https://fly.io/apps/$APP_NAME/monitoring"
