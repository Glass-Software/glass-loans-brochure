#!/usr/bin/env tsx
/**
 * Regenerate Gary's opinion for a failed report and re-send the email.
 *
 * Usage:
 *   npx tsx scripts/regenerate-report.ts <report_id>
 *   npx tsx scripts/regenerate-report.ts <report_id> --no-email
 *   npx tsx scripts/regenerate-report.ts <report_id> --preview-email you@example.com
 *   npx tsx scripts/regenerate-report.ts <report_id> --send-only
 *   npx tsx scripts/regenerate-report.ts <report_id> --send-only --preview-email you@example.com
 *
 * Flags:
 *   --no-email                  Skip sending any email
 *   --preview-email <address>   Send to this address instead of the user (for review before sending)
 *   --send-only                 Skip LLM re-generation; just re-send email using existing DB opinion
 *
 * Typical workflow:
 *   1. npx tsx scripts/regenerate-report.ts <id> --preview-email you@example.com
 *      → Regenerates opinion, saves to DB, emails you to review
 *   2. npx tsx scripts/regenerate-report.ts <id> --send-only
 *      → Skips LLM, sends existing opinion to the actual user
 */

import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { getSubmissionByReportId } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { openRouterClient } from "@/lib/ai/openrouter";
import { generateGaryOpinionPrompt, GARY_OPINION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { calculateUnderwriting } from "@/lib/underwriting/calculations";

async function sendReportEmail(
  userEmail: string,
  reportId: string,
  retentionDays: number,
  previewEmail: string | null,
) {
  if (!process.env.SENDGRID_API_KEY) {
    console.error("❌ SENDGRID_API_KEY not set — skipping email");
    return;
  }

  const sgMail = (await import("@sendgrid/mail")).default;
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const sendTo = previewEmail || userEmail;
  const reportUrl = `${process.env.BASE_URL || "https://glassloans.io"}/underwrite/results/${reportId}`;

  if (previewEmail) {
    console.log(`\n👀 Preview mode — sending to ${previewEmail} instead of ${userEmail}`);
  }

  await sgMail.send({
    to: sendTo,
    from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
    subject: previewEmail
      ? `[PREVIEW] Underwriting Report for ${userEmail} — Glass Loans`
      : "Your Underwriting Report Link - Glass Loans",
    text: `Your underwriting report is ready!\n\nView your report: ${reportUrl}\n\nThis link will be valid for ${retentionDays} days.\n\nBest,\nGlass Loans Team`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4A6CF7; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Glass Loans</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
    <h2 style="color: #333; margin-top: 0;">Your Report is Ready!</h2>
    <p>Your underwriting analysis has been completed.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${reportUrl}" style="background-color: #4A6CF7; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Report</a>
    </div>
    <p style="font-size: 14px; color: #666;">This link will be valid for ${retentionDays} days.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">Glass Loans | 1108 McKennie Ave. Suite 011 Nashville, TN 37206</p>
  </div>
</body>
</html>`,
  });

  console.log(`\n📧 Email sent to: ${sendTo}`);
}

async function main() {
  const reportId = process.argv[2];
  const noEmail = process.argv.includes("--no-email");
  const sendOnly = process.argv.includes("--send-only");
  const previewEmailIdx = process.argv.indexOf("--preview-email");
  const previewEmail = previewEmailIdx !== -1 ? process.argv[previewEmailIdx + 1] : null;

  if (!reportId) {
    console.error(
      "❌ Usage: npx tsx scripts/regenerate-report.ts <report_id> [--no-email] [--send-only] [--preview-email <address>]",
    );
    process.exit(1);
  }

  console.log(`\n🔍 Fetching submission for report_id: ${reportId}\n`);

  const submission = await getSubmissionByReportId(reportId);
  if (!submission) {
    console.error("❌ No submission found (check report_id or it may be expired)");
    process.exit(1);
  }

  console.log(`✅ Found submission #${submission.id} — ${submission.property_address}`);
  console.log(
    `   Current gary_opinion: ${submission.gary_opinion ? submission.gary_opinion.slice(0, 80) + "..." : "(empty)"}`,
  );

  if (sendOnly) {
    // Skip LLM — just re-send whatever is already in the DB
    console.log("\n⏭️  --send-only: skipping LLM regeneration");
  } else {
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("❌ OPENROUTER_API_KEY not set");
      process.exit(1);
    }

    // Reconstruct formData shape needed by prompts/calculations
    const formData = {
      propertyAddress: submission.property_address,
      propertyCity: submission.property_city,
      propertyState: submission.property_state,
      propertyZip: submission.property_zip,
      propertyCounty: submission.property_county,
      purchasePrice: submission.purchase_price,
      rehab: submission.rehab,
      squareFeet: submission.square_feet,
      bedrooms: submission.bedrooms,
      bathrooms: submission.bathrooms,
      yearBuilt: submission.year_built,
      propertyType: submission.property_type,
      propertyCondition: submission.property_condition,
      renovationPerSf: Number(submission.renovation_per_sf),
      userEstimatedAsIsValue: submission.user_estimated_as_is_value,
      userEstimatedArv: submission.user_estimated_arv,
      interestRate: submission.interest_rate,
      months: submission.months,
      loanAtPurchase: submission.loan_at_purchase,
      renovationFunds: submission.renovation_funds,
      closingCostsPercent: submission.closing_costs_percent,
      points: submission.points,
      marketType: submission.market_type,
      additionalDetails: submission.additional_details,
    };

    const garyARV = submission.estimated_arv ?? 0;
    const garyAsIsValue = submission.as_is_value ?? 0;
    const finalScore = submission.final_score ?? 0;
    const compsUsed = submission.property_comps ? JSON.parse(submission.property_comps) : [];
    const compSelectionState = submission.comp_selection_state
      ? JSON.parse(submission.comp_selection_state)
      : undefined;

    const garyCalcs = calculateUnderwriting(formData as any, garyARV, garyAsIsValue);

    console.log("\n🤖 Calling OpenRouter for Gary's opinion...");
    const startTime = Date.now();

    const prompt = generateGaryOpinionPrompt(
      formData as any,
      garyCalcs,
      garyCalcs,
      garyAsIsValue,
      garyARV,
      garyAsIsValue, // apiAsIsValue — not stored separately, use Gary's value
      compsUsed,
      compSelectionState,
      finalScore,
    );

    const newOpinion = await openRouterClient.generateText(prompt, {
      systemPrompt: GARY_OPINION_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 2000,
    });

    console.log(`✅ Got opinion in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`   Preview: ${newOpinion.slice(0, 120)}...`);

    await prisma.underwritingSubmission.update({
      where: { reportId },
      data: { garyOpinion: newOpinion },
    });

    console.log("\n✅ Updated gary_opinion in database");
  }

  if (noEmail) {
    console.log("\n⏭️  Skipping email (--no-email flag)");
  } else {
    const user = await prisma.user.findUnique({ where: { id: submission.user_id } });
    if (!user?.email) {
      console.error("❌ Could not find user email — skipping email");
    } else {
      await sendReportEmail(user.email, reportId, user.reportRetentionDays || 14, previewEmail);
    }
  }

  console.log(`\n🔗 Report URL: https://glassloans.io/underwrite/results/${reportId}`);
  console.log("\n✅ Done!\n");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
