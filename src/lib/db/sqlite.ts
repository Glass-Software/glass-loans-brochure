/**
 * SQLite database connection for Glass Loans Underwriting Tool
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Use globalThis to persist singleton across Next.js module reloads
const globalForDb = globalThis as unknown as {
  db: Database.Database | undefined
  checkpointInterval: NodeJS.Timeout | undefined
}

/**
 * Get or create SQLite database connection
 */
export function getDatabase(): Database.Database {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  // Determine database path based on environment
  const dbPath =
    process.env.NODE_ENV === "production"
      ? "/data/glass-loans.db" // Fly.io persistent volume
      : path.join(process.cwd(), "glass-loans.db"); // Local development

  // Ensure directory exists in production
  if (process.env.NODE_ENV === "production") {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  console.log(`Connecting to SQLite database at: ${dbPath}`);

  // Create database connection
  globalForDb.db = new Database(dbPath);

  // Enable foreign keys and WAL mode for better concurrency
  globalForDb.db.pragma("foreign_keys = ON");
  globalForDb.db.pragma("journal_mode = WAL");

  // Set busy timeout to prevent indefinite locking (5 seconds max wait)
  // If another process holds a lock, we'll get an error instead of hanging forever
  globalForDb.db.pragma("busy_timeout = 5000");

  // Configure WAL checkpointing to prevent corruption
  // Checkpoint every 1000 pages or 5 minutes
  globalForDb.db.pragma("wal_autocheckpoint = 1000");

  // Clear old checkpoint interval if exists (prevent leaks on module reload)
  if (globalForDb.checkpointInterval) {
    clearInterval(globalForDb.checkpointInterval);
  }

  // Periodically checkpoint WAL to main DB (prevents corruption on crashes)
  if (typeof setInterval !== "undefined") {
    globalForDb.checkpointInterval = setInterval(() => {
      if (globalForDb.db) {
        try {
          globalForDb.db.pragma("wal_checkpoint(PASSIVE)");
        } catch (err) {
          console.error("WAL checkpoint failed:", err);
        }
      } else {
        if (globalForDb.checkpointInterval) {
          clearInterval(globalForDb.checkpointInterval);
          globalForDb.checkpointInterval = undefined;
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  return globalForDb.db;
}

/**
 * Run a query that returns multiple rows
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  } catch (error) {
    console.error("SQLite query error:", error);
    throw error;
  }
}

/**
 * Run a query that returns a single row
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    return (stmt.get(...params) as T) || null;
  } catch (error) {
    console.error("SQLite queryOne error:", error);
    throw error;
  }
}

/**
 * Run a query that modifies data (INSERT, UPDATE, DELETE)
 */
export function execute(sql: string, params: any[] = []): Database.RunResult {
  const db = getDatabase();
  try {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  } catch (error) {
    console.error("SQLite execute error:", error);
    throw error;
  }
}

/**
 * Run multiple queries in a transaction
 */
export function transaction<T>(
  callback: (db: Database.Database) => T,
): T {
  const db = getDatabase();
  const txn = db.transaction(callback);
  return txn(db);
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDatabase(): void {
  if (globalForDb.db) {
    globalForDb.db.close();
    globalForDb.db = undefined;
  }
  if (globalForDb.checkpointInterval) {
    clearInterval(globalForDb.checkpointInterval);
    globalForDb.checkpointInterval = undefined;
  }
}

// Graceful shutdown handlers (prevents corruption on server restart)
// Use Symbol.for() to create a process-wide flag that survives module reloads
const HANDLERS_KEY = Symbol.for('glass-loans.db.handlers') as any;

if (typeof process !== "undefined" && !process[HANDLERS_KEY]) {
  process[HANDLERS_KEY] = true;

  process.on("SIGINT", () => {
    if (globalForDb.db) {
      console.log("Received SIGINT, closing database...");
      closeDatabase();
    }
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    if (globalForDb.db) {
      console.log("Received SIGTERM, closing database...");
      closeDatabase();
    }
    process.exit(0);
  });

  process.on("exit", () => {
    closeDatabase();
  });
}
