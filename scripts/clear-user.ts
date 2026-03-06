/**
 * Clear a user from the database by email
 * Usage: npx tsx scripts/clear-user.ts <email>
 */

import Database from "better-sqlite3";
import path from "path";

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error("❌ Please provide an email address");
  console.log("Usage: npx tsx scripts/clear-user.ts <email>");
  process.exit(1);
}

// Normalize email (same logic as in the app)
function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().trim().split("@");

  if (!localPart || !domain) {
    return email.toLowerCase().trim();
  }

  // Remove everything after + in local part
  const cleanLocalPart = localPart.split("+")[0];

  // For Gmail, also remove dots
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${cleanLocalPart.replace(/\./g, "")}@gmail.com`;
  }

  return `${cleanLocalPart}@${domain}`;
}

const normalizedEmail = normalizeEmail(email);

console.log(`🔍 Looking for user with email: ${email}`);
console.log(`📧 Normalized email: ${normalizedEmail}\n`);

// Connect to database
const dbPath = path.join(process.cwd(), "glass-loans.db");
const db = new Database(dbPath);

try {
  // Find user
  const user = db.prepare("SELECT * FROM users WHERE normalized_email = ?").get(normalizedEmail) as any;

  if (!user) {
    console.log("❌ User not found in database");
    db.close();
    process.exit(0);
  }

  console.log("✅ Found user:");
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Normalized: ${user.normalized_email}`);
  console.log(`   Verified: ${user.email_verified ? "Yes" : "No"}`);
  console.log(`   Usage: ${user.usage_count}/${user.usage_limit}`);
  console.log("");

  // Delete associated submissions first
  const submissions = db.prepare("SELECT COUNT(*) as count FROM underwriting_submissions WHERE user_id = ?").get(user.id) as any;

  if (submissions.count > 0) {
    console.log(`🗑️  Deleting ${submissions.count} submission(s)...`);
    db.prepare("DELETE FROM underwriting_submissions WHERE user_id = ?").run(user.id);
    console.log("✅ Submissions deleted");
  }

  // Delete user
  console.log("🗑️  Deleting user...");
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  console.log("✅ User deleted successfully!\n");

  console.log("🎉 Database cleared. You can now test with a fresh account.");

} catch (error: any) {
  console.error("❌ Error:", error.message);
  db.close();
  process.exit(1);
}

db.close();
