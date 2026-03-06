/**
 * Master Migration Runner (TypeScript)
 *
 * Safely applies all pending database migrations in order.
 * Can be run with: npx tsx scripts/migrate.ts
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Use /data for production (Fly.io mount), otherwise local directory
const dbPath = process.env.NODE_ENV === "production"
  ? "/data/glass-loans.db"
  : path.join(process.cwd(), "glass-loans.db");

console.log("🚀 Starting migration process...");
console.log(`📁 Database: ${dbPath}\n`);

// Ensure directory exists (especially important for Fly.io /data mount)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  console.log(`📁 Creating directory: ${dbDir}`);
  fs.mkdirSync(dbDir, { recursive: true });
}

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.log("⚠️  Database file not found. Creating new database...");
}

const db = new Database(dbPath);

// =============================================================================
// Migration 001: Initial Schema (SQLite)
// =============================================================================
console.log("🔍 Checking Migration 001: Initial Schema");

try {
  // Check if users table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const hasUsersTable = tables.some(t => t.name === 'users');

  if (!hasUsersTable) {
    console.log("⏳ Applying Migration 001...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/001_initial_schema.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 001 completed: Initial schema created");
  } else {
    console.log("✅ Migration 001 already applied (tables exist)");
  }
} catch (error: any) {
  console.error("❌ Migration 001 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 002: Add Usage Limit (SKIPPED - already in 001)
// =============================================================================
console.log("🔍 Checking Migration 002: Add Usage Limit");

try {
  const userColumns = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  const hasUsageLimit = userColumns.some(col => col.name === "usage_limit");

  if (!hasUsageLimit) {
    console.log("⏳ Applying Migration 002...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/002_add_usage_limit.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 002 completed: usage_limit column added");
  } else {
    console.log("✅ Migration 002 already applied (usage_limit exists)");
  }
} catch (error: any) {
  console.error("❌ Migration 002 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 003: Add User ARV Estimate
// =============================================================================
console.log("🔍 Checking Migration 003: Add User ARV Estimate");

try {
  const submissionColumns = db.pragma("table_info(underwriting_submissions)") as Array<{ name: string; type: string }>;
  const hasUserArv = submissionColumns.some(col => col.name === "user_estimated_arv");

  if (!hasUserArv) {
    console.log("⏳ Applying Migration 003...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/003_add_user_arv.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 003 completed: user_estimated_arv column added");
  } else {
    console.log("✅ Migration 003 already applied (user_estimated_arv exists)");
  }
} catch (error: any) {
  console.error("❌ Migration 003 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 004: Add Location Fields
// =============================================================================
console.log("🔍 Checking Migration 004: Add Location Fields");

try {
  const submissionColumns = db.pragma("table_info(underwriting_submissions)") as Array<{ name: string; type: string }>;
  const hasLocationFields = submissionColumns.some(col => col.name === "property_state");

  if (!hasLocationFields) {
    console.log("⏳ Applying Migration 004...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/004_add_location_fields.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 004 completed: property_city, property_state, property_zip columns added");
  } else {
    console.log("✅ Migration 004 already applied (location fields exist)");
  }
} catch (error: any) {
  console.error("❌ Migration 004 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 005: Add BatchData Cache Tables
// =============================================================================
console.log("🔍 Checking Migration 005: Add BatchData Cache Tables");

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const hasBatchDataCache = tables.some(t => t.name === 'batchdata_address_cache');

  if (!hasBatchDataCache) {
    console.log("⏳ Applying Migration 005...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/005_add_batchdata_cache.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 005 completed: BatchData cache tables created");
  } else {
    console.log("✅ Migration 005 already applied (BatchData cache tables exist)");
  }
} catch (error: any) {
  console.error("❌ Migration 005 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 006: Add Report IDs and Retention
// =============================================================================
console.log("🔍 Checking Migration 006: Add Report IDs and Retention");

try {
  const userColumns = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  const hasReportRetention = userColumns.some(col => col.name === "report_retention_days");

  if (!hasReportRetention) {
    console.log("⏳ Applying Migration 006...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/006_add_report_ids.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 006 completed: Report IDs and retention added");
  } else {
    console.log("✅ Migration 006 already applied (report retention fields exist)");
  }
} catch (error: any) {
  console.error("❌ Migration 006 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 007: Add Property Details
// =============================================================================
console.log("🔍 Checking Migration 007: Add Property Details");

try {
  const submissionColumns = db.pragma("table_info(underwriting_submissions)") as Array<{ name: string; type: string }>;
  const hasPropertyDetails = submissionColumns.some(col => col.name === "bedrooms");

  if (!hasPropertyDetails) {
    console.log("⏳ Applying Migration 007...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/007_add_property_details.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 007 completed: bedrooms, bathrooms, year_built, property_type columns added");
  } else {
    console.log("✅ Migration 007 already applied (property detail fields exist)");
  }
} catch (error: any) {
  console.error("❌ Migration 007 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 008: Add Missing Form Fields
// =============================================================================
console.log("🔍 Checking Migration 008: Add Missing Form Fields");

try {
  const submissionColumns = db.pragma("table_info(underwriting_submissions)") as Array<{ name: string; type: string }>;
  const hasUserAsIsValue = submissionColumns.some(col => col.name === "user_estimated_as_is_value");

  if (!hasUserAsIsValue) {
    console.log("⏳ Applying Migration 008...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/008_add_missing_form_fields.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 008 completed: user_estimated_as_is_value, property_county columns added");
  } else {
    console.log("✅ Migration 008 already applied (user_estimated_as_is_value exists)");
  }
} catch (error: any) {
  console.error("❌ Migration 008 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Migration 009: Add Verification Code
// =============================================================================
console.log("🔍 Checking Migration 009: Add Verification Code");

try {
  const userColumns = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  const hasVerificationCode = userColumns.some(col => col.name === "verification_code");

  if (!hasVerificationCode) {
    console.log("⏳ Applying Migration 009...");
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "src/lib/db/migrations/009_add_verification_code.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 009 completed: verification_code, code_expires_at columns added");
  } else {
    console.log("✅ Migration 009 already applied (verification_code exists)");
  }
} catch (error: any) {
  console.error("❌ Migration 009 failed:", error.message);
  db.close();
  process.exit(1);
}

console.log("");

// =============================================================================
// Verification & Summary
// =============================================================================
console.log("🔍 Verifying final schema...\n");

try {
  // Verify users table
  const userColumns = db.pragma("table_info(users)") as Array<{ name: string; type: string }>;
  console.log("📊 Users table columns:");
  userColumns.forEach(col => {
    const mark = ["usage_limit", "user_estimated_arv"].includes(col.name) ? "🔹" : "  ";
    console.log(`${mark} ${col.name} (${col.type})`);
  });

  console.log("\n📊 Underwriting submissions - key columns:");
  const submissionColumns = db.pragma("table_info(underwriting_submissions)") as Array<{ name: string; type: string }>;
  const keyColumns = ["user_estimated_as_is_value", "user_estimated_arv", "estimated_arv", "as_is_value", "monthly_rent", "property_city", "property_state", "property_zip", "property_county", "bedrooms", "bathrooms", "year_built", "property_type"];
  submissionColumns
    .filter(col => keyColumns.includes(col.name))
    .forEach(col => {
      const mark = ["user_estimated_as_is_value", "user_estimated_arv", "property_state", "bedrooms"].includes(col.name) ? "🔹" : "  ";
      const note = col.name === "monthly_rent" ? " (deprecated)" : "";
      console.log(`${mark} ${col.name} (${col.type})${note}`);
    });

  console.log("\n✨ All migrations completed successfully!");
  console.log("\n📝 Migration Summary:");
  console.log("   • Migration 001: Initial schema ✅");
  console.log("   • Migration 002: Usage limit ✅");
  console.log("   • Migration 003: User ARV ✅");
  console.log("   • Migration 004: Location fields ✅");
  console.log("   • Migration 005: BatchData cache tables ✅");
  console.log("   • Migration 006: Report IDs and retention ✅");
  console.log("   • Migration 007: Property details ✅");
  console.log("   • Migration 008: User as-is value & county ✅");
  console.log("   • Migration 009: Email verification code ✅");
  console.log("\n🎉 Database is up to date and ready for use!");

} catch (error: any) {
  console.error("❌ Verification failed:", error.message);
  db.close();
  process.exit(1);
}

db.close();
