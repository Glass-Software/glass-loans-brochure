/**
 * Prisma Client for Glass Loans Underwriting Tool
 * Replaces SQLite with PostgreSQL
 */

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Use globalThis to persist singleton across Next.js module reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  console.log("🔵 [Prisma] Creating Prisma client...");
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  console.log("🔵 [Prisma] DATABASE_URL found, creating Pool...");

  // Create PostgreSQL connection pool with serverless-optimized settings
  // References:
  // - https://node-postgres.com/apis/pool (node-postgres Pool config)
  // - https://www.prisma.io/docs/orm/prisma-client/deployment/serverless (Prisma serverless best practices)
  // - https://github.com/brianc/node-postgres/issues/1222 (Production pool settings discussion)
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    // Connection pool limits (conservative for Fly.io serverless)
    // With multiple instances, total connections = max × instance_count
    max: 5, // Max 5 connections per instance (down from default 10)
    min: 0, // Allow pool to drain completely when idle

    // Timeouts to prevent indefinite hangs (critical for serverless)
    connectionTimeoutMillis: 5000, // 5 sec timeout when acquiring connection from pool
    // Default 0 (wait forever) is dangerous in production - causes indefinite hangs

    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    // Default 10s is too aggressive, 30s recommended for most apps
    // Must be lower than infrastructure timeouts (load balancer, PgBouncer)

    // Keep-alive to detect dead connections early
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,

    // Recycle connections after heavy use (prevents slow memory leaks)
    maxUses: 7500, // Close connection after 7500 queries
  });

  console.log("🔵 [Prisma] Pool created, creating adapter...");

  // Create Prisma adapter for PostgreSQL
  // @ts-ignore - Type mismatch between @types/pg versions (functionally identical)
  const adapter = new PrismaPg(pool);
  console.log("🔵 [Prisma] Adapter created, creating Prisma Client...");

  // Create Prisma Client with adapter and timeout protection
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  console.log("✅ [Prisma] Prisma Client created successfully");

  return client;
}

/**
 * Get or create Prisma Client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Export singleton instance
export const prisma = getPrismaClient();

/**
 * Close Prisma connection (for graceful shutdown)
 */
export async function closePrisma(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}

// Graceful shutdown handlers
if (typeof process !== "undefined") {
  const HANDLERS_KEY = Symbol.for("glass-loans.prisma.handlers") as any;

  if (!process[HANDLERS_KEY]) {
    process[HANDLERS_KEY] = true;

    process.on("SIGINT", async () => {
      console.log("Received SIGINT, closing Prisma connection...");
      await closePrisma();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("Received SIGTERM, closing Prisma connection...");
      await closePrisma();
      process.exit(0);
    });

    process.on("exit", () => {
      // Synchronous cleanup
      if (globalForPrisma.prisma) {
        globalForPrisma.prisma.$disconnect();
      }
    });
  }
}
