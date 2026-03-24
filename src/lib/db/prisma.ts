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
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Create Prisma adapter for PostgreSQL
  // @ts-ignore - Type mismatch between @types/pg versions (functionally identical)
  const adapter = new PrismaPg(pool);

  // Create Prisma Client with adapter
  return new PrismaClient({ adapter });
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
