/**
 * GlassCore PostgreSQL Migration Runner
 *
 * Runs migrations for the shared GlassCore database
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function runMigrations() {
  const connectionString = process.env.GLASSCORE_DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: GLASSCORE_DATABASE_URL environment variable is not set');
    console.log('');
    console.log('Please set the connection string in your .env file:');
    console.log('GLASSCORE_DATABASE_URL=postgres://username:password@hostname:5432/dbname');
    console.log('');
    console.log('Or run locally with:');
    console.log('  GLASSCORE_DATABASE_URL="postgres://..." npx tsx scripts/migrate-glasscore.ts');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    console.log('🚀 GlassCore Database Migration');
    console.log('================================');
    console.log('');

    // Test connection
    console.log('📡 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully');
    console.log('');

    // Read migration file
    const migrationPath = path.join(
      process.cwd(),
      'src/lib/db/migrations/001_glasscore_initial.postgres.sql'
    );

    console.log('📄 Reading migration file...');
    console.log(`   ${migrationPath}`);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file loaded');
    console.log('');

    // Run migration
    console.log('🔄 Running migration...');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully');
    console.log('');

    // Verify tables were created
    console.log('🔍 Verifying schema...');
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('');
    console.log('📊 Created tables:');
    tables.rows.forEach((row) => {
      console.log(`   ✓ ${row.table_name}`);
    });
    console.log('');

    // Show data sources
    const sources = await pool.query('SELECT source, display_name, source_type FROM data_sources ORDER BY source');
    console.log('🔌 Data sources:');
    sources.rows.forEach((row) => {
      console.log(`   ✓ ${row.source} (${row.display_name}) - ${row.source_type}`);
    });
    console.log('');

    console.log('🎉 GlassCore database is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start using the GlassCore queries in your app');
    console.log('2. Import from: src/lib/db/glasscore-queries.ts');
    console.log('3. Example: await createValuation({ ... })');
    console.log('');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
