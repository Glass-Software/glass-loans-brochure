/**
 * Normalize email to prevent +1 tricks and other variations
 * Examples:
 * - user+1@gmail.com -> user@gmail.com
 * - User@Gmail.com -> user@gmail.com
 * - user+anything@example.com -> user@example.com
 */
export function normalizeEmail(email: string): string {
  // Convert to lowercase
  let normalized = email.toLowerCase().trim();

  // Split into local and domain parts
  const [local, domain] = normalized.split("@");

  if (!local || !domain) {
    throw new Error("Invalid email format");
  }

  // Remove everything after + in the local part
  const localWithoutPlus = local.split("+")[0];

  // For Gmail specifically, also remove dots (they're ignored by Gmail)
  let finalLocal = localWithoutPlus;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    finalLocal = localWithoutPlus.replace(/\./g, "");
  }

  // Reconstruct the email
  return `${finalLocal}@${domain}`;
}

/**
 * Validate email format using regex
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if email is from a known disposable email provider
 */
export function isDisposableEmail(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1];

  // List of common disposable email domains
  const disposableDomains = [
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "mailinator.com",
    "throwaway.email",
    "temp-mail.org",
    "fakeinbox.com",
    "trashmail.com",
    "yopmail.com",
    "getnada.com",
  ];

  return disposableDomains.includes(domain);
}
