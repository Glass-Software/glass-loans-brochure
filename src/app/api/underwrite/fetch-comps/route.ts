import { NextRequest, NextResponse } from "next/server";
import { UnderwritingFormData } from "@/types/underwriting";
import { getPropertyEstimates } from "@/lib/comps/provider";
import { normalizeEmail } from "@/lib/email/normalization";
import { findVerifiedUserByEmail } from "@/lib/db/queries";

// Removed maxDuration - Vercel-specific feature that breaks on Fly.io
// export const maxDuration = 60;

/**
 * POST /api/underwrite/fetch-comps
 *
 * Fetches comparable properties for the subject property without generating a full report.
 * This endpoint is called from Step 6 (Comp Selection) when the user arrives at the step.
 * The comps are then displayed on a map for user review.
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
    const { formData, email } = body as { formData: UnderwritingFormData; email?: string };

    // Validate authentication
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify user is authenticated (email verified in Step 5)
    const normalizedEmail = normalizeEmail(email);
    const user = await findVerifiedUserByEmail(normalizedEmail);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not verified. Please complete email verification first." },
        { status: 401 }
      );
    }

    // Rate limiting DISABLED - causes database locking issues on Fly.io
    // const forwarded = request.headers.get("x-forwarded-for");
    // const ip = forwarded ? forwarded.split(",")[0] : "unknown";
    // const rateLimit = checkRateLimit(ip, "/api/underwrite/fetch-comps", 5, 60);
    // if (!rateLimit.allowed) {
    //   return NextResponse.json({ success: false, error: "Too many requests. Please try again later." }, { status: 429 });
    // }

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
      "yearBuilt",
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

    console.log(`[fetch-comps API] ✅ Successfully fetched ${propertyComps.compsUsed.length} comps`);

    // Return comps
    return NextResponse.json({
      success: true,
      propertyComps,
    });
  } catch (error: any) {
    console.error("❌ Fetch comps error:", error);
    console.error("❌ Error type:", typeof error);
    console.error("❌ Error constructor:", error?.constructor?.name);
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack");

    // Handle NO_COMPS_FOUND error gracefully with user-friendly message
    if (error.code === "NO_COMPS_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "No comparable sales found. Please try a different address.",
        },
        { status: 404 }
      );
    }

    // Handle INSUFFICIENT_COMPS error from RentCast API
    if (error.code === "INSUFFICIENT_COMPS") {
      return NextResponse.json(
        {
          success: false,
          error: "Sorry, we're unable to pull comps for this property. Please try another address with a complete city, state, and ZIP code.",
        },
        { status: 400 }
      );
    }

    // Handle MISSING_SQFT error from Rentcast subjectProperty
    if (error.code === "MISSING_SQFT") {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error) || "Failed to fetch comps. Please try again.",
      },
      { status: 500 }
    );
  }
}
