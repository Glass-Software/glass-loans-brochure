#!/usr/bin/env node

/**
 * Test SQLite database connection and operations
 */

const Database = require('better-sqlite3');
const path = require('path');

async function testDatabase() {
  console.log('Testing SQLite database...');

  const dbPath = path.join(__dirname, 'glass-loans.db');
  console.log('Database path:', dbPath);

  try {
    // Connect to database
    const db = new Database(dbPath);
    console.log('✓ Database connection successful');

    // Test query
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();

    console.log('\n📊 Tables found:');
    tables.forEach((table) => {
      console.log(`  - ${table.name}`);
    });

    // Test user operations
    console.log('\n👥 Testing user operations...');

    // Create test user
    const result = db
      .prepare(
        `INSERT INTO users (email, normalized_email, email_verified)
         VALUES (?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET updated_at = DATETIME('now')`
      )
      .run('test@example.com', 'test@example.com', 1);

    console.log('✓ User insert/update successful');

    // Query test user
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get('test@example.com');

    console.log('✓ User query successful');
    console.log('User:', user);

    // Clean up test user
    db.prepare('DELETE FROM users WHERE email = ?').run('test@example.com');
    console.log('✓ Test user cleaned up');

    db.close();
    console.log('\n✅ Database test completed successfully!');
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
  }
}

testDatabase();
