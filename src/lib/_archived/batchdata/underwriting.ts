/**
 * BatchData Underwriting Orchestrator
 * Main entry point that replaces AI comp generation with real market data
 */

import { UnderwritingFormData } from "@/types/underwriting";
import { getBatchDataClient } from "./client";
import { searchComparables } from "./comps";
import { calculateValuation } from "./valuation";
import { detectRiskFlags } from "./risk";

/**
 * Map internal property types to BatchData API expected values
 */
function mapPropertyTypeToBatchData(propertyType: string): string {
  const mapping: Record<string, string> = {
    "SFR": "Single Family",
    "Condo": "Condo",
    "Townhouse": "Townhouse",
    "Multi-Family": "Multi-Family"
  };
  return mapping[propertyType] || "Single Family";
}

/**
 * Main entry point: Get property estimates using BatchData
 * This replaces the AI comp generation in the underwriting flow
 */
export async function getBatchDataPropertyEstimates(
  formData: UnderwritingFormData
): Promise<any> {
  try {
    // Step 1: Build subject property from form data (no longer using property lookup API)
    console.log("Step 1: Building subject property from form data...");

    // Extract street number and name from propertyAddress (e.g., "2316 Fernwood Drive")
    const addressParts = formData.propertyAddress.trim().split(' ');
    const streetNumber = addressParts[0] || '';
    const streetName = addressParts.slice(1).join(' ') || formData.propertyAddress;

    const fullAddress = `${formData.propertyAddress}, ${formData.propertyCity}, ${formData.propertyState} ${formData.propertyZip}`;

    const subjectProperty = {
      address: {
        standardizedAddress: fullAddress,
        streetNumber: streetNumber,
        streetName: streetName,
        city: formData.propertyCity,
        state: formData.propertyState,
        zipCode: formData.propertyZip,
        zipPlus4: '',
        county: formData.propertyCounty || '',
        countyFips: '',
        latitude: 0, // Not needed for comp search
        longitude: 0, // Not needed for comp search
        validated: true,
      },
      propertyType: mapPropertyTypeToBatchData(formData.propertyType),
      bedrooms: formData.bedrooms,
      bathrooms: formData.bathrooms,
      squareFeet: formData.squareFeet,
      lotSize: 0, // Not available from form data
      yearBuilt: formData.yearBuilt,
      lastSaleDate: null,
      lastSalePrice: null,
      taxAssessedValue: 0,
      taxAssessmentHistory: [],
      zoning: '',
      preForeclosure: false,
    };

    // Step 1.5: Verify the address (fail fast if invalid, save API calls)
    console.log("Step 1.5: Verifying subject property address...");
    const client = getBatchDataClient();
    try {
      const verifiedAddress = await client.verifyAddress({
        street: formData.propertyAddress,
        city: formData.propertyCity,
        state: formData.propertyState,
        zip: formData.propertyZip,
      });

      // Update subject property with validated coordinates
      if (verifiedAddress.latitude && verifiedAddress.longitude) {
        subjectProperty.address.latitude = verifiedAddress.latitude;
        subjectProperty.address.longitude = verifiedAddress.longitude;
        console.log(`[Verified] Address coordinates: ${verifiedAddress.latitude}, ${verifiedAddress.longitude}`);
      }
    } catch (error: any) {
      // Address validation failed - return error to user immediately
      throw new Error(`Invalid property address: ${error.message}`);
    }

    // Step 2: Search for comparable sales (3-tier strategy with caching)
    // Use user-provided property details and market type for comp search
    console.log("Step 2: Searching for comparable sales...");
    const compResult = await searchComparables({
      subjectProperty,
      marketType: formData.marketType,
      rehabBudget: formData.rehab, // Pass rehab budget for percentile-based ARV
      userPropertyData: {
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        yearBuilt: formData.yearBuilt,
        squareFeet: formData.squareFeet,
      }
    });

    // Step 3: Calculate valuation (triangulate AVM + comps)
    console.log("Step 3: Calculating valuation...");
    const valuation = calculateValuation(subjectProperty, compResult);

    // Step 4: Detect risk flags
    console.log("Step 4: Detecting risk flags...");
    const riskFlags = detectRiskFlags(
      subjectProperty,
      compResult,
      valuation,
      formData
    );

    // Step 6: Transform to existing AIPropertyEstimates format
    const estimates = {
      estimatedARV: valuation.estimatedARV,
      asIsValue: valuation.asIsValue,
      compsUsed: compResult.comps.map((comp: any) => ({
        address: comp.address,
        price: comp.lastSalePrice,
        sqft: comp.squareFeet,
        distance: `${comp.distance.toFixed(2)} mi`,
        soldDate: comp.lastSaleDate,
        bedrooms: comp.bedrooms,
        bathrooms: comp.bathrooms,
        yearBuilt: comp.yearBuilt,
        pricePerSqft: Math.round(comp.lastSalePrice / comp.squareFeet),
        // Valuation data to detect overvalued/renovated comps
        avmValue: comp.avm?.value,
        avmConfidence: comp.avm?.confidenceScore,
        taxAssessedValue: comp.taxAssessedValue,
        // Flag potential issues
        isPotentialFlip: comp.taxAssessedValue && comp.lastSalePrice > comp.taxAssessedValue * 1.5,
        // Listing URL for hyperlinks
        listingUrl: comp.listingUrl,
        // Outlier flags for UI warnings
        isOutlier: comp.isOutlier,
        outlierReason: comp.outlierReason,
      })),
      // NEW: Flagged comps (outliers, renovated, etc.)
      flaggedComps: compResult.flaggedComps?.map((comp: any) => ({
        address: comp.address,
        price: comp.lastSalePrice,
        sqft: comp.squareFeet,
        distance: `${comp.distance.toFixed(2)} mi`,
        soldDate: comp.lastSaleDate,
        bedrooms: comp.bedrooms,
        bathrooms: comp.bathrooms,
        pricePerSqft: Math.round(comp.lastSalePrice / comp.squareFeet),
        isOutlier: comp.isOutlier,
        isRenovated: comp.isRenovated,
        outlierReason: comp.outlierReason,
      })) || [],
      marketAnalysis: generateMarketAnalysis(
        subjectProperty,
        compResult,
        valuation,
        formData
      ),

      // Extended fields for BatchData
      batchDataUsed: true,
      subjectPropertyDetails: {
        propertyType: subjectProperty.propertyType,
        bedrooms: subjectProperty.bedrooms,
        bathrooms: subjectProperty.bathrooms,
        yearBuilt: subjectProperty.yearBuilt,
        taxAssessedValue: subjectProperty.taxAssessedValue,
        lastSalePrice: subjectProperty.lastSalePrice,
        lastSaleDate: subjectProperty.lastSaleDate,
      },
      compTier: compResult.tier,
      compDerivedValue: compResult.compDerivedValue,
      avmValue: valuation.avmValue,
      avmConfidence: valuation.avmConfidence,
      valuationMethod: "batchdata",
      riskFlags,
      // NEW: Flagging metadata
      flaggingApplied: compResult.flaggingApplied,
      flagSummary: compResult.flagSummary,
      pricePerSqftStats: compResult.pricePerSqftStats,
    };

    console.log("[Server] Property estimates complete:", {
      estimatedARV: estimates.estimatedARV,
      compsFound: estimates.compsUsed.length,
      tier: estimates.compTier,
    });

    return estimates;
  } catch (error: any) {
    console.error("[Server] ❌ BatchData ERROR:");
    console.error("  Message:", error.message);
    console.error("  Type:", error.constructor.name);
    if (error.response) {
      console.error("  Response Status:", error.response.status);
      console.error("  Response Data:", error.response.data);
    }
    if (error.stack) {
      console.error("  Stack:", error.stack.split('\n').slice(0, 5).join('\n'));
    }

    // Rethrow to trigger fallback in route handler
    throw error;
  }
}

