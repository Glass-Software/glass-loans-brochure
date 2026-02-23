#!/usr/bin/env node

/**
 * Setup local SQLite database for development
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "glass-loans.db");
const schemaPath = path.join(
  __dirname,
  "src/lib/db/migrations/001_initial_schema.sqlite.sql"
);

console.log("🔧 Setting up local SQLite database...");

// Remove old database if exists
if (fs.existsSync(dbPath)) {
  console.log("📦 Removing old database...");
  fs.unlinkSync(dbPath);
}

// Create new database
console.log("📝 Creating new database at:", dbPath);
const db = new Database(dbPath);

// Enable foreign keys and WAL mode
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

// Read and execute schema
console.log("📋 Running migration...");
const schema = fs.readFileSync(schemaPath, "utf8");
db.exec(schema);

// Verify tables were created
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  .all();

console.log("\n✅ Database created successfully!");
console.log("\n📊 Tables created:");
tables.forEach((table) => {
  console.log(`  - ${table.name}`);
});

// Close database
db.close();

console.log("\n🎉 Local database setup complete!");
console.log("You can now run: npm run dev");
