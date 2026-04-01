import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { normalizeEmail, isValidEmailFormat, isDisposableEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  generateVerificationCode,
  updateMarketingConsent,
  setPromoExpiry,
} from "@/lib/db/queries";
import sgMail from "@sendgrid/mail";
import { addFreeUser } from "@/lib/activecampaign/client";

// Initialize SendGrid once at module level
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Timeout utility to prevent indefinite hangs
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Add runtime config for Next.js to extend timeout
export const maxDuration = 30; // Max 30 seconds for this route
export const dynamic = 'force-dynamic'; // Ensure no caching

export async function POST(request: Request) {
  const startTime = Date.now();
  console.log("🔵 [send-code] Starting request...");
  console.log("🔵 [send-code] DATABASE_URL exists:", !!process.env.DATABASE_URL);
  console.log("🔵 [send-code] DATABASE_URL starts with:", process.env.DATABASE_URL?.substring(0, 20));

  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { email, marketingConsent = false } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmailFormat(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json({ error: "Disposable email addresses are not allowed" }, { status: 400 });
    }

    // Normalize email
    const normalizedEmail = normalizeEmail(email);
    console.log(`🔵 [send-code] Processing email: ${email} (normalized: ${normalizedEmail})`);

    // Check if user exists or create new one (with timeout protection)
    let user;
    try {
      console.log("🔵 [send-code] About to call findUserByNormalizedEmail...");
      const findUserPromise = findUserByNormalizedEmail(normalizedEmail);
      console.log("🔵 [send-code] findUserByNormalizedEmail called, waiting for response...");

      user = await withTimeout(
        findUserPromise,
        3000,
        "Database query (findUser)"
      );
      console.log(`🔵 [send-code] User query completed in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      console.error("❌ [send-code] Database query error:", error.message);
      console.error("❌ [send-code] Error stack:", error.stack);
      return NextResponse.json(
        { error: "Database timeout. Please try again." },
        { status: 503 }
      );
    }

    if (user) {
      try {
        console.log("🔵 [send-code] Updating marketing consent...");
        await withTimeout(
          updateMarketingConsent(user.id, marketingConsent),
          2000,
          "Database update (marketing consent)"
        );
      } catch (error: any) {
        console.error("❌ [send-code] Marketing consent update timeout:", error.message);
        // Non-critical, continue anyway
      }

      // Note: We don't block sending verification codes based on usage limit
      // The limit is enforced at report submission time, not email verification
      // This allows users to verify their email and see the promo banner after verification
    } else {
      try {
        console.log("🔵 [send-code] Creating new user...");
        const result = await withTimeout(
          createUser(email, normalizedEmail, marketingConsent),
          3000,
          "Database insert (createUser)"
        );
        user = result.user;
        console.log(`🔵 [send-code] User created in ${Date.now() - startTime}ms`);
      } catch (error: any) {
        console.error("❌ [send-code] User creation timeout:", error.message);
        return NextResponse.json(
          { error: "Database timeout. Please try again." },
          { status: 503 }
        );
      }
    }

    // Add user to ActiveCampaign list 11 if they consented to marketing
    if (marketingConsent) {
      try {
        console.log("📧 [send-code] Adding user to ActiveCampaign list 11...");
        await withTimeout(
          addFreeUser(email, user.usageCount),
          5000,
          "ActiveCampaign API call"
        );
        console.log(`✅ [send-code] User added to ActiveCampaign list 11 in ${Date.now() - startTime}ms`);
      } catch (error: any) {
        // Log error but don't fail the request - ActiveCampaign is non-critical
        console.error("❌ [send-code] ActiveCampaign error (non-critical, continuing):", error.message);
      }
    }

    // Check usage limit for verified users BEFORE proceeding to Step 6
    // This prevents expensive API calls for users who have hit their limit
    if (user.emailVerified && user.usageCount >= user.usageLimit) {
      // Only set promo expiry if user doesn't already have one OR if it has expired
      let promoExpiresAt: Date;

      if (user.promoExpiresAt && new Date(user.promoExpiresAt) > new Date()) {
        // User already has an active promo - don't reset the timer
        promoExpiresAt = new Date(user.promoExpiresAt);
        console.log("🎁 [send-code] User already has active promo, not resetting timer");
      } else {
        // Set new promo expiry (1 hour from now)
        promoExpiresAt = new Date(Date.now() + 3600000);
        try {
          await setPromoExpiry(user.id);
          console.log("🎁 [send-code] New promo expiry set for user", user.id);
        } catch (error: any) {
          console.error("❌ [send-code] Failed to set promo expiry:", error);
        }
      }

      // Set cookie for client-side banner (persists across page reloads)
      const cookieStore = await cookies();
      cookieStore.set("gl_promo_expires", promoExpiresAt.toISOString(), {
        path: "/",
        sameSite: "lax",
        maxAge: 3600, // 1 hour (matches promo duration)
        secure: process.env.NODE_ENV === "production",
        httpOnly: false, // Client needs to read this for banner
      });
      console.log("🍪 [send-code] Promo cookie set:", promoExpiresAt.toISOString());

      return NextResponse.json(
        {
          error: `You've reached your limit of ${user.usage_limit} free reports. Upgrade to Pro for 100 reports per month.`,
          limitReached: true,
          promoExpiresAt: promoExpiresAt.toISOString(),
        },
        { status: 403 }
      );
    }

    // Generate verification code (with timeout protection)
    let code: string;
    try {
      console.log("🔵 [send-code] Generating verification code...");
      const result = await withTimeout(
        generateVerificationCode(user.id),
        2000,
        "Database update (generateCode)"
      );
      code = result.code;
      console.log(`🔵 [send-code] Code generated in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      console.error("❌ [send-code] Code generation timeout:", error.message);
      return NextResponse.json(
        { error: "Database timeout. Please try again." },
        { status: 503 }
      );
    }

    // Send email with timeout protection (SendGrid can hang)
    try {
      console.log("🔵 [send-code] Sending email via SendGrid...");
      await withTimeout(
        sendVerificationCodeEmail(email, code),
        15000, // 15 second timeout for SendGrid
        "SendGrid email send"
      );
      console.log(`✅ [send-code] Email sent successfully in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      console.error("❌ [send-code] SendGrid timeout or error:", error.message);
      return NextResponse.json(
        { error: "Email service timeout. Please try again in a moment." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error: any) {
    console.error("❌ [send-code] Unexpected error:", error.message, error.stack);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}

/**
 * Send 6-digit verification code via SendGrid
 */
async function sendVerificationCodeEmail(email: string, code: string) {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: "Your Verification Code - Glass Loans",
    text: `Your verification code is: ${code}

This code expires in 10 minutes.

Enter this code on the Glass Loans website to view your underwriting report.

Best,
Glass Loans Team`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4A6CF7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Glass Loans</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
    <p>Enter this code on the Glass Loans website to verify your email and view your underwriting report:</p>
    <div style="background-color: #fff; border: 2px solid #4A6CF7; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4A6CF7;">${code}</div>
    </div>
    <p style="font-size: 14px; color: #666;">
      This code expires in 10 minutes. Didn't request this? You can safely ignore this email.
    </p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">
      Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206
    </p>
  </div>
</body>
</html>`,
  };

  await sgMail.send(msg);
}
