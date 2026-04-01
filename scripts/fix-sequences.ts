/**
 * Fix PostgreSQL sequences after migration from SQLite
 *
 * This script resets all autoincrement sequences to MAX(id) + 1
 * to prevent unique constraint violations.
 *
 * Usage:
 *   # On production via SSH:
 *   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484
 *   npx tsx scripts/fix-sequences.ts
 *
 *   # Or remotely:
 *   fly ssh console -a glass-loans-brochure-modified-misty-thunder-1484 -C "npx tsx scripts/fix-sequences.ts"
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const tables = [
  "users",
  "underwriting_submissions",
  "subscriptions",
  "sessions",
  "rate_limits",
  "batchdata_address_cache",
  "batchdata_property_cache",
  "batchdata_comps_cache",
  "batchdata_api_usage",
  "realie_comps_cache",
  "realie_api_usage",
];

async function fixSequences() {
  console.log("🔧 Fixing PostgreSQL sequences...\n");

  for (const table of tables) {
    try {
      const sql = `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`;
      const result = await prisma.$queryRawUnsafe(sql);
      console.log(`✅ Fixed ${table}`);
    } catch (error: any) {
      console.error(`❌ Failed to fix ${table}:`, error.message);
    }
  }

  console.log("\n✅ All sequences fixed!");
}

fixSequences()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    pool.end();
    process.exit(1);
  });
