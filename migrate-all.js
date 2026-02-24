/**
 * Master Migration Runner
 *
 * Safely applies all pending database migrations in order.
 * Checks if each migration has already been applied before running.
 *
 * Usage: node migrate-all.js
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "glass-loans.db");

console.log("🚀 Starting migration process...");
console.log(`📁 Database: ${dbPath}\n`);

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
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const hasUsersTable = tables.some(t => t.name === 'users');

  if (!hasUsersTable) {
    console.log("⏳ Applying Migration 001...");
    const migrationSql = fs.readFileSync(
      path.join(__dirname, "src/lib/db/migrations/001_initial_schema.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 001 completed: Initial schema created");
  } else {
    console.log("✅ Migration 001 already applied (tables exist)");
  }
} catch (error) {
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
  const userColumns = db.pragma("table_info(users)");
  const hasUsageLimit = userColumns.some(col => col.name === "usage_limit");

  if (!hasUsageLimit) {
    console.log("⏳ Applying Migration 002...");
    const migrationSql = fs.readFileSync(
      path.join(__dirname, "src/lib/db/migrations/002_add_usage_limit.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 002 completed: usage_limit column added");
  } else {
    console.log("✅ Migration 002 already applied (usage_limit exists)");
  }
} catch (error) {
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
  const submissionColumns = db.pragma("table_info(underwriting_submissions)");
  const hasUserArv = submissionColumns.some(col => col.name === "user_estimated_arv");

  if (!hasUserArv) {
    console.log("⏳ Applying Migration 003...");
    const migrationSql = fs.readFileSync(
      path.join(__dirname, "src/lib/db/migrations/003_add_user_arv.sqlite.sql"),
      "utf8"
    );
    db.exec(migrationSql);
    console.log("✅ Migration 003 completed: user_estimated_arv column added");
  } else {
    console.log("✅ Migration 003 already applied (user_estimated_arv exists)");
  }
} catch (error) {
  console.error("❌ Migration 003 failed:", error.message);
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
  const userColumns = db.pragma("table_info(users)");
  console.log("📊 Users table columns:");
  userColumns.forEach(col => {
    const mark = ["usage_limit", "user_estimated_arv"].includes(col.name) ? "🔹" : "  ";
    console.log(`${mark} ${col.name} (${col.type})`);
  });

  console.log("\n📊 Underwriting submissions - key columns:");
  const submissionColumns = db.pragma("table_info(underwriting_submissions)");
  const keyColumns = ["user_estimated_arv", "estimated_arv", "as_is_value", "monthly_rent"];
  submissionColumns
    .filter(col => keyColumns.includes(col.name))
    .forEach(col => {
      const mark = col.name === "user_estimated_arv" ? "🔹" : "  ";
      const note = col.name === "monthly_rent" ? " (deprecated)" : "";
      console.log(`${mark} ${col.name} (${col.type})${note}`);
    });

  console.log("\n✨ All migrations completed successfully!");
  console.log("\n📝 Migration Summary:");
  console.log("   • Migration 001: Initial schema ✅");
  console.log("   • Migration 002: Usage limit ✅");
  console.log("   • Migration 003: User ARV ✅");
  console.log("\n🎉 Database is up to date and ready for use!");

} catch (error) {
  console.error("❌ Verification failed:", error.message);
  db.close();
  process.exit(1);
}

db.close();
