/**
 * Clear BatchData cache for a specific address
 * Usage: npx tsx scripts/clear-address-cache.ts "2316 Fernwood Drive"
 */

import Database from "better-sqlite3";
import path from "path";

const address = process.argv[2];

if (!address) {
  console.error("❌ Error: Address argument required");
  console.log("Usage: npx tsx scripts/clear-address-cache.ts \"2316 Fernwood Drive\"");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "glass-loans.db");
const db = new Database(dbPath);

console.log(`🧹 Clearing BatchData cache for: ${address}\n`);

try {
  // Normalize address for matching (lowercase, trim)
  const normalizedAddress = address.toLowerCase().trim();

  // Check what exists for this address
  const addressCacheResults = db.prepare(
    "SELECT * FROM batchdata_address_cache WHERE LOWER(original_address) LIKE ? OR LOWER(standardized_address) LIKE ?"
  ).all(`%${normalizedAddress}%`, `%${normalizedAddress}%`) as any[];

  const propertyCacheResults = db.prepare(
    "SELECT * FROM batchdata_property_cache WHERE LOWER(address) LIKE ?"
  ).all(`%${normalizedAddress}%`) as any[];

  const compsCacheResults = db.prepare(
    "SELECT * FROM batchdata_comps_cache WHERE LOWER(subject_address) LIKE ?"
  ).all(`%${normalizedAddress}%`) as any[];

  console.log(`📊 Found cache entries:`);
  console.log(`   Address cache: ${addressCacheResults.length} entries`);
  console.log(`   Property cache: ${propertyCacheResults.length} entries`);
  console.log(`   Comps cache: ${compsCacheResults.length} entries\n`);

  if (addressCacheResults.length === 0 && propertyCacheResults.length === 0 && compsCacheResults.length === 0) {
    console.log("⚠️  No cache entries found for this address");
    db.close();
    process.exit(0);
  }

  // Show what will be deleted
  if (addressCacheResults.length > 0) {
    console.log("🔍 Address cache entries to delete:");
    addressCacheResults.forEach((entry) => {
      console.log(`   - ${entry.standardized_address}`);
    });
  }

  if (propertyCacheResults.length > 0) {
    console.log("🔍 Property cache entries to delete:");
    propertyCacheResults.forEach((entry) => {
      console.log(`   - ${entry.address}`);
    });
  }

  if (compsCacheResults.length > 0) {
    console.log("🔍 Comps cache entries to delete:");
    compsCacheResults.forEach((entry) => {
      console.log(`   - ${entry.subject_address} (Tier ${entry.comp_tier}, ${entry.comp_count} comps)`);
    });
  }

  console.log("");

  // Delete entries
  const addressDeleted = db.prepare(
    "DELETE FROM batchdata_address_cache WHERE LOWER(original_address) LIKE ? OR LOWER(standardized_address) LIKE ?"
  ).run(`%${normalizedAddress}%`, `%${normalizedAddress}%`);

  const propertyDeleted = db.prepare(
    "DELETE FROM batchdata_property_cache WHERE LOWER(address) LIKE ?"
  ).run(`%${normalizedAddress}%`);

  const compsDeleted = db.prepare(
    "DELETE FROM batchdata_comps_cache WHERE LOWER(subject_address) LIKE ?"
  ).run(`%${normalizedAddress}%`);

  console.log("✅ Cache cleared successfully!");
  console.log(`   Address cache: ${addressDeleted.changes} deleted`);
  console.log(`   Property cache: ${propertyDeleted.changes} deleted`);
  console.log(`   Comps cache: ${compsDeleted.changes} deleted\n`);

  console.log("💡 Next underwriting submission for this address will fetch fresh data from BatchData API");

} catch (error: any) {
  console.error("❌ Error:", error.message);
  db.close();
  process.exit(1);
}

db.close();
