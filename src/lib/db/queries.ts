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
  normalizedEmail: string;
  emailVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpires: string | null;
  verificationCode: string | null;
  codeExpiresAt: string | null;
  usageCount: number;
  usageLimit: number;
  reportRetentionDays: number;
  tier: string; // "free" | "pro"
  usagePeriodStart: string | null;
  stripeCustomerId: string | null;
  promoExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Convert Prisma User to consistent camelCase format
function toPrismaUserToLegacy(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    emailVerified: user.emailVerified,
    verificationToken: user.verificationToken,
    verificationTokenExpires: user.verificationTokenExpires?.toISOString() || null,
    verificationCode: user.verificationCode,
    codeExpiresAt: user.codeExpiresAt?.toISOString() || null,
    usageCount: user.usageCount,
    usageLimit: user.usageLimit,
    reportRetentionDays: user.reportRetentionDays,
    tier: user.tier,
    usagePeriodStart: user.usagePeriodStart?.toISOString() || null,
    stripeCustomerId: user.stripeCustomerId,
    promoExpiresAt: user.promoExpiresAt?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
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
  console.log("🔵 [queries] findUserByNormalizedEmail called for:", normalizedEmail);
  console.log("🔵 [queries] prisma client exists:", !!prisma);

  try {
    console.log("🔵 [queries] Executing prisma.user.findUnique...");
    const user = await prisma.user.findUnique({ where: { normalizedEmail } });
    console.log("🔵 [queries] Query completed, user found:", !!user);
    return user ? toPrismaUserToLegacy(user) : null;
  } catch (error: any) {
    console.error("❌ [queries] Error in findUserByNormalizedEmail:", error.message);
    console.error("❌ [queries] Error stack:", error.stack);
    throw error;
  }
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
 * For Pro users: Resets monthly if 30 days have passed since usagePeriodStart
 */
export async function incrementUsageCount(userId: number): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) throw new Error("User not found");

  // For Pro users: check if we need to reset monthly usage
  if (user.tier === "pro" && user.usagePeriodStart) {
    const now = new Date();
    const periodStart = new Date(user.usagePeriodStart);

    // If more than 30 days have passed, reset usage
    const daysSinceReset = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceReset >= 30) {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          usageCount: 1, // Reset to 1 (this submission)
          usagePeriodStart: now,
        },
      });
      return toPrismaUserToLegacy(updatedUser);
    }
  }

  // Normal increment (for free users or Pro users within their period)
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { usageCount: { increment: 1 } },
  });

  return toPrismaUserToLegacy(updated);
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
// Promo Tracking Queries
// ============================================================================

/**
 * Set promotional offer expiry for user (1 hour from now)
 */
export async function setPromoExpiry(userId: number): Promise<User> {
  const promoExpiresAt = new Date(Date.now() + 3600000); // 1 hour from now

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { promoExpiresAt },
  });

  return toPrismaUserToLegacy(updatedUser);
}

/**
 * Clear promotional expiry (after user upgrades or timer expires)
 */
export async function clearPromoExpiry(userId: number): Promise<User> {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { promoExpiresAt: null },
  });

  return toPrismaUserToLegacy(updatedUser);
}

/**
 * Check if user has active promo offer
 */
export async function hasActivePromo(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { promoExpiresAt: true },
  });

  if (!user?.promoExpiresAt) return false;
  return user.promoExpiresAt > new Date();
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
  property_comps: string | null;
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
    property_comps: sub.propertyComps,
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
  userEstimatedAsIsValue?: number; // DEPRECATED: Optional for backward compatibility
  userEstimatedArv?: number; // DEPRECATED: Optional for backward compatibility
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
      propertyComps: data.propertyComps ? JSON.stringify(data.propertyComps) : null,
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

// ============================================================================
// Subscription Queries
// ============================================================================

export interface Subscription {
  id: number;
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  tier: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new subscription
 */
export async function createSubscription(data: {
  userId: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  tier: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}): Promise<Subscription> {
  const subscription = await prisma.subscription.create({
    data: {
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId,
      stripeSubscriptionId: data.stripeSubscriptionId,
      stripePriceId: data.stripePriceId,
      tier: data.tier,
      status: data.status,
      currentPeriodStart: data.currentPeriodStart,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    },
  });

  return {
    id: subscription.id,
    userId: subscription.userId,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

/**
 * Update a subscription
 */
export async function updateSubscription(
  id: number,
  data: {
    status?: string;
    stripePriceId?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<Subscription> {
  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.stripePriceId && { stripePriceId: data.stripePriceId }),
      ...(data.currentPeriodStart && { currentPeriodStart: data.currentPeriodStart }),
      ...(data.currentPeriodEnd && { currentPeriodEnd: data.currentPeriodEnd }),
      ...(data.cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd: data.cancelAtPeriodEnd }),
    },
  });

  return {
    id: subscription.id,
    userId: subscription.userId,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

/**
 * Get subscription by user ID
 */
export async function getSubscriptionByUserId(userId: number): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription) return null;

  return {
    id: subscription.id,
    userId: subscription.userId,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

/**
 * Get subscription by Stripe subscription ID
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
  });

  if (!subscription) return null;

  return {
    id: subscription.id,
    userId: subscription.userId,
    stripeCustomerId: subscription.stripeCustomerId,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripePriceId: subscription.stripePriceId,
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.updatedAt.toISOString(),
  };
}

/**
 * Upgrade user to Pro tier
 * CRITICAL: Preserves all existing reports by keeping same user_id
 */
export async function upgradeUserToPro(userId: number, stripeCustomerId: string): Promise<User> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      tier: "pro",
      usageLimit: 100,
      reportRetentionDays: 999999, // Effectively unlimited
      stripeCustomerId,
      usagePeriodStart: new Date(), // Start tracking monthly period
    },
  });

  return toPrismaUserToLegacy(user);
}

/**
 * Downgrade user to free tier
 */
export async function downgradeUserToFree(userId: number): Promise<User> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      tier: "free",
      usageLimit: 5,
      reportRetentionDays: 14,
      usagePeriodStart: null,
    },
  });

  return toPrismaUserToLegacy(user);
}

// ============================================================================
// Session Queries
// ============================================================================

export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Create a new session
 */
export async function createSession(
  userId: number,
  ipAddress?: string,
  userAgent?: string
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  return { sessionToken, expiresAt };
}

/**
 * Get session by token
 */
export async function getSessionByToken(sessionToken: string): Promise<Session | null> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
  });

  if (!session) return null;

  return {
    id: session.id,
    user_id: session.userId,
    session_token: session.sessionToken,
    expires_at: session.expiresAt.toISOString(),
    created_at: session.createdAt.toISOString(),
    ip_address: session.ipAddress,
    user_agent: session.userAgent,
  };
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(sessionToken: string): Promise<void> {
  await prisma.session.delete({
    where: { sessionToken },
  });
}

/**
 * Delete expired sessions
 */
export async function deleteExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Get user with subscription (for dashboard/session validation)
 */
export async function getUserWithSubscription(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
    },
  });

  if (!user) return null;

  return {
    ...toPrismaUserToLegacy(user),
    tier: user.tier,
    usagePeriodStart: user.usagePeriodStart?.toISOString() || null,
    stripeCustomerId: user.stripeCustomerId,
    subscription: user.subscription ? {
      id: user.subscription.id,
      stripeSubscriptionId: user.subscription.stripeSubscriptionId,
      status: user.subscription.status,
      currentPeriodStart: user.subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: user.subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
    } : null,
  };
}
