/**
 * Risk Flag Detection
 * Identifies potential red flags in property data
 */

import { BatchDataPropertyResponse } from "./types";
import { CompSearchResult } from "./comps";
import { ValuationResult } from "./valuation";

export interface RiskFlag {
  severity: "critical" | "warning" | "info";
  code: string;
  message: string;
}

/**
 * Detect risk flags based on BatchData property data
 */
export function detectRiskFlags(
  subjectProperty: BatchDataPropertyResponse,
  compResult: CompSearchResult,
  valuation: ValuationResult,
  formData: any
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // High LTV warning
  const totalLoan =
    (formData.loanAtPurchase || 0) + (formData.renovationFunds || 0);
  const ltv = totalLoan / valuation.estimatedARV;
  if (ltv > 0.75) {
    flags.push({
      severity: "critical",
      code: "HIGH_LTV",
      message: `LTV of ${(ltv * 100).toFixed(
        1
      )}% exceeds 75% threshold based on market valuation`,
    });
  }

  // Recent flip detection
  if (subjectProperty.lastSaleDate) {
    const monthsSinceLastSale = monthsBetween(
      new Date(subjectProperty.lastSaleDate),
      new Date()
    );
    if (monthsSinceLastSale < 6) {
      flags.push({
        severity: "warning",
        code: "RECENT_FLIP",
        message: `Property was purchased ${monthsSinceLastSale} months ago for $${subjectProperty.lastSalePrice?.toLocaleString()}`,
      });
    }
  }

  // Low comp count
  if (compResult.comps.length < 3) {
    flags.push({
      severity: "warning",
      code: "LOW_COMP_COUNT",
      message: `Only ${compResult.comps.length} comparable sales found - value estimate less reliable`,
    });
  }

  // Wide comp search
  if (compResult.tier === 3) {
    flags.push({
      severity: "warning",
      code: "WIDE_COMP_SEARCH",
      message:
        "Comps required 2-mile radius and 18-month window - limited local comparables",
    });
  }

  // Pre-foreclosure
  if (subjectProperty.preForeclosure) {
    flags.push({
      severity: "critical",
      code: "DISTRESSED_PROPERTY",
      message: "Property shows pre-foreclosure activity",
    });
  }

  // Low AVM confidence
  if (valuation.avmConfidence < 50) {
    flags.push({
      severity: "info",
      code: "LOW_AVM_CONFIDENCE",
      message: `BatchData AVM confidence is ${valuation.avmConfidence}% - valuation has higher uncertainty`,
    });
  }

  // User estimate divergence
  if (formData.userEstimatedArv) {
    const userDivergence =
      Math.abs(formData.userEstimatedArv - valuation.estimatedARV) /
      valuation.estimatedARV;
    if (userDivergence > 0.15) {
      flags.push({
        severity: "warning",
        code: "VALUE_DIVERGENCE",
        message: `User estimated ARV diverges ${(userDivergence * 100).toFixed(
          0
        )}% from market-based valuation`,
      });
    }
  }

  // Tax assessment gap
  if (valuation.estimatedARV > subjectProperty.taxAssessedValue) {
    const taxDivergence =
      (valuation.estimatedARV - subjectProperty.taxAssessedValue) /
      subjectProperty.taxAssessedValue;
    if (taxDivergence > 0.4) {
      flags.push({
        severity: "info",
        code: "TAX_ASSESSMENT_GAP",
        message: `Estimated ARV is ${(taxDivergence * 100).toFixed(
          0
        )}% above tax assessed value`,
      });
    }
  }

  // NEW: Flagged comps warning
  if (
    compResult.flaggingApplied &&
    compResult.flagSummary &&
    compResult.flagSummary.totalFlagged > 0
  ) {
    const totalComps = compResult.allComps?.length || 0;
    const flaggedPercent =
      totalComps > 0 ? (compResult.flagSummary.totalFlagged / totalComps) * 100 : 0;

    if (flaggedPercent > 50) {
      const flagReasons = Object.entries(compResult.flagSummary.flagReasons)
        .map(([reason, count]) => `${count} ${reason}`)
        .join(", ");
      flags.push({
        severity: "warning",
        code: "HIGH_FLAGGED_COMPS",
        message: `${compResult.flagSummary.totalFlagged} of ${totalComps} comps flagged (${flaggedPercent.toFixed(0)}%) - ${flagReasons}`,
      });
    } else if (flaggedPercent > 25) {
      flags.push({
        severity: "info",
        code: "MODERATE_FLAGGED_COMPS",
        message: `${compResult.flagSummary.totalFlagged} of ${totalComps} comps flagged as outliers/renovated - using ${compResult.comps.length} clean comps for valuation`,
      });
    }
  }

  // NEW: Price volatility warning
  if (compResult.pricePerSqftStats) {
    const coefficientOfVariation =
      compResult.pricePerSqftStats.stdDev / compResult.pricePerSqftStats.mean;

    if (coefficientOfVariation > 0.25) {
      flags.push({
        severity: "info",
        code: "HIGH_PRICE_VOLATILITY",
        message: `High price variation in clean comps (CV: ${(coefficientOfVariation * 100).toFixed(0)}%) - market has wide price range`,
      });
    }
  }

  return flags;
}

function monthsBetween(date1: Date, date2: Date): number {
  const months =
    (date2.getFullYear() - date1.getFullYear()) * 12 +
    (date2.getMonth() - date1.getMonth());
  return Math.abs(months);
}
