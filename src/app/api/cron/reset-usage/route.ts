import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Force dynamic behavior - no caching
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/cron/reset-usage
 *
 * Resets usage counts for Pro users whose monthly billing period has ended.
 * Called daily by Fly.io cron-manager.
 *
 * Security: Protected by FLY_API_TOKEN header check (set in fly.toml secrets)
 */
export async function POST(request: Request) {
  try {
    // Security: Verify request is from Fly cron-manager
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;

    // Debug logging (sanitized)
    console.log("🔍 [reset-usage] Auth check:", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 10) + "...",
      hasExpectedToken: !!expectedToken,
      expectedTokenPrefix: expectedToken?.substring(0, 10) + "...",
      match: authHeader === `Bearer ${expectedToken}`,
    });

    if (!expectedToken) {
      console.error("❌ [reset-usage] CRON_SECRET not configured in environment");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn("⚠️ [reset-usage] Unauthorized cron request");
      console.warn("⚠️ [reset-usage] Expected format: 'Bearer <token>'");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("🔄 [reset-usage] Starting monthly usage reset check...");

    // Find Pro users whose usage period has expired (30+ days since usagePeriodStart)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usersToReset = await prisma.user.findMany({
      where: {
        tier: "pro",
        usagePeriodStart: {
          not: null,
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        email: true,
        usageCount: true,
        usagePeriodStart: true,
      },
    });

    console.log(`📊 [reset-usage] Found ${usersToReset.length} users to reset`);

    if (usersToReset.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users need reset",
        resetCount: 0,
      });
    }

    // Reset usage count and update period start for each user
    const now = new Date();
    const updatePromises = usersToReset.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          usageCount: 0,
          usagePeriodStart: now,
        },
      })
    );

    await Promise.all(updatePromises);

    // Log details for monitoring
    usersToReset.forEach((user) => {
      console.log(
        `✅ [reset-usage] Reset user ${user.email}: ` +
        `usageCount ${user.usageCount} → 0, ` +
        `periodStart ${user.usagePeriodStart?.toISOString()} → ${now.toISOString()}`
      );
    });

    console.log(`✅ [reset-usage] Successfully reset ${usersToReset.length} users`);

    return NextResponse.json({
      success: true,
      message: `Reset ${usersToReset.length} users`,
      resetCount: usersToReset.length,
      users: usersToReset.map((u) => ({
        email: u.email,
        previousUsageCount: u.usageCount,
        previousPeriodStart: u.usagePeriodStart?.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("❌ [reset-usage] Error:", error);
    return NextResponse.json(
      { error: "Failed to reset usage counts", details: error.message },
      { status: 500 }
    );
  }
}
