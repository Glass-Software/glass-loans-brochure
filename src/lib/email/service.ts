import sgMail from "@sendgrid/mail";
import { Resend } from "resend";

interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

const SENDGRID_FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL ?? "info@glassloans.io";
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Glass Loans <noreply@glassloans.io>";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn("[email] SENDGRID_API_KEY missing — Resend will be used as primary");
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

if (!process.env.SENDGRID_API_KEY && !process.env.RESEND_API_KEY) {
  console.warn(
    "[email] No email provider configured: set SENDGRID_API_KEY or RESEND_API_KEY",
  );
}

/**
 * Returns true if at least one email provider is configured.
 */
export function isEmailServiceConfigured(): boolean {
  return !!process.env.SENDGRID_API_KEY || !!process.env.RESEND_API_KEY;
}

/**
 * Sends an email, falling back from SendGrid to Resend on failure.
 * Throws if both providers fail or neither is configured.
 */
export async function sendWithFallback(message: EmailMessage): Promise<void> {
  const sendGridConfigured =
    !!process.env.SENDGRID_API_KEY && !!process.env.SENDGRID_FROM_EMAIL;

  if (sendGridConfigured) {
    try {
      await sgMail.send({
        to: message.to,
        from: { email: SENDGRID_FROM_EMAIL, name: "Glass Loans" },
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return;
    } catch (sgError) {
      console.error("[email] SendGrid failed, trying Resend fallback:", sgError);
    }
  }

  if (!resend) {
    throw new Error(
      "Email delivery failed: SendGrid failed and RESEND_API_KEY is not configured",
    );
  }

  const { error: resendError } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  if (resendError) {
    throw new Error(
      `Email delivery failed on both providers. Resend error: ${resendError.message}`,
    );
  }
}
