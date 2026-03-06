/**
 * Add unlimited access user to production database
 * Run on fly.io: node add-user-production.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const email = 'will@urbangatecapital.com';
const normalizedEmail = email.toLowerCase().trim();

try {
  const dbPath = path.join(__dirname, 'glass-loans.db');
  console.log(`📂 Opening database: ${dbPath}`);
  const db = new Database(dbPath);

  // Check if user exists
  const user = db.prepare('SELECT * FROM users WHERE normalized_email = ?').get(normalizedEmail);

  if (user) {
    console.log(`\n✅ User found: ${user.email}`);
    console.log(`   Current usage: ${user.usage_count} / ${user.usage_limit}`);
    console.log(`   Email verified: ${user.email_verified ? 'Yes' : 'No'}`);

    // Update to unlimited
    db.prepare('UPDATE users SET usage_limit = 999999 WHERE normalized_email = ?').run(normalizedEmail);
    console.log(`\n🔓 Updated to unlimited access!`);
  } else {
    console.log(`\n➕ User not found, creating new user with unlimited access...`);

    // Create new user with unlimited access and verified email
    db.prepare(`
      INSERT INTO users (email, normalized_email, email_verified, usage_limit, created_at, updated_at)
      VALUES (?, ?, 1, 999999, datetime('now'), datetime('now'))
    `).run(email, normalizedEmail);

    console.log(`✅ User created successfully!`);
  }

  // Verify final state
  const updatedUser = db.prepare('SELECT * FROM users WHERE normalized_email = ?').get(normalizedEmail);
  console.log(`\n📊 Final user status:`);
  console.log(`   Email: ${updatedUser.email}`);
  console.log(`   Usage: ${updatedUser.usage_count} / ${updatedUser.usage_limit}`);
  console.log(`   Verified: ${updatedUser.email_verified ? 'Yes' : 'No'}`);
  console.log(`\n🎉 ${email} now has unlimited access!`);

  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
