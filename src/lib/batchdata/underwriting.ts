/**
 * BatchData Underwriting Orchestrator
 * Main entry point that replaces AI comp generation with real market data
 */

import { UnderwritingFormData } from "@/types/underwriting";
import { getBatchDataClient } from "./client";
import {
  getCachedAddress,
  cacheAddress,
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
    // Step 1: Verify and standardize address (with caching)
    console.log("Step 1: Verifying address...");
    const addressResult = await verifyAddress(
      client,
      formData.propertyAddress
    );

    // Step 2: Lookup subject property details (with caching)
    console.log("Step 2: Looking up subject property...");
    const subjectProperty = await lookupProperty(
      client,
      addressResult.standardizedAddress
    );

    // Step 3: Search for comparable sales (3-tier strategy with caching)
    // Use user-provided property details and market type for comp search
    console.log("Step 3: Searching for comparable sales...");
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

    // Step 4: Calculate valuation (triangulate AVM + comps)
    console.log("Step 4: Calculating valuation...");
    const valuation = calculateValuation(subjectProperty, compResult);

    // Step 5: Detect risk flags
    console.log("Step 5: Detecting risk flags...");
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
        pricePerSqft: Math.round(comp.lastSalePrice / comp.squareFeet),
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
    console.error("[Server] Property data error:", error);

    // Rethrow to trigger fallback in route handler
    throw error;
  }
}

/**
 * Verify address (with caching)
 */
async function verifyAddress(client: any, address: string): Promise<any> {
  const startTime = Date.now();
  const cached = getCachedAddress(address);
  if (cached) {
    console.log("Using cached address verification");
    trackAPIUsage("/address/verify", true, true, Date.now() - startTime);
    return cached;
  }

  try {
    const result = await client.verifyAddress(address);
    cacheAddress(address, result);
    trackAPIUsage("/address/verify", true, false, Date.now() - startTime);
    return result;
  } catch (error: any) {
    trackAPIUsage(
      "/address/verify",
      false,
      false,
      Date.now() - startTime,
      error.message
    );
    throw error;
  }
}

/**
 * Lookup property (with caching)
 */
async function lookupProperty(client: any, address: string): Promise<any> {
  const startTime = Date.now();
  const cached = getCachedProperty(address);
  if (cached) {
    console.log("Using cached property details");
    trackAPIUsage("/property/lookup", true, true, Date.now() - startTime);
    return cached;
  }

  try {
    const result = await client.lookupProperty(address);
    cacheProperty(address, result);
    trackAPIUsage("/property/lookup", true, false, Date.now() - startTime);
    return result;
  } catch (error: any) {
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
