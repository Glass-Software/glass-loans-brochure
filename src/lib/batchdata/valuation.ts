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
  subjectProperty: BatchDataPropertyResponse,
  compResult: CompSearchResult
): ValuationResult {
  const avmValue = subjectProperty.avm.value;
  const avmConfidence = subjectProperty.avm.confidenceScore;
  const compDerivedValue = compResult.compDerivedValue;
  const compCount = compResult.comps.length;
  const compTier = compResult.tier;

  let estimatedARV: number;
  let confidence: "high" | "medium" | "low";
  let valuationMethod: "triangulated" | "avm_only" | "comp_only";

  // Decision tree for valuation
  if (compCount >= 5 && compTier === 1 && avmConfidence >= 70) {
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
    // Worst case: Limited data
    estimatedARV = avmValue;
    confidence = "low";
    valuationMethod = "avm_only";
  }

  // As-is value = current property condition value (conservative estimate)
  // Use tax assessed value or 85% of AVM, whichever is lower
  const asIsValue = Math.min(
    subjectProperty.taxAssessedValue,
    Math.round(avmValue * 0.85)
  );

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
