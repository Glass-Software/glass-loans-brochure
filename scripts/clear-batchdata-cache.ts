/**
 * Clear BatchData cache tables
 * Usage: npx tsx scripts/clear-batchdata-cache.ts
 */

import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "glass-loans.db");
const db = new Database(dbPath);

console.log("🧹 Clearing BatchData cache...\n");

try {
  // Get counts before deletion
  const addressCacheCount = db.prepare("SELECT COUNT(*) as count FROM batchdata_address_cache").get() as any;
  const propertyCacheCount = db.prepare("SELECT COUNT(*) as count FROM batchdata_property_cache").get() as any;
  const compsCacheCount = db.prepare("SELECT COUNT(*) as count FROM batchdata_comps_cache").get() as any;

  console.log(`📊 Current cache status:`);
  console.log(`   Address cache: ${addressCacheCount.count} entries`);
  console.log(`   Property cache: ${propertyCacheCount.count} entries`);
  console.log(`   Comps cache: ${compsCacheCount.count} entries\n`);

  // Clear all cache tables
  db.prepare("DELETE FROM batchdata_address_cache").run();
  db.prepare("DELETE FROM batchdata_property_cache").run();
  db.prepare("DELETE FROM batchdata_comps_cache").run();

  console.log("✅ All BatchData caches cleared successfully!");
  console.log("\n💡 Next underwriting submission will fetch fresh data from BatchData API");

} catch (error: any) {
  console.error("❌ Error:", error.message);
  db.close();
  process.exit(1);
}

db.close();
