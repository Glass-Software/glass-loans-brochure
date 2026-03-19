import { NextRequest, NextResponse } from "next/server";
import { UnderwritingFormData } from "@/types/underwriting";
import { getPropertyEstimates } from "@/lib/comps/provider";

/**
 * POST /api/underwrite/fetch-comps
 *
 * Fetches comparable properties for the subject property without generating a full report.
 * This endpoint is called from Step 5 (Email Verification) after the user verifies their code.
 * The comps are then displayed in Step 6 (Comp Selection) for user review.
 *
 * Request body:
 * - formData: UnderwritingFormData - Property and loan details
 *
 * Response:
 * - success: boolean
 * - propertyComps: PropertyComps object with estimated ARV, as-is value, and comps list
 * - error: string if failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData } = body as { formData: UnderwritingFormData };

    // Validate form data
    if (!formData) {
      return NextResponse.json(
        { success: false, error: "Form data is required" },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = [
      "propertyAddress",
      "purchasePrice",
      "rehab",
      "squareFeet",
    ];

    for (const field of requiredFields) {
      if (!formData[field as keyof UnderwritingFormData]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Fetch comparable properties using the provider chain
    // This will try RentCast → Realie → AI → Heuristic fallback
    const propertyComps = await getPropertyEstimates(formData);

    // Return comps
    return NextResponse.json({
      success: true,
      propertyComps,
    });
  } catch (error) {
    console.error("❌ Fetch comps error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch comps. Please try again.",
      },
      { status: 500 }
    );
  }
}
