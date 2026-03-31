import { NextResponse } from "next/server";
// import { validateEmail } from "@/lib/email/abstractapi"; // COMMENTED OUT: Using half our quota, restore if needed
import { normalizeEmail, isValidEmailFormat, isDisposableEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  regenerateVerificationToken,
} from "@/lib/db/queries";
import sgMail from "@sendgrid/mail";

export async function POST(request: Request) {
  // Initialize SendGrid at runtime (not build time)
  if (!process.env.SENDGRID_API_KEY) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    // Step 1: Validate email quality (Basic validation - AbstractAPI commented out)
    // const validation = await validateEmail(email);

    // Basic validation without Abstract API
    if (!isValidEmailFormat(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed" },
        { status: 400 },
      );
    }

    // Step 2: Normalize email to prevent abuse via +1 tricks
    // This is the PRIMARY anti-abuse mechanism:
    // user+1@gmail.com, user+2@gmail.com → user@gmail.com
    // Ensures all variations map to the same database record
    const normalizedEmail = normalizeEmail(email);

    // Step 3: Check if user exists (by normalized email)
    let user = await findUserByNormalizedEmail(normalizedEmail);

    if (user) {
      // User exists - check verification status and usage
      if (user.email_verified) {
        // Already verified - check usage limit
        if (user.usage_count >= user.usage_limit) {
          return NextResponse.json({
            success: true,
            verified: true,
            usageCount: user.usage_count,
            usageLimit: user.usage_limit,
            limitReached: true,
            message: `You've reached your limit of ${user.usage_limit} free reports. Upgrade to Pro for 100 reports per month.`,
          });
        }

        // Within limit - can proceed
        return NextResponse.json({
          success: true,
          verified: true,
          usageCount: user.usage_count,
          usageLimit: user.usage_limit,
          limitReached: false,
        });
      } else {
        // Not verified yet - regenerate token and resend
        const { user: updatedUser, token } =
          await regenerateVerificationToken(user.id);
        user = updatedUser;

        // Send verification email
        await sendVerificationEmail(email, token);

        return NextResponse.json({
          success: true,
          verified: false,
          message: "Verification email sent. Please check your inbox.",
        });
      }
    }

    // Step 4: New user - create and send verification
    const { user: newUser, token } = await createUser(email, normalizedEmail);

    // Send verification email
    await sendVerificationEmail(email, token);

    return NextResponse.json({
      success: true,
      verified: false,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error: any) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: "Failed to process email verification" },
      { status: 500 },
    );
  }
}

/**
 * Send verification email via SendGrid
 */
async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "https://glassloans.io"}/underwrite/verify?token=${token}`;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: "Verify Your Email - Glass Loans Underwriting Tool",
    text: `
Hi there,

Click the link below to verify your email and view your underwriting results:

${verificationUrl}

This link expires in 24 hours.

Note: Free tier includes limited uses per verified email address.

Best,
Glass Loans Team
    `,
    html: `
<!DOCTYPE html>
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
    <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>

    <p>Hi there,</p>

    <p>Click the button below to verify your email and view your AI-powered underwriting results from Gary:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #4A6CF7; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email & View Results</a>
    </div>

    <p style="font-size: 14px; color: #666;">
      This link expires in 24 hours. Didn't request this? You can safely ignore this email.
    </p>

    <p style="font-size: 14px; color: #666;">
      <strong>Note:</strong> Free tier includes limited uses per verified email address.
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206
    </p>
  </div>
</body>
</html>
    `,
  };

  await sgMail.send(msg);
}
