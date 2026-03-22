#!/usr/bin/env tsx
/**
 * Unlock usage limits for specific users
 * Usage: npx tsx scripts/unlock-users.ts
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Determine database path
const isProduction = process.env.NODE_ENV === "production" || fs.existsSync("/data");
const dbPath = isProduction
  ? "/data/glass-loans.db"
  : path.join(process.cwd(), "glass-loans.db");

console.log(`📊 Using database: ${dbPath}`);

const db = new Database(dbPath);

const emailsToUnlock = [
  "hervey711@gmail.com",
  "willcoleman202@gmail.com"
];

console.log("\n🔍 Checking current limits...\n");

for (const email of emailsToUnlock) {
  const user = db.prepare("SELECT email, usage_count, usage_limit FROM users WHERE email = ?").get(email);

  if (user) {
    console.log(`   ${email}:`);
    console.log(`   - Current usage: ${(user as any).usage_count}`);
    console.log(`   - Current limit: ${(user as any).usage_limit}`);
  } else {
    console.log(`   ⚠️  ${email}: User not found`);
  }
}

console.log("\n🔓 Unlocking limits...\n");

const updateStmt = db.prepare("UPDATE users SET usage_limit = 999999 WHERE email = ?");

for (const email of emailsToUnlock) {
  const result = updateStmt.run(email);
  if (result.changes > 0) {
    console.log(`   ✅ ${email}: Limit set to 999999`);
  } else {
    console.log(`   ⚠️  ${email}: No changes (user may not exist)`);
  }
}

console.log("\n✅ Verification:\n");

for (const email of emailsToUnlock) {
  const user = db.prepare("SELECT email, usage_count, usage_limit FROM users WHERE email = ?").get(email);

  if (user) {
    console.log(`   ${email}:`);
    console.log(`   - Usage: ${(user as any).usage_count}`);
    console.log(`   - Limit: ${(user as any).usage_limit}`);
  }
}

db.close();
console.log("\n✨ Done!\n");
