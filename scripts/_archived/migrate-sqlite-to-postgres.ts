/**
 * Migration script to move data from SQLite to PostgreSQL
 *
 * Usage:
 *   # Start Fly proxy first in another terminal:
 *   fly mpg proxy 3x9jv02x2k8o6qp7 -p 5433
 *
 *   # Then run this script:
 *   DATABASE_URL="postgresql://fly-user:pMHeEGUIqDoaBEK628MHR9O6@localhost:5433/fly-db?sslmode=disable" npx tsx scripts/migrate-sqlite-to-postgres.ts
 */

import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import path from "path";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

// Prisma v7 requires explicit adapter configuration
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Starting SQLite to PostgreSQL migration...\n");

  // Open SQLite database
  const dbPath = path.join(process.cwd(), "glass-loans.db");
  console.log(`📂 Opening SQLite database: ${dbPath}`);
  const sqlite = new Database(dbPath, { readonly: true });

  try {
    // Migrate Users
    console.log("\n👤 Migrating users...");
    const users = sqlite.prepare("SELECT * FROM users").all() as any[];
    console.log(`   Found ${users.length} users`);

    for (const user of users) {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          normalizedEmail: user.normalized_email,
          emailVerified: Boolean(user.email_verified),
          verificationToken: user.verification_token,
          verificationTokenExpires: user.verification_token_expires ? new Date(user.verification_token_expires) : null,
          verificationCode: user.verification_code,
          codeExpiresAt: user.code_expires_at ? new Date(user.code_expires_at) : null,
          usageCount: user.usage_count || 0,
          usageLimit: user.usage_limit || 3,
          reportRetentionDays: user.report_retention_days || 14,
          marketingConsent: Boolean(user.marketing_consent),
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at),
        },
      });
    }
    console.log(`   ✅ Migrated ${users.length} users`);

    // Migrate Underwriting Submissions
    console.log("\n📊 Migrating underwriting submissions...");
    const submissions = sqlite.prepare("SELECT * FROM underwriting_submissions").all() as any[];
    console.log(`   Found ${submissions.length} submissions`);

    for (const sub of submissions) {
      await prisma.underwritingSubmission.create({
        data: {
          id: sub.id,
          userId: sub.user_id,
          propertyAddress: sub.property_address,
          propertyCity: sub.property_city,
          propertyState: sub.property_state,
          propertyZip: sub.property_zip,
          propertyCounty: sub.property_county,
          propertyLatitude: sub.property_latitude,
          propertyLongitude: sub.property_longitude,
          propertyType: sub.property_type,
          propertyCondition: sub.property_condition,
          squareFeet: sub.square_feet,
          bedrooms: sub.bedrooms,
          bathrooms: sub.bathrooms,
          yearBuilt: sub.year_built,
          purchasePrice: sub.purchase_price,
          rehab: sub.rehab,
          renovationPerSf: sub.renovation_per_sf,
          userEstimatedArv: sub.user_estimated_arv,
          userEstimatedAsIsValue: sub.user_estimated_as_is_value,
          interestRate: sub.interest_rate,
          months: sub.months,
          loanAtPurchase: sub.loan_at_purchase,
          renovationFunds: sub.renovation_funds || 0,
          closingCostsPercent: sub.closing_costs_percent,
          points: sub.points,
          marketType: sub.market_type,
          additionalDetails: sub.additional_details,
          compLinks: sub.comp_links,
          estimatedArv: sub.estimated_arv,
          asIsValue: sub.as_is_value,
          monthlyRent: sub.monthly_rent,
          finalScore: sub.final_score,
          garyOpinion: sub.gary_opinion,
          aiPropertyComps: sub.ai_property_comps,
          compSelectionState: sub.comp_selection_state,
          reportId: sub.report_id,
          expiresAt: sub.expires_at ? new Date(sub.expires_at) : null,
          ipAddress: sub.ip_address,
          recaptchaScore: sub.recaptcha_score,
          createdAt: new Date(sub.created_at),
        },
      });
    }
    console.log(`   ✅ Migrated ${submissions.length} submissions`);

    // Migrate Rate Limits
    console.log("\n🚦 Migrating rate limits...");
    const rateLimits = sqlite.prepare("SELECT * FROM rate_limits").all() as any[];
    console.log(`   Found ${rateLimits.length} rate limit records`);

    for (const limit of rateLimits) {
      await prisma.rateLimit.create({
        data: {
          id: limit.id,
          ipAddress: limit.ip_address,
          endpoint: limit.endpoint,
          requestCount: limit.request_count || 1,
          windowStart: new Date(limit.window_start),
          createdAt: new Date(limit.created_at),
        },
      });
    }
    console.log(`   ✅ Migrated ${rateLimits.length} rate limits`);

    // Migrate Realie Cache (skip expired ones)
    console.log("\n🏠 Migrating Realie comps cache...");
    const realieComps = sqlite.prepare(
      "SELECT * FROM realie_comps_cache WHERE expires_at > DATETIME('now')"
    ).all() as any[];
    console.log(`   Found ${realieComps.length} active cache entries`);

    for (const comp of realieComps) {
      await prisma.realieCompsCache.create({
        data: {
          id: comp.id,
          searchHash: comp.search_hash,
          latitude: comp.latitude,
          longitude: comp.longitude,
          radius: comp.radius,
          searchTier: comp.search_tier,
          compCount: comp.comp_count,
          medianPricePerSqft: comp.median_price_per_sqft,
          estimatedArv: comp.estimated_arv,
          rawResponse: comp.raw_response,
          createdAt: new Date(comp.created_at),
          expiresAt: new Date(comp.expires_at),
        },
      });
    }
    console.log(`   ✅ Migrated ${realieComps.length} cache entries`);

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    throw error;
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
