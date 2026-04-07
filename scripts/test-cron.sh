#!/bin/bash
set -e

# Test the cron endpoint for monthly usage reset
# This script tests the endpoint locally or in production

APP_NAME="glass-loans-brochure-modified-misty-thunder-1484"

echo "🧪 Testing cron endpoint: /api/cron/reset-usage"
echo ""

# NOTE: fly secrets list shows a digest, NOT the actual secret value
# You must manually set CRON_SECRET environment variable or use .env.local

if [ -z "$CRON_SECRET" ]; then
  echo "⚠️  CRON_SECRET not set in environment"
  echo ""
  echo "Please set it manually:"
  echo "  export CRON_SECRET='your-actual-secret-here'"
  echo ""
  echo "Or add it to .env.local for local testing"
  echo ""
  read -p "Enter CRON_SECRET now: " CRON_SECRET

  if [ -z "$CRON_SECRET" ]; then
    echo "❌ CRON_SECRET is required"
    exit 1
  fi
fi

echo "✅ Using CRON_SECRET: ${CRON_SECRET:0:10}...${CRON_SECRET: -4}"
echo ""

# Choose environment
echo "Select environment to test:"
echo "  1) Production (https://glassloans.io)"
echo "  2) Local (http://localhost:3000)"
read -p "Enter choice [1-2]: " choice

case $choice in
  1)
    URL="https://glassloans.io/api/cron/reset-usage"
    ;;
  2)
    URL="http://localhost:3000/api/cron/reset-usage"
    # For local, use .env.local CRON_SECRET if different
    if [ -f .env.local ] && grep -q "CRON_SECRET" .env.local; then
      CRON_SECRET=$(grep "CRON_SECRET" .env.local | cut -d '=' -f2)
      echo "ℹ️  Using CRON_SECRET from .env.local"
    fi
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "🚀 Sending POST request to: $URL"
echo "🔑 Authorization: Bearer ${CRON_SECRET:0:10}...${CRON_SECRET: -4}"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

# Extract response body (everything except last line)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 HTTP Status: $HTTP_CODE"
echo ""
echo "📦 Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Cron endpoint working correctly!"

  # Parse the response to show reset count
  RESET_COUNT=$(echo "$BODY" | jq -r '.resetCount' 2>/dev/null || echo "0")
  echo "📈 Users reset: $RESET_COUNT"

  if [ "$RESET_COUNT" != "0" ]; then
    echo ""
    echo "Reset users:"
    echo "$BODY" | jq -r '.users[]' 2>/dev/null || true
  fi
else
  echo "❌ Cron endpoint failed!"
  echo ""
  echo "Common issues:"
  echo "  - 401: CRON_SECRET mismatch"
  echo "  - 500: Database connection error"
  echo "  - 404: Endpoint not deployed"
fi

echo ""
echo "🔍 To check Pro users in database:"
echo "   fly mpg proxy <cluster-id>"
echo "   psql -h localhost -p 16380 -U fly-user -d fly-db"
echo "   SELECT email, usage_count, usage_period_start FROM users WHERE tier='pro';"
