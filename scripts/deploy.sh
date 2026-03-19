#!/bin/bash
# Deployment script for Glass Loans
# Handles deploy + migrations

set -e

APP_NAME="glass-loans-brochure-modified-misty-thunder-1484"

echo "🚀 Starting deployment..."
echo ""

# Step 1: Deploy
echo "📦 Deploying to Fly.io..."
# Pass Mapbox API key as build arg (not committed to repo for security)
# --build-cache enables Docker layer caching for faster builds
fly deploy --build-cache --build-arg NEXT_PUBLIC_MAPBOX_API_KEY="pk.eyJ1IjoiMHh0eWRvbyIsImEiOiJjbW11cmFxdnAyOHI1MnJwdWh0bzg4MDU4In0.jtitLpJ6BngOUU64Evr5qA"

echo ""
echo "✅ Deployment complete!"
echo ""

# Step 2: Ask if user wants to run migrations
read -p "🔄 Run migrations now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔧 Running migrations on production..."
  fly ssh console -a $APP_NAME -C "npx tsx scripts/migrate.ts"

  echo ""
  read -p "🔄 Restart app? (y/n) " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "♻️  Restarting app..."
    fly apps restart $APP_NAME
    echo "✅ App restarted!"
  fi
fi

echo ""
echo "🎉 Deployment process complete!"
echo "📊 Monitor at: https://fly.io/apps/$APP_NAME/monitoring"
