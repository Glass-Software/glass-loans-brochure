import { NextResponse } from "next/server";
// import { validateEmail } from "@/lib/email/abstractapi"; // COMMENTED OUT: Using half our quota, restore if needed
import { normalizeEmail, isValidEmailFormat, isDisposableEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  generateVerificationCode,
  checkRateLimit,
  updateMarketingConsent,
} from "@/lib/db/queries";
import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Set max duration for Vercel/production deployments
export const maxDuration = 60;

export async function POST(request: Request) {
  console.log("📧 [send-code] POST request received");

  try {
    console.log("📧 [send-code] Parsing request body...");
    const body = await request.json();
    const { email, marketingConsent = false } = body;
    console.log("📧 [send-code] Body parsed:", { email, marketingConsent });

    if (!email) {
      console.log("📧 [send-code] ERROR: Email is required");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    // Rate limit: 5 requests per hour per IP
    console.log("📧 [send-code] Getting IP address for rate limiting...");
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    console.log("📧 [send-code] IP address:", ip);

    console.log("📧 [send-code] Calling checkRateLimit...");
    let rateLimit: { allowed: boolean; remaining: number };
    try {
      rateLimit = checkRateLimit(ip, "/api/underwrite/send-code", 5, 60);
      console.log("📧 [send-code] ✅ Rate limit check completed:", rateLimit);
    } catch (rateLimitError: any) {
      console.error("📧 [send-code] ❌ Rate limit check FAILED:", rateLimitError);
      console.error("📧 [send-code] Rate limit error details:", {
        message: rateLimitError.message,
        stack: rateLimitError.stack,
      });
      // Continue without rate limiting if it fails
      rateLimit = { allowed: true, remaining: 5 };
      console.log("📧 [send-code] Continuing without rate limiting due to error");
    }

    if (!rateLimit.allowed) {
      console.log("📧 [send-code] ERROR: Rate limit exceeded");
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    // Step 1: Validate email quality (Basic validation - AbstractAPI commented out)
    // const validation = await validateEmail(email);

    // Basic validation without Abstract API
    console.log("📧 [send-code] Validating email format...");
    if (!isValidEmailFormat(email)) {
      console.log("📧 [send-code] ERROR: Invalid email format");
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 },
      );
    }

    console.log("📧 [send-code] Checking for disposable email...");
    if (isDisposableEmail(email)) {
      console.log("📧 [send-code] ERROR: Disposable email detected");
      return NextResponse.json(
        { error: "Disposable email addresses are not allowed" },
        { status: 400 },
      );
    }

    // Step 2: Normalize email
    console.log("📧 [send-code] Normalizing email...");
    const normalizedEmail = normalizeEmail(email);
    console.log("📧 [send-code] Normalized email:", normalizedEmail);

    // Step 3: Check if user exists
    console.log("📧 [send-code] Checking if user exists...");
    let user = findUserByNormalizedEmail(normalizedEmail);

    if (user) {
      console.log("📧 [send-code] User found:", { id: user.id, email_verified: user.email_verified, usage_count: user.usage_count, usage_limit: user.usage_limit });

      // Update marketing consent for existing user
      console.log("📧 [send-code] Updating marketing consent...");
      updateMarketingConsent(user.id, marketingConsent);

      // Check if already verified
      if (user.email_verified) {
        // Check usage limit
        if (user.usage_count >= user.usage_limit) {
          console.log("📧 [send-code] ERROR: Usage limit reached");
          return NextResponse.json(
            {
              error: `You've reached your limit of ${user.usage_limit} free underwriting ${user.usage_limit === 1 ? "analysis" : "analyses"}.`,
              limitReached: true,
            },
            { status: 403 },
          );
        }
      }
    } else {
      // Create new user with marketing consent
      console.log("📧 [send-code] Creating new user...");
      const { user: newUser } = createUser(email, normalizedEmail, marketingConsent);
      user = newUser;
      console.log("📧 [send-code] New user created:", { id: user.id });
    }

    // Step 4: Generate and send verification code
    console.log("📧 [send-code] Generating verification code...");
    const { code } = generateVerificationCode(user.id);
    console.log("📧 [send-code] Verification code generated");

    try {
      console.log("📧 [send-code] Attempting to send email...");

      // Add timeout to prevent indefinite hanging
      const emailPromise = sendVerificationCodeEmail(email, code);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email sending timeout after 30 seconds")), 30000)
      );

      await Promise.race([emailPromise, timeoutPromise]);
      console.log("📧 [send-code] Email sent successfully");
    } catch (emailError: any) {
      console.error("📧 [send-code] ❌ SendGrid email error:", emailError);
      console.error("📧 [send-code] SendGrid error details:", {
        message: emailError.message,
        code: emailError.code,
        statusCode: emailError.response?.statusCode,
        body: emailError.response?.body,
      });
      throw new Error(`Email sending failed: ${emailError.message}`);
    }

    console.log("📧 [send-code] ✅ Request completed successfully");
    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error: any) {
    console.error("📧 [send-code] ❌ Unexpected error:", error);
    console.error("📧 [send-code] Error details:", {
      message: error.message,
      code: error.code,
      response: error.response?.body,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: "Failed to send verification code", details: error.message },
      { status: 500 },
    );
  }
}

/**
 * Send 6-digit verification code via SendGrid
 */
async function sendVerificationCodeEmail(email: string, code: string) {
  console.log("Attempting to send email:", {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
  });

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: "Your Verification Code - Glass Loans",
    text: `
Your verification code is: ${code}

This code expires in 10 minutes.

Enter this code on the Glass Loans website to view your underwriting report.

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
</html>
    `,
  };

  try {
    console.log("📧 [sendEmail] Calling sgMail.send...");
    const result = await sgMail.send(msg);
    console.log("📧 [sendEmail] ✅ Email sent successfully:", {
      to: email,
      statusCode: result[0]?.statusCode,
    });
  } catch (error: any) {
    console.error("📧 [sendEmail] ❌ sgMail.send failed:", error);
    console.error("📧 [sendEmail] Error response:", {
      statusCode: error.response?.statusCode,
      body: error.response?.body,
      headers: error.response?.headers,
    });
    throw error;
  }
}
