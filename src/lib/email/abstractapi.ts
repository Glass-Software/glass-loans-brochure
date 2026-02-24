/**
 * AbstractAPI Email Reputation (OPTIONAL)
 * https://www.abstractapi.com/api/email-reputation-api
 *
 * ONLY used for enhanced disposable email detection.
 * We do NOT use risk scoring or quality scoring as they are too aggressive
 * and block legitimate users.
 *
 * Falls back to basic validation (10 common disposable domains) if API key not configured.
 * The core anti-abuse mechanism (preventing +1 email tricks) is handled
 * by src/lib/email/normalization.ts and does NOT require this API.
 */

import { isDisposableEmail, isValidEmailFormat } from "./normalization";

interface EmailReputationResponse {
  email_address: string;
  email_deliverability: {
    status: "deliverable" | "undeliverable" | "unknown";
    status_detail: string;
    is_format_valid: boolean;
    is_smtp_valid: boolean;
    is_mx_valid: boolean;
    mx_records: string[];
  };
  email_sender: {
    first_name: string | null;
    last_name: string | null;
    email_provider_name: string;
    organization_name: string;
    organization_type: string;
  };
  email_domain: {
    domain: string;
    domain_age: number;
    is_live_site: boolean;
    registrar: string;
    registrar_url: string;
    date_registered: string;
    date_last_renewed: string;
    date_expires: string;
    is_risky_tld: boolean;
  };
  email_quality: {
    score: number; // 0 to 1
    is_free_email: boolean;
    is_username_suspicious: boolean;
    is_disposable: boolean;
    is_catchall: boolean;
    is_subaddress: boolean;
    is_role: boolean;
    is_dmarc_enforced: boolean;
    is_spf_strict: boolean;
    minimum_age: number;
  };
  email_risk: {
    address_risk_status: "low" | "medium" | "high";
    domain_risk_status: "low" | "medium" | "high";
  };
}

export interface EmailValidationResult {
  isValid: boolean;
  email: string;
  suggestedEmail?: string;
  reason?: string;
  qualityScore?: number;
}

/**
 * Basic email validation without external API
 * Uses utilities from normalization.ts for consistency
 */
function basicEmailValidation(email: string): EmailValidationResult {
  // Check format
  if (!isValidEmailFormat(email)) {
    return {
      isValid: false,
      email,
      reason: "Invalid email format",
    };
  }

  // Check for disposable email domains
  if (isDisposableEmail(email)) {
    return {
      isValid: false,
      email,
      reason: "Disposable email addresses are not allowed",
    };
  }

  return {
    isValid: true,
    email,
  };
}

/**
 * Validate email using AbstractAPI (optional)
 * Falls back to basic validation if API key not configured
 */
export async function validateEmail(
  email: string,
): Promise<EmailValidationResult> {
  const apiKey = process.env.ABSTRACT_API_KEY;

  // If no API key, use basic validation only
  if (!apiKey) {
    console.log("ABSTRACT_API_KEY not set, using basic validation");
    return basicEmailValidation(email);
  }

  try {
    const response = await fetch(
      `https://emailreputation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      console.warn(`AbstractAPI returned ${response.status}, falling back to basic validation`);
      return basicEmailValidation(email);
    }

    const data: EmailReputationResponse = await response.json();

    // ONLY check if email is disposable (no risk/quality scoring)
    // Risk and quality scores are too aggressive and block legitimate users
    if (data.email_quality.is_disposable) {
      return {
        isValid: false,
        email: data.email_address,
        reason: "Disposable email addresses are not allowed",
      };
    }

    // Email is valid
    return {
      isValid: true,
      email: data.email_address,
    };
  } catch (error) {
    console.warn("AbstractAPI validation error, falling back to basic validation:", error);
    return basicEmailValidation(email);
  }
}
