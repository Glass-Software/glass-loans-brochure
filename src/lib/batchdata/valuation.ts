/**
 * Valuation Logic - Triangulate AVM + Comp-Derived Value
 * Smart weighting based on data quality and confidence
 */

import { BatchDataPropertyResponse } from "./types";
import { CompSearchResult } from "./comps";

export interface ValuationResult {
  estimatedARV: number;
  asIsValue: number;
  avmValue: number;
  avmConfidence: number;
  compDerivedValue: number;
  valuationMethod: "triangulated" | "avm_only" | "comp_only";
  confidence: "high" | "medium" | "low";
}

/**
 * Triangulate valuation between AVM and comp-derived value
 *
 * Strategy:
 * - If AVM confidence > 70 and 5+ tight comps: Weight 50/50
 * - If AVM confidence < 50 or < 3 comps: Weight more heavily toward available data
 * - If comps tier 3 (wide search): Weight AVM more heavily
 */
export function calculateValuation(
  subjectProperty: BatchDataPropertyResponse | any,
  compResult: CompSearchResult
): ValuationResult {
  // Check if AVM data exists (property may not be in BatchData's property database)
  const hasAVM = subjectProperty.avm && subjectProperty.avm.value > 0;
  const avmValue = hasAVM ? subjectProperty.avm.value : 0;
  const avmConfidence = hasAVM ? subjectProperty.avm.confidenceScore : 0;
  const compDerivedValue = compResult.compDerivedValue;
  const compCount = compResult.comps.length;
  const compTier = compResult.tier;

  let estimatedARV: number;
  let confidence: "high" | "medium" | "low";
  let valuationMethod: "triangulated" | "avm_only" | "comp_only";

  // If no AVM data, rely entirely on comps
  if (!hasAVM || avmValue === 0) {
    console.log("[Valuation] No AVM data available, using comp-only valuation");
    estimatedARV = compDerivedValue;
    confidence = compCount >= 5 && compTier === 1 ? "medium" : "low";
    valuationMethod = "comp_only";
  }
  // Decision tree for valuation with AVM
  else if (compCount >= 5 && compTier === 1 && avmConfidence >= 70) {
    // Best case: Tight comps + high AVM confidence
    estimatedARV = Math.round(avmValue * 0.5 + compDerivedValue * 0.5);
    confidence = "high";
    valuationMethod = "triangulated";
  } else if (compCount >= 3 && compTier <= 2 && avmConfidence >= 60) {
    // Good case: Decent comps + moderate AVM confidence
    estimatedARV = Math.round(avmValue * 0.6 + compDerivedValue * 0.4);
    confidence = "medium";
    valuationMethod = "triangulated";
  } else if (compCount < 3 && avmConfidence >= 50) {
    // Low comp count: Trust AVM more
    estimatedARV = Math.round(avmValue * 0.8 + compDerivedValue * 0.2);
    confidence = "medium";
    valuationMethod = "avm_only";
  } else if (compCount >= 3 && avmConfidence < 50) {
    // Low AVM confidence: Trust comps more
    estimatedARV = Math.round(avmValue * 0.3 + compDerivedValue * 0.7);
    confidence = "medium";
    valuationMethod = "comp_only";
  } else if (compTier === 3) {
    // Wide comp search: Weight AVM more
    estimatedARV = Math.round(avmValue * 0.7 + compDerivedValue * 0.3);
    confidence = "low";
    valuationMethod = "triangulated";
  } else {
    // Worst case: Limited data - use whatever is available
    if (hasAVM && avmValue > 0) {
      estimatedARV = avmValue;
      valuationMethod = "avm_only";
    } else {
      estimatedARV = compDerivedValue;
      valuationMethod = "comp_only";
    }
    confidence = "low";
  }

  // As-is value = current property condition value (conservative estimate)
  // Use tax assessed value or 85% of AVM/comp value, whichever is available
  let asIsValue: number;
  const taxAssessedValue = subjectProperty.taxAssessedValue || 0;

  if (hasAVM && avmValue > 0 && taxAssessedValue > 0) {
    // Both AVM and tax assessment available - use lower value (conservative)
    asIsValue = Math.min(taxAssessedValue, Math.round(avmValue * 0.85));
  } else if (hasAVM && avmValue > 0) {
    // Only AVM available
    asIsValue = Math.round(avmValue * 0.85);
  } else if (taxAssessedValue > 0) {
    // Only tax assessment available
    asIsValue = taxAssessedValue;
  } else {
    // No property data - estimate from comp-derived value (very conservative)
    asIsValue = Math.round(compDerivedValue * 0.75);
  }

  return {
    estimatedARV,
    asIsValue,
    avmValue,
    avmConfidence,
    compDerivedValue,
    valuationMethod,
    confidence,
  };
}