/**
 * Generate market analysis narrative for Gary
 */
function generateMarketAnalysis(
  subject: any,
  compResult: any,
  valuation: any,
  formData: UnderwritingFormData
): string {
  const compCount = compResult.comps.length;
  const tierLabel =
    compResult.tier === 1 ? "tight" : compResult.tier === 2 ? "moderate" : "wide";
  const userArvDiff =
    ((formData.userEstimatedArv - valuation.estimatedARV) /
      valuation.estimatedARV) *
    100;

  const renovationPerSqft = formData.squareFeet > 0 ? formData.rehab / formData.squareFeet : 0;
  const hasRehab = formData.rehab > 0;

  let analysis = `Based on ${compCount} comparable sales within ${compResult.searchRadius} miles (${tierLabel} search criteria)`;

  // User-provided comps mention
  const userProvidedCount = compResult.comps.filter((c: any) => c.isUserProvided).length;
  if (userProvidedCount > 0) {
    analysis += `, including ${userProvidedCount} user-provided comp${userProvidedCount > 1 ? 's' : ''}`;
  }

  analysis += `, the estimated ARV is $${valuation.estimatedARV.toLocaleString()}. `;

  // Explain percentile methodology for rehab projects
  if (hasRehab) {
    let percentileLabel: string;
    if (renovationPerSqft > 50) {
      percentileLabel = "87.5th percentile (heavy renovation - targeting top-tier renovated comps)";
    } else if (renovationPerSqft > 30) {
      percentileLabel = "80th percentile (medium renovation - targeting upper renovated comps)";
    } else {
      percentileLabel = "65th percentile (light renovation - targeting moderately updated comps)";
    }

    analysis += `With a renovation budget of $${formData.rehab.toLocaleString()} ($${renovationPerSqft.toFixed(0)}/sqft), `;
    analysis += `this ARV uses the ${percentileLabel}. This targets properties that have been recently renovated to similar quality. `;
  } else {
    analysis += `No renovation budget - ARV equals as-is value based on median market comps (50th percentile). `;
  }

  // Confidence assessment
  if (compResult.tier === 1) {
    analysis += "High confidence: Tight comps with similar characteristics. ";
  } else if (compResult.tier === 2) {
    analysis += "Moderate confidence: Expanded search radius for sufficient data. ";
  } else {
    analysis +=
      "Lower confidence: Wide search radius required - limited comparable sales. ";
  }

  analysis += `Median price per sqft is $${compResult.medianPricePerSqft.toFixed(2)}. `;

  // Compare to user's estimate
  if (Math.abs(userArvDiff) < 5) {
    analysis += `Your estimate of $${formData.userEstimatedArv.toLocaleString()} aligns closely with market data.`;
  } else if (userArvDiff > 10) {
    analysis += `Your estimate of $${formData.userEstimatedArv.toLocaleString()} is ${Math.abs(
      userArvDiff
    ).toFixed(1)}% higher than market-based valuation.`;
  } else if (userArvDiff < -10) {
    analysis += `Your estimate of $${formData.userEstimatedArv.toLocaleString()} is ${Math.abs(
      userArvDiff
    ).toFixed(
      1
    )}% lower than market-based valuation - you may be conservative.`;
  } else {
    analysis += `Your estimate of $${formData.userEstimatedArv.toLocaleString()} is within ${Math.abs(
      userArvDiff
    ).toFixed(1)}% of market data.`;
  }

  return analysis;
}
