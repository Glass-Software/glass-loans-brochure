/**
 * Set unlimited API access for a specific email
 * Usage: npx tsx scripts/set-unlimited-access.ts <email>
 */

import Database from "better-sqlite3";
import path from "path";

const email = process.argv[2];

if (!email) {
  console.error("❌ Error: Email argument required");
  console.log("Usage: npx tsx scripts/set-unlimited-access.ts <email>");
  process.exit(1);
}

const dbPath = path.join(process.cwd(), "glass-loans.db");
const db = new Database(dbPath);

console.log(`🔓 Setting unlimited access for: ${email}\n`);

try {
  // Normalize email (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists
  const user = db.prepare("SELECT * FROM users WHERE normalized_email = ?").get(normalizedEmail) as any;

  if (user) {
    // User exists, update their limit
    console.log(`📊 Current user status:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Usage: ${user.usage_count} / ${user.usage_limit}`);
    console.log(`   Verified: ${user.email_verified ? "Yes" : "No"}\n`);

    // Set usage_limit to 999999 (effectively unlimited)
    db.prepare(`
      UPDATE users
      SET usage_limit = 999999
      WHERE normalized_email = ?
    `).run(normalizedEmail);

    console.log(`✅ Access updated successfully!\n`);
  } else {
    // User doesn't exist, create them with unlimited access
    console.log(`➕ User not found, creating new user with unlimited access...\n`);

    db.prepare(`
      INSERT INTO users (email, normalized_email, email_verified, usage_limit, created_at, updated_at)
      VALUES (?, ?, 1, 999999, datetime('now'), datetime('now'))
    `).run(email, normalizedEmail);

    console.log(`✅ User created successfully!\n`);
  }

  // Get final user state
  const updatedUser = db.prepare("SELECT * FROM users WHERE normalized_email = ?").get(normalizedEmail) as any;

  console.log(`📊 Final user status:`);
  console.log(`   Email: ${updatedUser.email}`);
  console.log(`   Usage: ${updatedUser.usage_count} / ${updatedUser.usage_limit}`);
  console.log(`   Verified: ${updatedUser.email_verified ? "Yes" : "No"}\n`);

  console.log(`🎉 ${email} now has unlimited API access!`);

} catch (error: any) {
  console.error("❌ Error:", error.message);
  db.close();
  process.exit(1);
}

db.close();
