#!/usr/bin/env node

/**
 * Update User Usage Limit
 * Helper script to change a user's usage limit (for upgrades/downgrades)
 *
 * Usage:
 *   node update-user-limit.js user@example.com 10
 *   node update-user-limit.js user@example.com unlimited
 *   node update-user-limit.js user@example.com reset (resets to 3)
 */

const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "glass-loans.db");

/**
 * Normalize email (duplicated from src/lib/email/normalization.ts)
 */
function normalizeEmail(email) {
  let normalized = email.toLowerCase().trim();
  const [local, domain] = normalized.split("@");

  if (!local || !domain) {
    throw new Error("Invalid email format");
  }

  const localWithoutPlus = local.split("+")[0];

  let finalLocal = localWithoutPlus;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    finalLocal = localWithoutPlus.replace(/\./g, "");
  }

  return `${finalLocal}@${domain}`;
}

// Get command line arguments
const email = process.argv[2];
const limitArg = process.argv[3];

if (!email || !limitArg) {
  console.log("Usage: node update-user-limit.js <email> <limit>");
  console.log("\nExamples:");
  console.log("  node update-user-limit.js user@example.com 10     # Set limit to 10");
  console.log("  node update-user-limit.js user@example.com 999999 # Set to unlimited (high number)");
  console.log("  node update-user-limit.js user@example.com reset  # Reset to default (3)");
  process.exit(1);
}

try {
  // Parse limit
  let newLimit;
  if (limitArg === "reset") {
    newLimit = 3; // Default free tier
  } else if (limitArg === "unlimited") {
    newLimit = 999999; // Effectively unlimited
  } else {
    newLimit = parseInt(limitArg, 10);
    if (isNaN(newLimit) || newLimit < 0) {
      console.error("❌ Invalid limit. Must be a positive number, 'unlimited', or 'reset'");
      process.exit(1);
    }
  }

  // Normalize email to find user
  const normalizedEmail = normalizeEmail(email);

  // Connect to database
  const db = new Database(dbPath);

  // Find user
  const user = db
    .prepare("SELECT * FROM users WHERE normalized_email = ? LIMIT 1")
    .get(normalizedEmail);

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log("   (Normalized to:", normalizedEmail + ")");
    db.close();
    process.exit(1);
  }

  console.log(`\nFound user: ${user.email}`);
  console.log(`  Current usage: ${user.usage_count}/${user.usage_limit}`);
  console.log(`  Email verified: ${user.email_verified ? "Yes" : "No"}`);

  // Update limit
  db.prepare("UPDATE users SET usage_limit = ? WHERE id = ?").run(
    newLimit,
    user.id
  );

  // Verify update
  const updatedUser = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(user.id);

  console.log(`\n✅ Updated successfully!`);
  console.log(`  New limit: ${updatedUser.usage_limit}`);
  console.log(`  Remaining uses: ${updatedUser.usage_limit - updatedUser.usage_count}`);

  if (updatedUser.usage_limit === 999999) {
    console.log(`  Status: Unlimited (premium tier)`);
  } else if (updatedUser.usage_limit === 3) {
    console.log(`  Status: Free tier`);
  } else {
    console.log(`  Status: Custom tier`);
  }

  db.close();
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}
