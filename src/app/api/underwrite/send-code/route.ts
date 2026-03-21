import { NextResponse } from "next/server";
import { normalizeEmail, isValidEmailFormat, isDisposableEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  generateVerificationCode,
  updateMarketingConsent,
} from "@/lib/db/queries";
import sgMail from "@sendgrid/mail";

// Initialize SendGrid once at module level
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function POST(request: Request) {
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

    // Check if user exists or create new one
    let user = findUserByNormalizedEmail(normalizedEmail);

    if (user) {
      updateMarketingConsent(user.id, marketingConsent);

      // Check usage limit for verified users
      if (user.email_verified && user.usage_count >= user.usage_limit) {
        return NextResponse.json(
          {
            error: `You've reached your limit of ${user.usage_limit} free underwriting ${user.usage_limit === 1 ? "analysis" : "analyses"}.`,
            limitReached: true,
          },
          { status: 403 }
        );
      }
    } else {
      const { user: newUser } = createUser(email, normalizedEmail, marketingConsent);
      user = newUser;
    }

    // Generate and send verification code
    const { code } = generateVerificationCode(user.id);
    await sendVerificationCodeEmail(email, code);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error: any) {
    console.error("❌ Send code error:", error.message);
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
