#!/usr/bin/env tsx
/**
 * Script to send Pro welcome email to a specific user
 *
 * Usage:
 *   npx tsx scripts/send-welcome-email.ts will@urbangatecapital.com
 *   npx tsx scripts/send-welcome-email.ts email@example.com "John"
 */

import sgMail from "@sendgrid/mail";
import { findUserByNormalizedEmail } from "@/lib/db/queries";
import { normalizeEmail } from "@/lib/email/normalization";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY not found in environment variables");
  process.exit(1);
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send Pro welcome email via SendGrid
 */
async function sendProWelcomeEmail(email: string, firstName?: string) {
  const greeting = firstName ? `Hi ${firstName},` : 'Welcome!';
  const greetingHtml = firstName ? `Hi ${firstName},` : 'Welcome! 🎉';

  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: "Welcome to Glass Underwrite Pro - You're All Set!",
    text: `${greeting}

Welcome to Glass Underwrite Pro! Your account is now active and ready to use.

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
    <h1 style="color: white; margin: 0; font-size: 28px;">Glass Underwrite Pro</h1>
    <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">You're All Set!</p>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">${greetingHtml}</h2>

    <p style="font-size: 16px; line-height: 1.8;">
      Welcome to <strong>Glass Underwrite Pro</strong>! Your account is now active and ready to use.
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
      Thanks for choosing Glass Underwrite Pro. We're excited to help you analyze deals faster and smarter!
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

async function main() {
  const email = process.argv[2];
  const firstNameOverride = process.argv[3];

  if (!email) {
    console.error("❌ Usage: npx tsx scripts/send-welcome-email.ts <email> [firstName]");
    console.error("   Example: npx tsx scripts/send-welcome-email.ts will@urbangatecapital.com");
    process.exit(1);
  }

  console.log("\n🚀 Sending Pro welcome email...\n");
  console.log("Email:", email);

  try {
    // Look up user in database to get their first name (unless overridden)
    let firstName = firstNameOverride;

    if (!firstName) {
      const normalizedEmail = normalizeEmail(email);
      const user = await findUserByNormalizedEmail(normalizedEmail);

      if (user?.firstName) {
        firstName = user.firstName;
        console.log("First Name:", firstName, "(from database)");
      } else {
        console.log("First Name: (none - will use generic greeting)");
      }
    } else {
      console.log("First Name:", firstName, "(from command line)");
    }

    console.log("\n" + "=".repeat(60) + "\n");

    const startTime = Date.now();
    await sendProWelcomeEmail(email, firstName);
    const duration = Date.now() - startTime;

    console.log(`✅ Welcome email sent successfully in ${duration}ms`);
    console.log("\n📧 Check the inbox for:", email);
    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error: any) {
    console.error("\n❌ Failed to send email:", error.message);
    if (error.response?.body) {
      console.error("SendGrid error:", error.response.body);
    }
    process.exit(1);
  }
}

main();
