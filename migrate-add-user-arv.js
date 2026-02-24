/**
 * Migration script to add user_estimated_arv column to underwriting_submissions
 *
 * Usage: node migrate-add-user-arv.js
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "glass-loans.db");
const migrationPath = path.join(
  __dirname,
  "src/lib/db/migrations/003_add_user_arv.sqlite.sql"
);

console.log("🔄 Running migration: Add user ARV estimate");
console.log(`📁 Database: ${dbPath}`);
console.log(`📄 Migration file: ${migrationPath}`);

try {
  // Open database
  const db = new Database(dbPath);

  // Check if migration has already been applied
  const result = db.pragma("table_info(underwriting_submissions)");
  const hasUserArv = result.some((col) => col.name === "user_estimated_arv");

  if (hasUserArv) {
    console.log("✅ Migration already applied - user_estimated_arv column exists");
    db.close();
    process.exit(0);
  }

  // Read and execute migration SQL
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  console.log("\n🚀 Applying migration...");
  db.exec(migrationSql);

  // Verify migration
  const updated = db.pragma("table_info(underwriting_submissions)");
  const verified = updated.some((col) => col.name === "user_estimated_arv");

  if (verified) {
    console.log("✅ Migration completed successfully!");
    console.log("\n📊 Updated schema:");
    console.log(
      updated
        .filter((col) =>
          [
            "user_estimated_arv",
            "estimated_arv",
            "as_is_value",
            "monthly_rent",
          ].includes(col.name)
        )
        .map((col) => `  - ${col.name} (${col.type})`)
        .join("\n")
    );
    console.log("\n✨ Ready for dual ARV comparison feature!");
  } else {
    throw new Error("Migration verification failed");
  }

  db.close();
} catch (error) {
  console.error("❌ Migration failed:", error.message);
  process.exit(1);
}
