import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { randomBytes } from "crypto";

const SESSION_COOKIE_NAME = "gl_session";
const SESSION_DURATION_DAYS = 30;

/**
 * Generate a secure random session token
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create a new session for a user
 */
export async function createSession(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  // Set HTTP-only cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return sessionToken;
}

/**
 * Get current user from session cookie
 * Returns null if no valid session exists
 */
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionToken) {
      return null;
    }

    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    return session.user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Require authentication - returns user or throws error
 * Use this in API routes and server components that require auth
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized - Please sign in");
  }

  return user;
}

/**
 * Delete current session (logout)
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.session.delete({
      where: { sessionToken },
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Delete a specific session by token
 */
export async function deleteSessionByToken(sessionToken: string): Promise<void> {
  await prisma.session.delete({
    where: { sessionToken },
  });
}

/**
 * Clean up expired sessions (can be run as a cron job)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
