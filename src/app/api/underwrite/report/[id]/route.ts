import { NextRequest, NextResponse } from "next/server";
import { getSubmissionByReportId } from "@/lib/db/queries";
import {
  UnderwritingResults,
  UnderwritingFormData,
  BatchDataEnrichedEstimates,
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
    const submission = getSubmissionByReportId(reportId);

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
      renovationPerSf: submission.renovation_per_sf as any,
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
      compLinks: submission.comp_links ? JSON.parse(submission.comp_links) : undefined,
    };

    // Reconstruct AI estimates
    const aiEstimates: BatchDataEnrichedEstimates = submission.ai_property_comps
      ? JSON.parse(submission.ai_property_comps)
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
      aiEstimates.estimatedARV,
      aiEstimates.asIsValue
    );

    // Transform to UnderwritingResults format
    const results: UnderwritingResults = {
      finalScore: submission.final_score || 0,
      calculations,
      garyOpinion: submission.gary_opinion || "",
      formData,
      aiEstimates,
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
