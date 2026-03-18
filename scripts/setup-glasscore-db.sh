#!/bin/bash
# ============================================================================
# GlassCore PostgreSQL Database Setup Script for fly.io
# ============================================================================
# This script creates and initializes the shared GlassCore database
# that can be accessed by both:
# - Website (glassloans.io)
# - App (app.glassloans.io)
# ============================================================================

set -e  # Exit on error

echo "🚀 GlassCore Database Setup"
echo "============================"

# Step 1: Create PostgreSQL cluster on fly.io
echo ""
echo "📦 Step 1: Creating PostgreSQL cluster..."
echo "This will create a shared database accessible by both your apps."
echo ""
read -p "Database name (default: glasscore-db): " DB_NAME
DB_NAME=${DB_NAME:-glasscore-db}

read -p "Region (default: iad - Ashburn, VA): " REGION
REGION=${REGION:-iad}

read -p "VM size (default: shared-cpu-1x - $1.94/mo): " VM_SIZE
VM_SIZE=${VM_SIZE:-shared-cpu-1x}

echo ""
echo "Creating PostgreSQL cluster: $DB_NAME in region $REGION..."
fly postgres create --name "$DB_NAME" --region "$REGION" --vm-size "$VM_SIZE" --initial-cluster-size 1 --volume-size 1

# Step 2: Get connection string
echo ""
echo "📝 Step 2: Getting database credentials..."
echo "Run this command to see your connection string:"
echo "  fly postgres connect -a $DB_NAME"

# Step 3: Attach database to apps
echo ""
echo "🔗 Step 3: Attaching database to your apps..."
echo ""
read -p "Enter your WEBSITE app name (e.g., glassloans-web): " WEB_APP
read -p "Enter your APP app name (e.g., glassloans-app): " APP_NAME

if [ ! -z "$WEB_APP" ]; then
  echo "Attaching database to $WEB_APP..."
  fly postgres attach "$DB_NAME" -a "$WEB_APP" --variable-name GLASSCORE_DATABASE_URL
fi

if [ ! -z "$APP_NAME" ]; then
  echo "Attaching database to $APP_NAME..."
  fly postgres attach "$DB_NAME" -a "$APP_NAME" --variable-name GLASSCORE_DATABASE_URL
fi

# Step 4: Run migrations
echo ""
echo "📊 Step 4: Running database migrations..."
echo ""
echo "Connect to the database with:"
echo "  fly postgres connect -a $DB_NAME"
echo ""
echo "Then run the migration file:"
echo "  \\i /path/to/001_glasscore_initial.postgres.sql"
echo ""
echo "Or you can proxy the database locally and run migrations:"
echo "  fly proxy 5432 -a $DB_NAME"
echo "  # In another terminal:"
echo "  psql postgres://username:password@localhost:5432/dbname < src/lib/db/migrations/001_glasscore_initial.postgres.sql"
echo ""

# Step 5: Next steps
echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Add GLASSCORE_DATABASE_URL to your local .env file for development:"
echo "   GLASSCORE_DATABASE_URL=postgres://username:password@hostname:5432/dbname"
echo ""
echo "2. Run the migration:"
echo "   fly postgres connect -a $DB_NAME"
echo "   Then paste the SQL from: src/lib/db/migrations/001_glasscore_initial.postgres.sql"
echo ""
echo "3. Install pg package:"
echo "   npm install pg"
echo "   npm install -D @types/node"
echo ""
echo "4. Test the connection from your apps"
echo ""
echo "🔍 Useful Commands:"
echo "  fly postgres connect -a $DB_NAME           # Connect to database"
echo "  fly proxy 5432 -a $DB_NAME                # Proxy to localhost:5432"
echo "  fly status -a $DB_NAME                    # Check database status"
echo "  fly postgres db list -a $DB_NAME          # List databases"
echo ""
