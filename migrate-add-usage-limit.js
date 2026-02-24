#!/usr/bin/env node

/**
 * Migration Script: Add usage_limit column to users table
 * Run this to update existing databases with the new usage_limit field
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "glass-loans.db");
const migrationPath = path.join(
  __dirname,
  "src/lib/db/migrations/002_add_usage_limit.sqlite.sql"
);

console.log("Starting migration: Add usage_limit to users table\n");

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error("❌ Database not found at:", dbPath);
  console.log("   Run setup-local-db.js first to create the database");
  process.exit(1);
}

try {
  // Connect to database
  const db = new Database(dbPath);
  console.log("✓ Connected to database");

  // Check if migration has already been applied
  const result = db.pragma("table_info(users)");
  const hasUsageLimit = result.some((col) => col.name === "usage_limit");

  if (hasUsageLimit) {
    console.log("✓ Migration already applied - usage_limit column exists");
    db.close();
    process.exit(0);
  }

  // Read migration SQL
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  // Execute migration
  console.log("Applying migration...");
  db.exec(migrationSql);
  console.log("✓ Migration applied successfully");

  // Verify the migration
  const verifyResult = db.pragma("table_info(users)");
  const verified = verifyResult.some((col) => col.name === "usage_limit");

  if (verified) {
    console.log("✓ Migration verified - usage_limit column added");

    // Show updated schema
    const usageLimitCol = verifyResult.find((col) => col.name === "usage_limit");
    console.log(`  Column: ${usageLimitCol.name}, Type: ${usageLimitCol.type}, Default: ${usageLimitCol.dflt_value}`);

    // Count users and show their limits
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get();
    console.log(`\n✓ Updated ${userCount.count} user(s) with default limit of 3`);
  } else {
    console.error("❌ Migration verification failed");
    process.exit(1);
  }

  db.close();
  console.log("\n✅ Migration completed successfully!");
  console.log("\nNote: To update a user's limit, use SQL:");
  console.log('  UPDATE users SET usage_limit = 10 WHERE email = \'user@example.com\';');
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exit(1);
}
