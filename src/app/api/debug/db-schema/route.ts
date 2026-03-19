import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/sqlite";

/**
 * Debug endpoint to check database schema
 * DELETE THIS IN PRODUCTION after debugging!
 */
export async function GET() {
  try {
    const db = getDatabase();

    // Get users table schema
    const userColumns = db.pragma("table_info(users)") as Array<{
      name: string;
      type: string;
    }>;

    // Check for critical columns
    const hasVerificationCode = userColumns.some(col => col.name === "verification_code");
    const hasCodeExpiresAt = userColumns.some(col => col.name === "code_expires_at");

    return NextResponse.json({
      status: "ok",
      nodeEnv: process.env.NODE_ENV,
      dbPath: process.env.NODE_ENV === "production" ? "/data/glass-loans.db" : "./glass-loans.db",
      users_table: {
        columns: userColumns.map(col => col.name),
        hasVerificationCode,
        hasCodeExpiresAt,
        migration009Applied: hasVerificationCode && hasCodeExpiresAt,
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
