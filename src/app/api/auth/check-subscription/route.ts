import { NextResponse } from "next/server";
import { findUserByNormalizedEmail } from "@/lib/db/queries";
import { normalizeEmail } from "@/lib/email/normalization";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByNormalizedEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json({ exists: false, ready: false });
    }

    // Check if user has Pro tier and subscription
    const hasSubscription = user.tier === "pro" && user.stripeCustomerId;

    return NextResponse.json({
      exists: true,
      ready: hasSubscription,
      userId: user.id,
      tier: user.tier,
    });
  } catch (error) {
    console.error("Error checking subscription:", error);
    return NextResponse.json(
      { error: "Failed to check subscription" },
      { status: 500 }
    );
  }
}
