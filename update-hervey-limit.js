#!/usr/bin/env node

/**
 * Update usage limit for hervey711@gmail.com to 100000
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'glass-loans.db');
console.log(`Connecting to database at: ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check if user exists
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get('hervey711@gmail.com');

  if (!user) {
    console.error('❌ User hervey711@gmail.com not found in database');
    process.exit(1);
  }

  console.log('\n📋 Current user details:');
  console.log(`   Email: ${user.email}`);
  console.log(`   Current usage: ${user.usage_count}`);
  console.log(`   Current limit: ${user.usage_limit}`);
  console.log(`   Verified: ${user.email_verified ? 'Yes' : 'No'}`);

  // Update the limit to 100000
  const result = db.prepare(`
    UPDATE users
    SET usage_limit = ?,
        updated_at = DATETIME('now')
    WHERE email = ?
  `).run(100000, 'hervey711@gmail.com');

  if (result.changes > 0) {
    // Fetch updated user
    const updatedUser = db.prepare('SELECT * FROM users WHERE email = ?').get('hervey711@gmail.com');

    console.log('\n✅ Successfully updated usage limit!');
    console.log(`   New limit: ${updatedUser.usage_limit}`);
    console.log(`   Updated at: ${updatedUser.updated_at}`);
  } else {
    console.error('❌ Failed to update usage limit');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Error updating database:', error);
  process.exit(1);
} finally {
  db.close();
}
