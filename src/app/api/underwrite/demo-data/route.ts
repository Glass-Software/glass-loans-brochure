import { NextResponse } from "next/server";
import { findUserByNormalizedEmail } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";

/**
 * Get demo/test data from an existing submission
 * Only works in development or with correct demo key
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, propertyAddress, demoKey } = body;

    // Security: Only allow in development OR with correct demo key
    const isDevelopment = process.env.NODE_ENV === "development";
    const hasValidDemoKey = demoKey === process.env.DEMO_MODE_KEY;

    if (!isDevelopment && !hasValidDemoKey) {
      return NextResponse.json(
        { success: false, error: "Demo mode not available" },
        { status: 403 }
      );
    }

    if (!email || !propertyAddress) {
      return NextResponse.json(
        { success: false, error: "Email and property address required" },
        { status: 400 }
      );
    }

    // Get user (normalize email for case-insensitive lookup)
    const normalizedEmail = email.toLowerCase().trim();
    const user = await findUserByNormalizedEmail(normalizedEmail);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Find submission by user and property address
    const submission = await prisma.underwritingSubmission.findFirst({
      where: {
        userId: user.id,
        propertyAddress: {
          contains: propertyAddress,
          mode: "insensitive",
        },
      },
      orderBy: {
        createdAt: "desc", // Get most recent if multiple
      },
    });

    if (!submission) {
      return NextResponse.json(
        { success: false, error: "Submission not found for that address" },
        { status: 404 }
      );
    }

    // Parse comps
    let compsUsed = [];
    try {
      compsUsed = submission.propertyComps
        ? JSON.parse(submission.propertyComps)
        : [];
      console.log(`✅ Demo data: Found ${compsUsed.length} comps for ${submission.propertyAddress}`);
      console.log(`✅ Demo data: Submission created at ${submission.createdAt}`);
    } catch (error) {
      console.error("Failed to parse comps:", error);
    }

    // Parse comp selection state
    let compSelectionState = [];
    try {
      compSelectionState = submission.compSelectionState
        ? JSON.parse(submission.compSelectionState)
        : [];
    } catch (error) {
      console.error("Failed to parse comp selection state:", error);
    }

    // Build form data
    const formData = {
      propertyAddress: submission.propertyAddress,
      propertyCity: submission.propertyCity,
      propertyState: submission.propertyState,
      propertyZip: submission.propertyZip,
      propertyCounty: submission.propertyCounty,
      propertyLatitude: submission.propertyLatitude,
      propertyLongitude: submission.propertyLongitude,
      purchasePrice: submission.purchasePrice,
      rehab: submission.rehab,
      squareFeet: submission.squareFeet,
      bedrooms: submission.bedrooms,
      bathrooms: submission.bathrooms,
      yearBuilt: submission.yearBuilt,
      propertyType: submission.propertyType,
      propertyCondition: submission.propertyCondition,
      renovationPerSf: Number(submission.renovationPerSf),
      interestRate: submission.interestRate,
      months: submission.months,
      loanAtPurchase: submission.loanAtPurchase,
      renovationFunds: submission.renovationFunds,
      closingCostsPercent: submission.closingCostsPercent,
      points: submission.points,
      marketType: submission.marketType,
      additionalDetails: submission.additionalDetails,
    };

    // Build property comps
    const propertyComps = {
      estimatedARV: submission.estimatedArv,
      asIsValue: submission.asIsValue,
      compsUsed: Array.isArray(compsUsed) ? compsUsed : [],
      marketAnalysis: "",
      confidence: "medium" as const,
      subjectLatitude: submission.propertyLatitude,
      subjectLongitude: submission.propertyLongitude,
    };

    // Initialize comp selection state if not exists
    if (compSelectionState.length === 0 && compsUsed.length > 0) {
      compSelectionState = compsUsed.map((_: any, idx: number) => ({
        compIndex: idx,
        emphasized: false,
        removed: false,
      }));
    }

    return NextResponse.json({
      success: true,
      formData,
      propertyComps,
      compSelectionState,
      message: `Loaded demo data from submission for ${submission.propertyAddress}`,
    });
  } catch (error) {
    console.error("Demo data error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load demo data",
      },
      { status: 500 }
    );
  }
}
