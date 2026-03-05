/**
 * BatchData Underwriting Orchestrator
 * Main entry point that replaces AI comp generation with real market data
 */

import { UnderwritingFormData } from "@/types/underwriting";
import { getBatchDataClient } from "./client";
import {
  getCachedProperty,
  cacheProperty,
  trackAPIUsage,
} from "./cache";
import { searchComparables } from "./comps";
import { calculateValuation } from "./valuation";
import { detectRiskFlags } from "./risk";
import { BatchDataError } from "./errors";

/**
 * Main entry point: Get property estimates using BatchData
 * This replaces the AI comp generation in the underwriting flow
 */
export async function getBatchDataPropertyEstimates(
  formData: UnderwritingFormData
): Promise<any> {
  const client = getBatchDataClient();

  try {
    // Step 1: Try to lookup subject property details (optional - may not exist in database)
    console.log("Step 1: Looking up subject property...");
    const addressInput = {
      street: formData.propertyAddress,
      city: formData.propertyCity,
      state: formData.propertyState,
      zip: formData.propertyZip
    };
    console.log("[DEBUG] Property lookup address:", JSON.stringify(addressInput));

    let subjectProperty = null;
    try {
      subjectProperty = await lookupProperty(client, addressInput);
      console.log("[DEBUG] Property lookup succeeded");
    } catch (error: any) {
      console.log("[DEBUG] Property lookup failed (not in database), using form data instead");
      // Create a minimal subject property from form input only
      // Extract street number and name from propertyAddress (e.g., "2316 Fernwood Drive")
      const addressParts = formData.propertyAddress.trim().split(' ');
      const streetNumber = addressParts[0] || '';
      const streetName = addressParts.slice(1).join(' ') || formData.propertyAddress;

      const fullAddress = `${formData.propertyAddress}, ${formData.propertyCity}, ${formData.propertyState} ${formData.propertyZip}`;

      subjectProperty = {
        address: {
          standardizedAddress: fullAddress,
          streetNumber: streetNumber,
          streetName: streetName,
          city: formData.propertyCity,
          state: formData.propertyState,
          zipCode: formData.propertyZip,
          county: formData.propertyCounty,
          latitude: 0, // Not needed for comp search
          longitude: 0, // Not needed for comp search
        },
        propertyType: formData.propertyType,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        squareFeet: formData.squareFeet,
        yearBuilt: formData.yearBuilt,
        // No AVM, tax assessment, or other details since property isn't in database
      };
    }

    // Step 2: Search for comparable sales (3-tier strategy with caching)
    // Use user-provided property details and market type for comp search
    console.log("Step 2: Searching for comparable sales...");
    const compResult = await searchComparables({
      subjectProperty,
      marketType: formData.marketType,
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
 * Lookup property (with caching)
 */
async function lookupProperty(client: any, address: string | any): Promise<any> {
  const startTime = Date.now();

  // Generate cache key from address (handle both string and AddressInput)
  const cacheKey = typeof address === 'string'
    ? address
    : `${address.street}, ${address.city}, ${address.state} ${address.zip}`;

  const cached = getCachedProperty(cacheKey);
  if (cached) {
    console.log("Using cached property details");
    trackAPIUsage("/property/lookup", true, true, Date.now() - startTime);
    return cached;
  }

  try {
    const result = await client.lookupProperty(address);
    cacheProperty(cacheKey, result);
    trackAPIUsage("/property/lookup", true, false, Date.now() - startTime);
    return result;
  } catch (error: any) {
    console.error("[BatchData] Property lookup failed:");
    console.error("  Address:", cacheKey);
    console.error("  Error:", error.message);
    if (error.response) {
      console.error("  Status:", error.response.status);
      console.error("  Data:", JSON.stringify(error.response.data).substring(0, 200));
    }
    trackAPIUsage(
      "/property/lookup",
      false,
      false,
      Date.now() - startTime,
      error.message
    );
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

  let analysis = `Based on ${compCount} comparable sales within ${compResult.searchRadius} miles (${tierLabel} search criteria), `;
  analysis += `the estimated ARV is $${valuation.estimatedARV.toLocaleString()}. `;

  if (compResult.tier === 1) {
    analysis += "High confidence: Tight comps with similar characteristics. ";
  } else if (compResult.tier === 2) {
    analysis += "Moderate confidence: Expanded search radius for sufficient data. ";
  } else {
    analysis +=
      "Lower confidence: Wide search radius required - limited comparable sales. ";
  }

  analysis += `Median price per sqft is $${compResult.medianPricePerSqft.toFixed(
    2
  )}. `;

  if (valuation.valuationMethod === "triangulated") {
    analysis += `This estimate triangulates BatchData AVM ($${valuation.avmValue.toLocaleString()}, ${
      valuation.avmConfidence
    }% confidence) with comp-derived value ($${valuation.compDerivedValue.toLocaleString()}). `;
  } else if (valuation.valuationMethod === "avm_only") {
    analysis += `Limited comps available - estimate weighted toward BatchData AVM. `;
  } else {
    analysis += `Low AVM confidence - estimate weighted toward comparable sales. `;
  }

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
