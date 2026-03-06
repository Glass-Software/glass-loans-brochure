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
 * Calculate ARV and As-Is Value
 *
 * NEW STRATEGY (Percentile-Based ARV):
 * - ARV = 100% comp-derived value (using percentiles based on rehab budget)
 *   - No rehab: ARV = As-Is Value (median comps, 50th percentile)
 *   - With rehab: ARV = Upper percentile comps (65th-87.5th based on renovation intensity)
 * - AVM is ONLY used for as-is value, NOT for ARV
 *   - AVM = Automated estimate of property in CURRENT condition
 *   - ARV = Market value AFTER renovation (from renovated comps)
 *
 * Confidence based on:
 * - Number of comps found
 * - Search tier tightness
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

  // ARV = 100% comp-derived value (already percentile-adjusted based on rehab budget)
  estimatedARV = compDerivedValue;
  valuationMethod = "comp_only";

  // Confidence based on comp count and tier tightness
  if (compCount >= 5 && compTier === 1) {
    confidence = "high"; // 5+ tight comps
  } else if (compCount >= 3 && compTier <= 2) {
    confidence = "medium"; // 3+ moderate comps
  } else {
    confidence = "low"; // <3 comps or wide search
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
