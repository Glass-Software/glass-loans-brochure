/**
 * Database queries using Prisma (PostgreSQL)
 * Replaces queries.ts (SQLite)
 */

import { prisma } from "./prisma";
import crypto from "crypto";
import type { User as PrismaUser, UnderwritingSubmission as PrismaSubmission } from "@prisma/client";

// ============================================================================
// User Queries
// ============================================================================

export interface User {
  id: number;
  email: string;
  normalized_email: string;
  email_verified: number; // Keep as number for backward compatibility
  verification_token: string | null;
  verification_token_expires: string | null;
  verification_code: string | null;
  code_expires_at: string | null;
  usage_count: number;
  usage_limit: number;
  report_retention_days: number;
  created_at: string;
  updated_at: string;
}

// Convert Prisma User to legacy format
function toPrismaUserToLegacy(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    normalized_email: user.normalizedEmail,
    email_verified: user.emailVerified ? 1 : 0,
    verification_token: user.verificationToken,
    verification_token_expires: user.verificationTokenExpires?.toISOString() || null,
    verification_code: user.verificationCode,
    code_expires_at: user.codeExpiresAt?.toISOString() || null,
    usage_count: user.usageCount,
    usage_limit: user.usageLimit,
    report_retention_days: user.reportRetentionDays,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

/**
 * Find user by email
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  return user ? toPrismaUserToLegacy(user) : null;
}

/**
 * Find user by normalized email
 */
export async function findUserByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { normalizedEmail } });
  return user ? toPrismaUserToLegacy(user) : null;
}

/**
 * Find verified user by normalized email
 */
export async function findVerifiedUserByEmail(normalizedEmail: string): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: {
      normalizedEmail,
      emailVerified: true,
    },
  });
  return user ? toPrismaUserToLegacy(user) : null;
}

/**
 * Find user by verification token
 */
export async function findUserByVerificationToken(token: string): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: {
      verificationToken: token,
      verificationTokenExpires: {
        gt: new Date(),
      },
    },
  });
  return user ? toPrismaUserToLegacy(user) : null;
}

/**
 * Create a new user with verification token
 */
export async function createUser(
  email: string,
  normalizedEmail: string,
  marketingConsent: boolean = false
): Promise<{ user: User; token: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email,
      normalizedEmail,
      verificationToken: token,
      verificationTokenExpires: tokenExpires,
      marketingConsent,
    },
  });

  return { user: toPrismaUserToLegacy(user), token };
}

/**
 * Update marketing consent for a user
 */
export async function updateMarketingConsent(userId: number, marketingConsent: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { marketingConsent },
  });
}

/**
 * Verify user email
 */
export async function verifyUserEmail(token: string): Promise<User | null> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: { gt: new Date() },
      },
    });

    if (!user) return null;

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
      },
    });

    return toPrismaUserToLegacy(updated);
  });
}

/**
 * Increment user usage count
 */
export async function incrementUsageCount(userId: number): Promise<User> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { usageCount: { increment: 1 } },
  });
  return toPrismaUserToLegacy(user);
}

/**
 * Regenerate verification token
 */
export async function regenerateVerificationToken(userId: number): Promise<{ user: User; token: string }> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      verificationToken: token,
      verificationTokenExpires: tokenExpires,
    },
  });

  return { user: toPrismaUserToLegacy(user), token };
}

/**
 * Generate and store 6-digit verification code
 */
export async function generateVerificationCode(userId: number): Promise<{ user: User; code: string }> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const codeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      verificationCode: code,
      codeExpiresAt: codeExpires,
    },
  });

  return { user: toPrismaUserToLegacy(user), code };
}

/**
 * Verify code and mark user as verified
 */
export async function verifyUserCode(code: string, normalizedEmail: string): Promise<User | null> {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        normalizedEmail,
        verificationCode: code,
        codeExpiresAt: { gt: new Date() },
      },
    });

    if (!user) return null;

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        codeExpiresAt: null,
      },
    });

    return toPrismaUserToLegacy(updated);
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
  comp_links: string | null;
  estimated_arv: number | null;
  as_is_value: number | null;
  monthly_rent: number | null;
  final_score: number | null;
  gary_opinion: string | null;
  ai_property_comps: string | null;
  comp_selection_state: string | null;
  report_id: string | null;
  expires_at: string | null;
  ip_address: string | null;
  recaptcha_score: number | null;
  created_at: string;
}

