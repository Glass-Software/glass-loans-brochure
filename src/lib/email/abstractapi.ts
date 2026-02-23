/**
 * AbstractAPI Email Reputation
 * https://www.abstractapi.com/api/email-reputation-api
 */

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
 * Validate email using AbstractAPI
 */
export async function validateEmail(
  email: string,
): Promise<EmailValidationResult> {
  const apiKey = process.env.ABSTRACT_API_KEY;

  if (!apiKey) {
    console.warn("ABSTRACT_API_KEY not set, skipping advanced validation");
    // Fall back to basic validation
    return {
      isValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      email,
      reason: "API key not configured",
    };
  }

  try {
    const response = await fetch(
      `https://emailreputation.abstractapi.com/v1/?api_key=${apiKey}&email=${encodeURIComponent(email)}`,
      {
        method: "GET",
      },
    );

    if (!response.ok) {
      throw new Error(`AbstractAPI returned ${response.status}`);
    }

    const data: EmailReputationResponse = await response.json();

    // Check if email is disposable
    if (data.email_quality.is_disposable) {
      return {
        isValid: false,
        email: data.email_address,
        reason: "Disposable email addresses are not allowed",
        qualityScore: data.email_quality.score,
      };
    }

    // Check if email format is valid
    if (!data.email_deliverability.is_format_valid) {
      return {
        isValid: false,
        email: data.email_address,
        reason: "Invalid email format",
        qualityScore: data.email_quality.score,
      };
    }

    // Check deliverability
    if (data.email_deliverability.status === "undeliverable") {
      return {
        isValid: false,
        email: data.email_address,
        reason: "Email address is not deliverable",
        qualityScore: data.email_quality.score,
      };
    }

    // Check quality score (lower than 0.5 is suspicious)
    if (data.email_quality.score < 0.5) {
      return {
        isValid: false,
        email: data.email_address,
        reason: "Email quality score too low",
        qualityScore: data.email_quality.score,
      };
    }

    // Check risk status
    if (data.email_risk.address_risk_status === "high" || data.email_risk.domain_risk_status === "high") {
      return {
        isValid: false,
        email: data.email_address,
        reason: "Email has high risk status",
        qualityScore: data.email_quality.score,
      };
    }

    // Email is valid
    return {
      isValid: true,
      email: data.email_address,
      qualityScore: data.email_quality.score,
    };
  } catch (error) {
    console.error("AbstractAPI validation error:", error);

    // Fall back to basic validation
    return {
      isValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      email,
      reason: "Validation service error, used basic check",
    };
  }
}
