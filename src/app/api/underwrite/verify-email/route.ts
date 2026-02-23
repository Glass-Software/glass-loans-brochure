import { NextResponse } from "next/server";
import { validateEmail } from "@/lib/email/abstractapi";
import { normalizeEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  regenerateVerificationToken,
} from "@/lib/db/queries";
import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    // Step 1: Validate email with AbstractAPI
    const validation = await validateEmail(email);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: validation.reason || "Invalid email address",
          suggestedEmail: validation.suggestedEmail,
        },
        { status: 400 },
      );
    }

    // Step 2: Normalize email to prevent +1 tricks
    const normalizedEmail = normalizeEmail(email);

    // Step 3: Check if user exists
    let user = await findUserByNormalizedEmail(normalizedEmail);

    if (user) {
      // User exists - check verification status and usage
      if (user.email_verified) {
        // Already verified - check usage limit
        if (user.usage_count >= 3) {
          return NextResponse.json({
            success: true,
            verified: true,
            usageCount: user.usage_count,
            limitReached: true,
            message:
              "You've reached your limit of 3 free underwriting analyses.",
          });
        }

        // Within limit - can proceed
        return NextResponse.json({
          success: true,
          verified: true,
          usageCount: user.usage_count,
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
  const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/underwrite/verify?token=${token}`;

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: "Verify Your Email - Glass Loans Underwriting Tool",
    text: `
Hi there,

Click the link below to verify your email and view your underwriting results:

${verificationUrl}

This link expires in 24 hours.

Note: You can use this tool 3 times per verified email address.

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
      <strong>Note:</strong> You can use this tool <strong>3 times</strong> per verified email address.
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
