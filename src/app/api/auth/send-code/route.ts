import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import { findUserByNormalizedEmail, generateVerificationCode, updateMarketingConsent } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { sendWithFallback, isEmailServiceConfigured } from "@/lib/email/service";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isEmailServiceConfigured()) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  try {
    // Rate limit: 5 requests per IP per 10 minutes
    const ip = getClientIp(request);
    const rl = checkRateLimit(`auth-send-code:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, firstName, lastName, marketingConsent } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find user by normalized email
    const normalizedEmail = normalizeEmail(email);
    const user = await findUserByNormalizedEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email. Please complete checkout first." },
        { status: 404 }
      );
    }

    // Update user information if provided
    if (firstName && lastName) {
      // For Pro signup, unconditionally update the name (user explicitly provided it)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        },
      });
      console.log(`✅ [send-code] Updated name for user ${user.id}: ${firstName} ${lastName}`);
    }

    if (marketingConsent !== undefined) {
      await updateMarketingConsent(user.id, marketingConsent);
      console.log(`✅ [send-code] Updated marketing consent for user ${user.id}: ${marketingConsent}`);
    }

    // Generate verification code
    const result = await generateVerificationCode(user.id);
    const code = result.code;

    // Send verification email
    await sendProSignupCodeEmail(email, code, firstName);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error: any) {
    console.error("❌ [send-code-pro] Error:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}

/**
 * Send Pro signup verification code (SendGrid with Resend fallback)
 */
async function sendProSignupCodeEmail(email: string, code: string, firstName?: string) {
  const greeting = firstName ? `Hi ${firstName},` : 'Welcome to Glass Loans Pro!';
  const greetingHtml = firstName ? `Hi ${firstName},` : 'Welcome to Pro!';

  await sendWithFallback({
    to: email,
    subject: "Welcome to Glass Loans Pro - Verify Your Email",
    text: `${greeting}

Your verification code is: ${code}

This code expires in 10 minutes.

Enter this code to access your Pro dashboard and start analyzing unlimited properties.

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
    <h1 style="color: white; margin: 0;">Glass Loans Pro</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">${greetingHtml}</h2>
    <p>Thank you for upgrading to Glass Loans Pro. Enter this code to verify your email and access your dashboard:</p>
    <div style="background-color: #fff; border: 2px solid #4A6CF7; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
      <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4A6CF7;">${code}</div>
    </div>
    <p style="font-size: 14px; color: #666;">
      This code expires in 10 minutes. Didn't request this? Please contact support.
    </p>
    <div style="background-color: #e8f3ff; border-left: 4px solid #4A6CF7; padding: 15px; margin: 20px 0;">
      <strong style="color: #4A6CF7;">Your Pro Benefits:</strong>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>100 reports per month</li>
        <li>Unlimited report storage</li>
        <li>Priority support</li>
      </ul>
    </div>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">
      Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206
    </p>
  </div>
</body>
</html>`,
  });
}