// Convert Prisma Submission to legacy format
function toSubmissionLegacy(sub: PrismaSubmission): UnderwritingSubmission {
  return {
    id: sub.id,
    user_id: sub.userId,
    property_address: sub.propertyAddress,
    property_city: sub.propertyCity,
    property_state: sub.propertyState,
    property_zip: sub.propertyZip,
    property_county: sub.propertyCounty,
    property_latitude: sub.propertyLatitude,
    property_longitude: sub.propertyLongitude,
    purchase_price: sub.purchasePrice,
    rehab: sub.rehab,
    square_feet: sub.squareFeet,
    bedrooms: sub.bedrooms,
    bathrooms: sub.bathrooms,
    year_built: sub.yearBuilt,
    property_type: sub.propertyType,
    property_condition: sub.propertyCondition,
    renovation_per_sf: sub.renovationPerSf,
    user_estimated_as_is_value: sub.userEstimatedAsIsValue,
    user_estimated_arv: sub.userEstimatedArv,
    interest_rate: sub.interestRate,
    months: sub.months,
    loan_at_purchase: sub.loanAtPurchase,
    renovation_funds: sub.renovationFunds,
    closing_costs_percent: sub.closingCostsPercent,
    points: sub.points,
    market_type: sub.marketType,
    additional_details: sub.additionalDetails,
    comp_links: sub.compLinks,
    estimated_arv: sub.estimatedArv,
    as_is_value: sub.asIsValue,
    monthly_rent: sub.monthlyRent,
    final_score: sub.finalScore,
    gary_opinion: sub.garyOpinion,
    ai_property_comps: sub.aiPropertyComps,
    comp_selection_state: sub.compSelectionState,
    report_id: sub.reportId,
    expires_at: sub.expiresAt?.toISOString() || null,
    ip_address: sub.ipAddress,
    recaptcha_score: sub.recaptchaScore,
    created_at: sub.createdAt.toISOString(),
  };
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
  userEstimatedAsIsValue: number;
  userEstimatedArv: number;
  interestRate: number;
  months: number;
  loanAtPurchase: number;
  renovationFunds: number;
  closingCostsPercent: number;
  points: number;
  marketType: string;
  additionalDetails?: string;
  estimatedArv: number;
  asIsValue: number;
  finalScore: number;
  garyOpinion: string;
  propertyComps?: any;
  compSelectionState?: string;
  reportId: string;
  expiresAt: string;
  ipAddress?: string;
  recaptchaScore?: number;
}

/**
 * Create a new underwriting submission
 */
export async function createSubmission(data: CreateSubmissionData): Promise<UnderwritingSubmission> {
  const submission = await prisma.underwritingSubmission.create({
    data: {
      userId: data.userId,
      propertyAddress: data.propertyAddress,
      propertyCity: data.propertyCity,
      propertyState: data.propertyState,
      propertyZip: data.propertyZip,
      propertyCounty: data.propertyCounty,
      propertyLatitude: data.propertyLatitude,
      propertyLongitude: data.propertyLongitude,
      purchasePrice: data.purchasePrice,
      rehab: data.rehab,
      squareFeet: data.squareFeet,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      yearBuilt: data.yearBuilt,
      propertyType: data.propertyType,
      propertyCondition: data.propertyCondition,
      renovationPerSf: data.renovationPerSf,
      userEstimatedAsIsValue: data.userEstimatedAsIsValue,
      userEstimatedArv: data.userEstimatedArv,
      interestRate: data.interestRate,
      months: data.months,
      loanAtPurchase: data.loanAtPurchase,
      renovationFunds: data.renovationFunds,
      closingCostsPercent: data.closingCostsPercent,
      points: data.points,
      marketType: data.marketType,
      additionalDetails: data.additionalDetails,
      estimatedArv: data.estimatedArv,
      asIsValue: data.asIsValue,
      finalScore: data.finalScore,
      garyOpinion: data.garyOpinion,
      aiPropertyComps: data.propertyComps ? JSON.stringify(data.propertyComps) : null,
      compSelectionState: data.compSelectionState,
      reportId: data.reportId,
      expiresAt: new Date(data.expiresAt),
      ipAddress: data.ipAddress,
      recaptchaScore: data.recaptchaScore,
    },
  });

  return toSubmissionLegacy(submission);
}

/**
 * Get submissions for a user
 */
export async function getUserSubmissions(userId: number, limit = 10): Promise<UnderwritingSubmission[]> {
  const submissions = await prisma.underwritingSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return submissions.map(toSubmissionLegacy);
}

/**
 * Get latest submission for a user
 */
export async function getLatestSubmission(userId: number): Promise<UnderwritingSubmission | null> {
  const submission = await prisma.underwritingSubmission.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return submission ? toSubmissionLegacy(submission) : null;
}

/**
 * Get submission by ID
 */
export async function getSubmissionById(submissionId: number): Promise<UnderwritingSubmission | null> {
  const submission = await prisma.underwritingSubmission.findUnique({
    where: { id: submissionId },
  });
  return submission ? toSubmissionLegacy(submission) : null;
}

/**
 * Get submission by report ID (if not expired)
 */
export async function getSubmissionByReportId(reportId: string): Promise<UnderwritingSubmission | null> {
  const submission = await prisma.underwritingSubmission.findFirst({
    where: {
      reportId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return submission ? toSubmissionLegacy(submission) : null;
}

/**
 * Generate a unique report ID for a submission
 */
export function generateReportId(): string {
  return crypto.randomBytes(9).toString("base64url");
}

/**
 * Clean up expired reports (run periodically)
 */
export async function cleanupExpiredReports(): Promise<void> {
  await prisma.underwritingSubmission.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
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
export async function checkRateLimit(
  ipAddress: string,
  endpoint: string,
  maxRequests: number,
  windowMinutes: number
): Promise<{ allowed: boolean; remaining: number }> {
  return await prisma.$transaction(async (tx) => {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Clean up old rate limit records
    await tx.rateLimit.deleteMany({
      where: { windowStart: { lt: windowStart } },
    });

    // Check existing rate limit
    const existing = await tx.rateLimit.findFirst({
      where: {
        ipAddress,
        endpoint,
        windowStart: { gt: windowStart },
      },
    });

    if (existing) {
      if (existing.requestCount >= maxRequests) {
        return { allowed: false, remaining: 0 };
      }

      await tx.rateLimit.update({
        where: { id: existing.id },
        data: { requestCount: { increment: 1 } },
      });

      return {
        allowed: true,
        remaining: maxRequests - (existing.requestCount + 1),
      };
    } else {
      await tx.rateLimit.create({
        data: {
          ipAddress,
          endpoint,
          requestCount: 1,
        },
      });

      return { allowed: true, remaining: maxRequests - 1 };
    }
  });
}
