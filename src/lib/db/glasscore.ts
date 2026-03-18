/**
 * GlassCore PostgreSQL Database Connection
 *
 * Shared property database accessible by both:
 * - Website (glassloans.io)
 * - App (app.glassloans.io)
 *
 * Stores: properties, valuations, comps, sales history
 */
import { Pool, PoolClient, QueryResult } from 'pg';

let pool: Pool | null = null;

/**
 * Get or create PostgreSQL connection pool
 */
export function getGlassCorePool(): Pool {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.GLASSCORE_DATABASE_URL;

  if (!connectionString) {
    throw new Error('GLASSCORE_DATABASE_URL environment variable is not set');
  }

  console.log('Connecting to GlassCore PostgreSQL database');

  pool = new Pool({
    connectionString,
    // Connection pool settings
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 2000, // Return error after 2s if connection cannot be established
    // SSL for production (fly.io Postgres)
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false // fly.io uses self-signed certs
    } : false
  });

  // Error handler for pool
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });

  return pool;
}

/**
 * Execute a query that returns multiple rows
 */
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const pool = getGlassCorePool();
  try {
    const result: QueryResult = await pool.query(sql, params);
    return result.rows as T[];
  } catch (error) {
    console.error('PostgreSQL query error:', error);
    throw error;
  }
}

/**
 * Execute a query that returns a single row
 */
export async function queryOne<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const pool = getGlassCorePool();
  try {
    const result: QueryResult = await pool.query(sql, params);
    return result.rows[0] || null;
  } catch (error) {
    console.error('PostgreSQL queryOne error:', error);
    throw error;
  }
}

/**
 * Execute a query that modifies data (INSERT, UPDATE, DELETE)
 */
export async function execute(
  sql: string,
  params: any[] = []
): Promise<QueryResult> {
  const pool = getGlassCorePool();
  try {
    return await pool.query(sql, params);
  } catch (error) {
    console.error('PostgreSQL execute error:', error);
    throw error;
  }
}

/**
 * Run multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getGlassCorePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('PostgreSQL transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close database connection pool (for graceful shutdown)
 */
export async function closeGlassCore(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Graceful shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, closing GlassCore database...');
    await closeGlassCore();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, closing GlassCore database...');
    await closeGlassCore();
    process.exit(0);
  });
}
