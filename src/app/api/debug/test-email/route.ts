import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email/normalization";
import {
  findUserByNormalizedEmail,
  createUser,
  generateVerificationCode,
} from "@/lib/db/queries";
import sgMail from "@sendgrid/mail";

/**
 * DEBUG ENDPOINT - Test email sending
 * DELETE THIS IN PRODUCTION after debugging!
 *
 * Usage: GET /api/debug/test-email?email=your@email.com
 */
export async function GET(request: Request) {
  try {
    // Initialize SendGrid at runtime (not build time)
    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Provide ?email=your@email.com" },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);

    // Find or create user
    let user = await findUserByNormalizedEmail(normalizedEmail);
    if (!user) {
      const { user: newUser } = await createUser(email, normalizedEmail, true);
      user = newUser;
    }

    // Generate code
    const { code } = await generateVerificationCode(user.id);

    // Send email
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
      subject: "TEST - Your Verification Code - Glass Loans",
      text: `Your TEST verification code is: ${code}`,
      html: `<p>Your TEST verification code is: <strong>${code}</strong></p>`,
    };

    await sgMail.send(msg);

    return NextResponse.json({
      success: true,
      message: "Test email sent",
      email,
      normalizedEmail,
      code,
      userId: user.id,
    });
  } catch (error: any) {
    console.error("Test email error:", error);
    return NextResponse.json(
      {
        error: error.message,
        details: {
          code: error.code,
          statusCode: error.response?.statusCode,
          body: error.response?.body,
        },
      },
      { status: 500 }
    );
  }
}
