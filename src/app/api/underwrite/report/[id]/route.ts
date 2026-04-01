import { NextRequest, NextResponse } from "next/server";
import { getSubmissionByReportId } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  UnderwritingResults,
  UnderwritingFormData,
  PropertyComps,
} from "@/types/underwriting";

/**
 * GET /api/underwrite/report/[id]
 * Fetch an underwriting report by its report ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    // Validate report ID format
    if (!reportId || typeof reportId !== "string" || reportId.length < 8) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400 }
      );
    }

    // Fetch the submission
    const submission = await getSubmissionByReportId(reportId);

    if (!submission) {
      return NextResponse.json(
        { error: "Report not found or has expired" },
        { status: 404 }
      );
    }

    // Reconstruct form data
    const formData: UnderwritingFormData = {
      propertyAddress: submission.property_address,
      propertyCity: submission.property_city || undefined,
      propertyState: submission.property_state || undefined,
      propertyZip: submission.property_zip || undefined,
      propertyCounty: submission.property_county || undefined,
      purchasePrice: submission.purchase_price,
      rehab: submission.rehab,
      squareFeet: submission.square_feet,
      bedrooms: submission.bedrooms || 0,
      bathrooms: submission.bathrooms || 0,
      yearBuilt: submission.year_built || 0,
      propertyType: submission.property_type as any,
      propertyCondition: submission.property_condition as any,
      renovationPerSf: Number(submission.renovation_per_sf),
      userEstimatedAsIsValue: submission.user_estimated_as_is_value || 0,
      userEstimatedArv: submission.user_estimated_arv || 0,
      interestRate: submission.interest_rate,
      months: submission.months,
      loanAtPurchase: submission.loan_at_purchase,
      renovationFunds: submission.renovation_funds,
      closingCostsPercent: submission.closing_costs_percent,
      points: submission.points,
      marketType: submission.market_type as any,
      additionalDetails: submission.additional_details || undefined,
    };

    // Reconstruct property comps
    const propertyComps: PropertyComps = submission.property_comps
      ? JSON.parse(submission.property_comps)
      : {
          estimatedARV: submission.estimated_arv || 0,
          asIsValue: submission.as_is_value || 0,
          compsUsed: [],
          marketAnalysis: "",
        };

    // Import the calculation function
    const { calculateUnderwriting } = await import("@/lib/underwriting/calculations");

    // Recalculate metrics using Gary's ARV estimate
    const calculations = calculateUnderwriting(
      formData,
      propertyComps.estimatedARV,
      propertyComps.asIsValue
    );

    // Transform to UnderwritingResults format
    const results: UnderwritingResults = {
      finalScore: submission.final_score || 0,
      calculations,
      garyOpinion: submission.gary_opinion || "",
      formData,
      propertyComps,
      submittedAt: new Date(submission.created_at),
      usageCount: 0, // Not relevant for shared reports
      usageLimit: 0, // Not relevant for shared reports
      reportId: submission.report_id || undefined,
      expiresAt: submission.expires_at || undefined,
    };

    return NextResponse.json(results);
  } catch (error: any) {
    console.error("[Server] Error fetching report:", error);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/underwrite/report/[id]
 * Delete an underwriting report (authenticated users only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - Please sign in" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Parse ID as number (submission ID, not reportId)
    const submissionId = parseInt(id, 10);

    if (isNaN(submissionId)) {
      return NextResponse.json(
        { error: "Invalid report ID" },
        { status: 400 }
      );
    }

    // Fetch the submission to verify ownership
    const submission = await prisma.underwritingSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, userId: true },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Verify user owns this report
    if (submission.userId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden - You don't own this report" },
        { status: 403 }
      );
    }

    // Delete the report
    await prisma.underwritingSubmission.delete({
      where: { id: submissionId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Server] Error deleting report:", error);
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    );
  }
}
