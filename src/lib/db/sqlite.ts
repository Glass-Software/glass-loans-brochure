/**
 * SQLite database connection for Glass Loans Underwriting Tool
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: Database.Database | null = null;

/**
 * Get or create SQLite database connection
 */
export function getDatabase(): Database.Database {
  if (db) {
    return db;
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
  db = new Database(dbPath);

  // Enable foreign keys and WAL mode for better concurrency
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");

  // Configure WAL checkpointing to prevent corruption
  // Checkpoint every 1000 pages or 5 minutes
  db.pragma("wal_autocheckpoint = 1000");

  // Periodically checkpoint WAL to main DB (prevents corruption on crashes)
  if (typeof setInterval !== "undefined") {
    const checkpointInterval = setInterval(() => {
      if (db) {
        try {
          db.pragma("wal_checkpoint(PASSIVE)");
        } catch (err) {
          console.error("WAL checkpoint failed:", err);
        }
      } else {
        clearInterval(checkpointInterval);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  return db;
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
  if (db) {
    db.close();
    db = null;
  }
}

// Graceful shutdown handlers (prevents corruption on server restart)
if (typeof process !== "undefined") {
  process.on("SIGINT", () => {
    console.log("Received SIGINT, closing database...");
    closeDatabase();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM, closing database...");
    closeDatabase();
    process.exit(0);
  });

  process.on("exit", () => {
    closeDatabase();
  });
}
