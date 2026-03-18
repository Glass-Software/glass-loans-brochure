import sgMail from "@sendgrid/mail";

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts (default: 3)
 * @param delayMs Initial delay in milliseconds (default: 1000)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, operationName = "operation" } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${maxAttempts} for ${operationName}`);
      const result = await fn();
      if (attempt > 1) {
        console.log(`[Retry] ✅ ${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`[Retry] ❌ ${operationName} failed on attempt ${attempt}:`, error.message);

      // If this is the last attempt, don't wait
      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s, etc.
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(`[Retry] Waiting ${waitTime}ms before retry...`);
      await sleep(waitTime);
    }
  }

  // All attempts failed
  console.error(`[Retry] ❌ ${operationName} failed after ${maxAttempts} attempts`);

  // Send alert email if all retries failed
  await sendServiceDownAlert(operationName, lastError);

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send alert email when RentCast service is down
 */
async function sendServiceDownAlert(
  operationName: string,
  error: Error | null
): Promise<void> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error("[Alert] Cannot send alert email - SENDGRID_API_KEY not configured");
      return;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const alertEmail = "hervey711@gmail.com";
    const timestamp = new Date().toISOString();
    const errorMessage = error?.message || "Unknown error";
    const errorStack = error?.stack || "No stack trace available";

    const msg = {
      to: alertEmail,
      from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
      subject: `🚨 RentCast Service Alert - ${operationName} Failed`,
      text: `
RentCast API Service Alert
===========================

Time: ${timestamp}
Operation: ${operationName}
Status: Failed after 3 retry attempts

Error Message:
${errorMessage}

Stack Trace:
${errorStack}

Action Required:
- Check RentCast API status: https://status.rentcast.io/
- Verify API key is valid
- Check rate limits
- Review recent API changes

This is an automated alert from Glass Loans underwriting system.
      `,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #EF4444; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">🚨 RentCast Service Alert</h1>
  </div>

  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #EF4444; margin-top: 0;">Service Down</h2>

    <div style="background-color: #fff; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0;">
      <p><strong>Time:</strong> ${timestamp}</p>
      <p><strong>Operation:</strong> ${operationName}</p>
      <p><strong>Status:</strong> Failed after 3 retry attempts</p>
    </div>

    <h3>Error Details</h3>
    <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 4px; padding: 15px; margin: 20px 0;">
      <p><strong>Message:</strong></p>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${errorMessage}</pre>

      <p><strong>Stack Trace:</strong></p>
      <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 11px;">${errorStack}</pre>
    </div>

    <h3>Action Required</h3>
    <ul style="background-color: #fff; padding: 20px 20px 20px 40px; border-radius: 4px;">
      <li>Check <a href="https://status.rentcast.io/" style="color: #4A6CF7;">RentCast API status</a></li>
      <li>Verify API key is valid</li>
      <li>Check rate limits</li>
      <li>Review recent API changes</li>
    </ul>

    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      This is an automated alert from Glass Loans underwriting system.<br>
      Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206
    </p>
  </div>
</body>
</html>
      `,
    };

    await sgMail.send(msg);
    console.log(`[Alert] ✅ Service down alert sent to ${alertEmail}`);
  } catch (emailError: any) {
    console.error("[Alert] Failed to send service down alert:", emailError.message);
    // Don't throw - we don't want email failures to break the app
  }
}
