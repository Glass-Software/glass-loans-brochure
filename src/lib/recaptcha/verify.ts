/**
 * Verify reCAPTCHA v3 token with Google
 */
export async function verifyRecaptchaToken(
  token: string,
  minimumScore: number = 0.5,
): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.warn("RECAPTCHA_SECRET_KEY not configured, skipping verification");
    return { success: true, score: 1.0 }; // Allow through in development
  }

  if (!token || token === "placeholder") {
    return {
      success: false,
      error: "reCAPTCHA token is required",
    };
  }

  try {
    // Add 10-second timeout for reCAPTCHA verification
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `secret=${secretKey}&response=${token}`,
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: "reCAPTCHA verification failed",
      };
    }

    // Check score (v3 returns a score from 0.0 to 1.0)
    const score = data.score || 0;

    if (score < minimumScore) {
      return {
        success: false,
        score,
        error: `reCAPTCHA score too low: ${score}`,
      };
    }

    return {
      success: true,
      score,
    };
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return {
      success: false,
      error: "Failed to verify reCAPTCHA",
    };
  }
}
