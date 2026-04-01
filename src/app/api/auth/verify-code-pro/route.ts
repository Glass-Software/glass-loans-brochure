import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import { verifyUserCode, findUserByNormalizedEmail } from "@/lib/db/queries";
import { createSession } from "@/lib/auth/session";
import { addFreeUser } from "@/lib/activecampaign/client";
import sgMail from "@sendgrid/mail";

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * POST /api/auth/verify-code-pro
 *
 * Verifies the 6-digit verification code for Pro signup and creates a session.
 * Called from the signup page after checkout.
 *
 * Request body:
 * - email: string - User's email address
 * - verificationCode: string - 6-digit code sent to user
 *
 * Response:
 * - success: boolean
 * - redirectTo: string - URL to redirect to (dashboard)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, verificationCode } = body;

    // Validate inputs
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!verificationCode || typeof verificationCode !== "string") {
      return NextResponse.json(
        { success: false, error: "Verification code is required" },
        { status: 400 }
      );
    }

    // Normalize email and verify code
    const normalizedEmail = normalizeEmail(email);
    const user = await verifyUserCode(verificationCode, normalizedEmail);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired verification code. Please request a new code.",
        },
        { status: 400 }
      );
    }

    // Get IP address and user agent for session tracking
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Create session (sets HTTP-only cookie)
    await createSession(user.id, ip, userAgent);

    console.log(`✅ Pro user ${user.id} logged in successfully`);

    // Add to ActiveCampaign if marketing consent is true
    // Fetch the latest user data to get updated name and marketing consent
    const updatedUser = await findUserByNormalizedEmail(normalizedEmail);

    if (updatedUser?.marketingConsent) {
      try {
        await addFreeUser(
          updatedUser.email,
          updatedUser.usageCount,
          undefined, // propertyState - not available at signup
          updatedUser.firstName || undefined,
          updatedUser.lastName || undefined
        );
        console.log(`✅ [verify-code-pro] Added user ${updatedUser.id} to ActiveCampaign`);
      } catch (acError: any) {
        // Don't block signup if ActiveCampaign fails
        console.error(`❌ [verify-code-pro] Failed to add user to ActiveCampaign:`, acError.message);
      }
    }

    // Send welcome email to Pro member
    if (process.env.SENDGRID_API_KEY) {
      try {
        await sendProWelcomeEmail(
          user.email,
          updatedUser?.firstName || undefined
        );
        console.log(`✅ [verify-code-pro] Sent welcome email to ${user.email}`);
      } catch (emailError: any) {
        // Don't block signup if email fails
        console.error(`❌ [verify-code-pro] Failed to send welcome email:`, emailError.message);
      }
    }

    // Return success with redirect URL
    return NextResponse.json({
      success: true,
      redirectTo: "/dashboard",
      user: {
        id: user.id,
        email: user.email,
        tier: user.tier,
      },
    });
  } catch (error) {
    console.error("❌ Verify code pro error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify code. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Send Pro welcome email via SendGrid
 */
async function sendProWelcomeEmail(email: string, firstName?: string) {
  const greeting = firstName ? `Hi ${firstName},` : 'Welcome!';
  const greetingHtml = firstName ? `Hi ${firstName},` : 'Welcome! 🎉';

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: "Welcome to Glass Loans Pro - You're All Set!",
    text: `${greeting}

Welcome to Glass Loans Pro! Your account is now active and ready to use.

YOUR PRO BENEFITS:
✓ 100 property reports per month
✓ Unlimited report storage and access to your history
✓ Priority support from our team

GET STARTED:
Visit your dashboard to get started: https://glassloans.io/dashboard

From your dashboard, you can:
- Access the underwriting tool
- View all your saved reports
- Track your monthly usage
- Access support

When you're ready to analyze a property, simply click "New Report" and enter the property address. Gary will provide you with:
- Estimated ARV and as-is value
- Comparable property analysis
- Visual comp selection with interactive maps
- Detailed renovation and financing calculations

Questions? Our support team is here to help. Just reply to this email.

Best,
Glass Loans Team`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4A6CF7; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Glass Loans Pro</h1>
    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">You're All Set!</p>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">${greetingHtml}</h2>

    <p style="font-size: 16px; line-height: 1.8;">
      Welcome to <strong>Glass Loans Pro</strong>! Your account is now active and ready to use.
    </p>

    <div style="background-color: #e8f3ff; border-left: 4px solid #4A6CF7; padding: 20px; margin: 25px 0; border-radius: 4px;">
      <h3 style="color: #4A6CF7; margin-top: 0; font-size: 18px;">Your Pro Benefits</h3>
      <ul style="margin: 10px 0; padding-left: 20px; line-height: 2;">
        <li><strong>100 property reports per month</strong></li>
        <li><strong>Unlimited report storage</strong> and access to your history</li>
        <li><strong>Priority support</strong> from our team</li>
      </ul>
    </div>

    <div style="background-color: white; border: 2px solid #4A6CF7; border-radius: 8px; padding: 25px; margin: 25px 0;">
      <h3 style="color: #4A6CF7; margin-top: 0; font-size: 18px;">Get Started</h3>
      <p style="margin: 15px 0;">
        Your dashboard is your home base. Start there to access all your Pro features:
      </p>
      <div style="text-align: center; margin: 20px 0;">
        <a href="https://glassloans.io/dashboard"
           style="display: inline-block; background-color: #4A6CF7; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
          Go to Dashboard →
        </a>
      </div>
      <p style="margin: 15px 0; font-size: 14px; color: #666;">
        <strong>From your dashboard, you can:</strong>
      </p>
      <ul style="font-size: 14px; color: #666; line-height: 1.8;">
        <li>Start a new property analysis with our AI-powered underwriting tool</li>
        <li>View and manage all your saved reports</li>
        <li>Track your monthly usage</li>
        <li>Access support and resources</li>
      </ul>
      <p style="margin: 15px 0; font-size: 14px; color: #666;">
        When you're ready to analyze a property, click <strong>"New Report"</strong> and enter the address. You'll get AI-powered ARV estimates, comparable properties with interactive maps, and detailed financing calculations.
      </p>
    </div>

    <div style="background-color: #fff9e6; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #666;">
        <strong style="color: #333;">Need Help?</strong><br>
        Our support team is here for you. Just reply to this email with any questions.
      </p>
    </div>

    <p style="font-size: 16px; margin-top: 30px;">
      Thanks for choosing Glass Loans Pro. We're excited to help you analyze deals faster and smarter!
    </p>

    <p style="font-size: 16px; margin-bottom: 0;">
      Best,<br>
      <strong>The Glass Loans Team</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206<br>
      <a href="https://glassloans.io" style="color: #4A6CF7; text-decoration: none;">glassloans.io</a>
    </p>
  </div>
</body>
</html>`,
  };

  await sgMail.send(msg);
}
