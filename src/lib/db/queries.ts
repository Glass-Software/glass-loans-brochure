import { query, queryOne, execute, transaction, getDatabase } from "./sqlite";
import crypto from "crypto";

// ============================================================================
// User Queries
// ============================================================================

export interface User {
  id: number;
  email: string;
  normalized_email: string;
  email_verified: number; // SQLite uses 0/1 for boolean
  verification_token: string | null;
  verification_token_expires: string | null; // SQLite stores dates as text
  verification_code: string | null; // 6-digit code for email verification
  code_expires_at: string | null; // When the code expires
  usage_count: number;
  usage_limit: number; // Configurable limit per user (default 3 for free tier)
  report_retention_days: number; // How long to keep reports (default 14 days)
  created_at: string;
  updated_at: string;
}

/**
 * Find user by email
 */
export function findUserByEmail(email: string): User | null {
  return queryOne<User>("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
}

/**
 * Find user by normalized email
 */
export function findUserByNormalizedEmail(
  normalizedEmail: string,
): User | null {
  return queryOne<User>(
    "SELECT * FROM users WHERE normalized_email = ? LIMIT 1",
    [normalizedEmail],
  );
}

/**
 * Find verified user by normalized email
 */
export function findVerifiedUserByEmail(normalizedEmail: string): User | null {
  return queryOne<User>(
    "SELECT * FROM users WHERE normalized_email = ? AND email_verified = 1 LIMIT 1",
    [normalizedEmail],
  );
}

/**
 * Find user by verification token
 */
export function findUserByVerificationToken(token: string): User | null {
  return queryOne<User>(
    `
      SELECT * FROM users
      WHERE verification_token = ?
        AND verification_token_expires > DATETIME('now')
      LIMIT 1
    `,
    [token],
  );
}

/**
 * Create a new user with verification token
 */
export function createUser(
  email: string,
  normalizedEmail: string,
  marketingConsent: boolean = false,
): { user: User; token: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result = execute(
    `
      INSERT INTO users (email, normalized_email, verification_token, verification_token_expires, marketing_consent)
      VALUES (?, ?, ?, ?, ?)
    `,
    [email, normalizedEmail, token, tokenExpires, marketingConsent ? 1 : 0],
  );

  const user = queryOne<User>("SELECT * FROM users WHERE id = ?", [
    result.lastInsertRowid,
  ])!;

  return { user, token };
}

/**
 * Update marketing consent for a user
 */
export function updateMarketingConsent(
  userId: number,
  marketingConsent: boolean,
): void {
  execute(
    `
      UPDATE users
      SET marketing_consent = ?,
          updated_at = DATETIME('now')
      WHERE id = ?
    `,
    [marketingConsent ? 1 : 0, userId],
  );
}

/**
 * Verify user email
 */
export function verifyUserEmail(token: string): User | null {
  return transaction((db) => {
    // Check if token is valid
    const user = queryOne<User>(
      `
        SELECT * FROM users
        WHERE verification_token = ?
          AND verification_token_expires > DATETIME('now')
        LIMIT 1
      `,
      [token],
    );

    if (!user) {
      return null;
    }

    // Update user
    execute(
      `
        UPDATE users
        SET email_verified = 1,
            verification_token = NULL,
            verification_token_expires = NULL,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
      [user.id],
    );

    // Return updated user
    return queryOne<User>("SELECT * FROM users WHERE id = ?", [user.id]);
  });
}

/**
 * Increment user usage count
 */
export function incrementUsageCount(userId: number): User {
  execute(
    `
      UPDATE users
      SET usage_count = usage_count + 1,
          updated_at = DATETIME('now')
      WHERE id = ?
    `,
    [userId],
  );

  return queryOne<User>("SELECT * FROM users WHERE id = ?", [userId])!;
}

/**
 * Regenerate verification token
 */
export function regenerateVerificationToken(
  userId: number,
): { user: User; token: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  execute(
    `
      UPDATE users
      SET verification_token = ?,
          verification_token_expires = ?,
          updated_at = DATETIME('now')
      WHERE id = ?
    `,
    [token, tokenExpires, userId],
  );

  const user = queryOne<User>("SELECT * FROM users WHERE id = ?", [userId])!;

  return { user, token };
}

/**
 * Generate and store 6-digit verification code
 */
export function generateVerificationCode(
  userId: number,
): { user: User; code: string } {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  try {
    execute(
      `
        UPDATE users
        SET verification_code = ?,
            code_expires_at = ?,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
      [code, codeExpires, userId],
    );
  } catch (error: any) {
    // If column doesn't exist, provide helpful error message
    if (error.message?.includes("no such column: verification_code")) {
      throw new Error("Database migration 009 not applied. Run: npx tsx scripts/migrate.ts");
    }
    throw error;
  }

  const user = queryOne<User>("SELECT * FROM users WHERE id = ?", [userId])!;

  return { user, code };
}

/**
 * Verify code and mark user as verified
 */
export function verifyUserCode(code: string, normalizedEmail: string): User | null {
  return transaction((db) => {
    // Check if code is valid
    const user = queryOne<User>(
      `
        SELECT * FROM users
        WHERE normalized_email = ?
          AND verification_code = ?
          AND code_expires_at > DATETIME('now')
        LIMIT 1
      `,
      [normalizedEmail, code],
    );

    if (!user) {
      return null;
    }

    // Update user - mark as verified and clear code
    execute(
      `
        UPDATE users
        SET email_verified = 1,
            verification_code = NULL,
            code_expires_at = NULL,
            updated_at = DATETIME('now')
        WHERE id = ?
      `,
      [user.id],
    );

    // Return updated user
    return queryOne<User>("SELECT * FROM users WHERE id = ?", [user.id]);
  });
}

// ============================================================================
// Underwriting Submission Queries
// ============================================================================

export interface UnderwritingSubmission {
  id: number;
  user_id: number;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  property_county: string | null;
  property_latitude: number | null;
  property_longitude: number | null;
  purchase_price: number;
  rehab: number;
  square_feet: number;
  bedrooms: number | null;
  bathrooms: number | null;
  year_built: number | null;
  property_type: string | null;
  property_condition: string;
  renovation_per_sf: string;
  user_estimated_as_is_value: number | null;
  user_estimated_arv: number | null;
  interest_rate: number;
  months: number;
  loan_at_purchase: number;
  renovation_funds: number;
  closing_costs_percent: number;
  points: number;
  market_type: string;
  additional_details: string | null;
  comp_links: string | null; // JSON stored as text
  estimated_arv: number | null;
  as_is_value: number | null;
  monthly_rent: number | null;
  final_score: number | null;
  gary_opinion: string | null;
  ai_property_comps: string | null; // JSON stored as text
  comp_selection_state: string | null; // JSON string of CompSelectionState[]
  report_id: string | null; // Unique ID for shareable report links
  expires_at: string | null; // When the report expires and should be deleted
  ip_address: string | null;
  recaptcha_score: number | null;
  created_at: string;
}

export interface CreateSubmissionData {
  userId: number;
  propertyAddress: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyCounty?: string;
  propertyLatitude?: number;
  propertyLongitude?: number;
  purchasePrice: number;
  rehab: number;
  squareFeet: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  propertyType: string;
  propertyCondition: string;
  renovationPerSf: string;
  userEstimatedAsIsValue: number; // User's as-is value estimate
  userEstimatedArv: number; // User's ARV estimate
  interestRate: number;
  months: number;
  loanAtPurchase: number;
  renovationFunds: number;
  closingCostsPercent: number;
  points: number;
  marketType: string;
  additionalDetails?: string;
  estimatedArv: number; // Gary's ARV estimate
  asIsValue: number;
  finalScore: number;
  garyOpinion: string;
  propertyComps?: any;
  compSelectionState?: string; // JSON string of CompSelectionState[]
  reportId: string; // Unique ID for shareable report links
  expiresAt: string; // When the report expires (ISO string)
  ipAddress?: string;
  recaptchaScore?: number;
}

/**
 * Create a new underwriting submission
 */
export function createSubmission(
  data: CreateSubmissionData,
): UnderwritingSubmission {
  const result = execute(
    `
      INSERT INTO underwriting_submissions (
        user_id, property_address, property_city, property_state, property_zip, property_county,
        property_latitude, property_longitude,
        purchase_price, rehab, square_feet, bedrooms, bathrooms, year_built, property_type,
        property_condition, renovation_per_sf, user_estimated_as_is_value, user_estimated_arv, interest_rate, months,
        loan_at_purchase, renovation_funds, closing_costs_percent, points,
        market_type, additional_details, estimated_arv, as_is_value,
        final_score, gary_opinion, ai_property_comps,
        comp_selection_state,
        report_id, expires_at,
        ip_address, recaptcha_score
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    [
      data.userId,
      data.propertyAddress,
      data.propertyCity || null,
      data.propertyState || null,
      data.propertyZip || null,
      data.propertyCounty || null,
      data.propertyLatitude ?? null,
      data.propertyLongitude ?? null,
      data.purchasePrice,
      data.rehab,
      data.squareFeet,
      data.bedrooms,
      data.bathrooms,
      data.yearBuilt,
      data.propertyType,
      data.propertyCondition,
      data.renovationPerSf,
      data.userEstimatedAsIsValue,
      data.userEstimatedArv,
      data.interestRate,
      data.months,
      data.loanAtPurchase,
      data.renovationFunds,
      data.closingCostsPercent,
      data.points,
      data.marketType,
      data.additionalDetails || null,
      data.estimatedArv,
      data.asIsValue,
      data.finalScore,
      data.garyOpinion,
      data.propertyComps ? JSON.stringify(data.propertyComps) : null,
      data.compSelectionState || null,
      data.reportId,
      data.expiresAt,
      data.ipAddress || null,
      data.recaptchaScore || null,
    ],
  );

  return queryOne<UnderwritingSubmission>(
    "SELECT * FROM underwriting_submissions WHERE id = ?",
    [result.lastInsertRowid],
  )!;
}

/**
 * Get submissions for a user
 */
export function getUserSubmissions(
  userId: number,
  limit = 10,
): UnderwritingSubmission[] {
  return query<UnderwritingSubmission>(
    `
      SELECT * FROM underwriting_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [userId, limit],
  );
}

/**
 * Get latest submission for a user
 */
export function getLatestSubmission(
  userId: number,
): UnderwritingSubmission | null {
  return queryOne<UnderwritingSubmission>(
    `
      SELECT * FROM underwriting_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId],
  );
}

/**
 * Get submission by ID
 */
export function getSubmissionById(
  submissionId: number,
): UnderwritingSubmission | null {
  return queryOne<UnderwritingSubmission>(
    "SELECT * FROM underwriting_submissions WHERE id = ?",
    [submissionId],
  );
}

/**
 * Get submission by report ID (if not expired)
 */
export function getSubmissionByReportId(
  reportId: string,
): UnderwritingSubmission | null {
  return queryOne<UnderwritingSubmission>(
    `
      SELECT * FROM underwriting_submissions
      WHERE report_id = ?
        AND (expires_at IS NULL OR expires_at > DATETIME('now'))
      LIMIT 1
    `,
    [reportId],
  );
}

/**
 * Generate a unique report ID for a submission
 */
export function generateReportId(): string {
  // Generate a URL-safe random ID (12 chars = 72 bits of entropy)
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Clean up expired reports (run periodically)
 */
export function cleanupExpiredReports(): void {
  execute(
    "DELETE FROM underwriting_submissions WHERE expires_at < DATETIME('now')",
    [],
  );
}

// ============================================================================
// Rate Limiting Queries
// ============================================================================

export interface RateLimit {
  id: number;
  ip_address: string;
  endpoint: string;
  request_count: number;
  window_start: string;
  created_at: string;
}

/**
 * Check and increment rate limit
 */
export function checkRateLimit(
  ipAddress: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number,
): { allowed: boolean; remaining: number } {
  return transaction((db) => {
    // Clean up old rate limit records
    const windowStart = new Date(
      Date.now() - windowMinutes * 60 * 1000,
    ).toISOString();

    execute(
      "DELETE FROM rate_limits WHERE window_start < ?",
      [windowStart],
    );

    // Check existing rate limit
    const existing = queryOne<RateLimit>(
      `
        SELECT * FROM rate_limits
        WHERE ip_address = ? AND endpoint = ?
          AND window_start > ?
        LIMIT 1
      `,
      [ipAddress, endpoint, windowStart],
    );

    if (existing) {
      if (existing.request_count >= maxRequests) {
        // Rate limit exceeded
        return {
          allowed: false,
          remaining: 0,
        };
      }

      // Increment count
      execute(
        "UPDATE rate_limits SET request_count = request_count + 1 WHERE id = ?",
        [existing.id],
      );

      return {
        allowed: true,
        remaining: maxRequests - (existing.request_count + 1),
      };
    } else {
      // Create new rate limit record
      execute(
        "INSERT INTO rate_limits (ip_address, endpoint, request_count, window_start) VALUES (?, ?, 1, DATETIME('now'))",
        [ipAddress, endpoint],
      );

      return {
        allowed: true,
        remaining: maxRequests - 1,
      };
    }
  });
}
