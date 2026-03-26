import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSubmissionById, getSubmissionByReportId } from "@/lib/db/queries";
import { calculateUnderwriting } from "@/lib/underwriting/calculations";
import CalculationBreakdown from "@/components/Underwriting/CalculationBreakdown";
import GaryOpinion from "@/components/Underwriting/GaryOpinion";
import GaryMetricsSection from "@/components/Underwriting/GaryMetricsSection";
import ScoreMetricsComparison from "@/components/Underwriting/ScoreMetricsComparison";
import CompsMapSection from "@/components/Underwriting/CompsMapSection";
import type {
  UnderwritingFormData,
  PropertyComps,
  CompSelectionState,
} from "@/types/underwriting";

export const metadata: Metadata = {
  title: "Underwriting Results | Glass Loans",
  description: "View your AI-powered underwriting analysis",
};

interface ResultsPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    verified?: string;
  }>;
}

export default async function ResultsPage({
  params,
  searchParams,
}: ResultsPageProps) {
  const { id } = await params;
  const { verified } = await searchParams;

  // Determine if ID is a report ID (alphanumeric) or submission ID (numeric)
  const isNumeric = /^\d+$/.test(id);

  // Get submission from database
  const submission = isNumeric
    ? await getSubmissionById(parseInt(id, 10))
    : await getSubmissionByReportId(id);

  if (!submission) {
    notFound();
  }

  // Reconstruct form data
  const formData: UnderwritingFormData = {
    propertyAddress: submission.property_address,
    propertyCity: submission.property_city || undefined,
    propertyState: submission.property_state || undefined,
    propertyZip: submission.property_zip || undefined,
    propertyCounty: submission.property_county || undefined,
    propertyLatitude: submission.property_latitude || undefined,
    propertyLongitude: submission.property_longitude || undefined,
    purchasePrice: submission.purchase_price,
    rehab: submission.rehab,
    squareFeet: submission.square_feet,
    bedrooms: submission.bedrooms || 0,
    bathrooms: submission.bathrooms || 0,
    yearBuilt: submission.year_built || 0,
    propertyType: submission.property_type as any,
    propertyCondition: submission.property_condition as any,
    renovationPerSf: Number(submission.renovation_per_sf),
    userEstimatedAsIsValue: submission.user_estimated_as_is_value || 0, // Fallback for old submissions
    userEstimatedArv: submission.user_estimated_arv || 0, // Fallback for old submissions
    interestRate: submission.interest_rate,
    months: submission.months,
    loanAtPurchase: submission.loan_at_purchase,
    renovationFunds: submission.renovation_funds,
    closingCostsPercent: submission.closing_costs_percent,
    points: submission.points,
    marketType: submission.market_type as any,
    additionalDetails: submission.additional_details || undefined,
  };

  // Reconstruct property comps
  let parsedComps: any[] = [];
  try {
    parsedComps = submission.property_comps
      ? JSON.parse(submission.property_comps)
      : [];
    // Ensure it's an array
    if (!Array.isArray(parsedComps)) {
      console.error("property_comps is not an array:", parsedComps);
      parsedComps = [];
    }
  } catch (error) {
    console.error("Failed to parse property_comps:", error);
    parsedComps = [];
  }

  const propertyComps: PropertyComps = {
    estimatedARV: submission.estimated_arv || 0,
    asIsValue: submission.as_is_value || 0,
    compsUsed: Array.isArray(parsedComps) ? parsedComps : [],
    marketAnalysis: "",
    confidence: "medium",
  };

  // Parse comp selection state (if available)
  let compSelectionState: CompSelectionState[] = [];
  try {
    compSelectionState = submission.comp_selection_state
      ? JSON.parse(submission.comp_selection_state)
      : [];
    if (!Array.isArray(compSelectionState)) {
      console.error("comp_selection_state is not an array:", compSelectionState);
      compSelectionState = [];
    }
  } catch (error) {
    console.error("Failed to parse comp_selection_state:", error);
    compSelectionState = [];
  }

  // Calculate Gary's analysis (using Gary's ARV and As-Is estimates)
  const garyCalculations = calculateUnderwriting(
    formData,
    propertyComps.estimatedARV,
    propertyComps.asIsValue
  );

  // Calculate user's metrics (using user's ARV and As-Is estimates) - only for legacy reports
  const userCalculations = formData.userEstimatedArv && formData.userEstimatedAsIsValue
    ? calculateUnderwriting(
        formData,
        formData.userEstimatedArv,
        formData.userEstimatedAsIsValue
      )
    : null;

  // Get property coordinates for map
  // Priority: 1) Subject property coords from DB, 2) First comp with valid coords, 3) null (hide map)
  const firstCompWithCoords = propertyComps.compsUsed?.find(
    comp => comp.latitude != null && comp.longitude != null
  );

  const propertyCoordinates =
    formData.propertyLatitude != null && formData.propertyLongitude != null
      ? { lat: formData.propertyLatitude, lng: formData.propertyLongitude }
      : firstCompWithCoords
        ? { lat: firstCompWithCoords.latitude, lng: firstCompWithCoords.longitude }
        : null;

  return (
    <section className="overflow-hidden py-16 md:py-20 lg:py-28">
      <div className="container">
        {verified && (
          <div className="mb-8 rounded-sm bg-green-50 p-4 dark:bg-green-900/20">
            <p className="text-center text-sm text-green-800 dark:text-green-200">
              ✓ Email verified successfully! Here are your underwriting results.
            </p>
          </div>
        )}

        {submission.expires_at && (
          <div className="mb-8 rounded-sm border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-center text-sm text-blue-800 dark:text-blue-200">
              This report will be available until{" "}
              {new Date(submission.expires_at).toLocaleDateString()}
            </p>
          </div>
        )}

        <div className="mx-auto max-w-5xl">
          {/* Section 1: Metrics - Show comparison for old reports with user estimates, Gary-only for new reports */}
          {userCalculations && formData.userEstimatedArv && formData.userEstimatedAsIsValue ? (
            <ScoreMetricsComparison
              propertyAddress={formData.propertyAddress}
              score={submission.final_score}
              userCalculations={userCalculations}
              garyCalculations={garyCalculations}
              userAsIsValue={formData.userEstimatedAsIsValue}
              garyAsIsValue={propertyComps.asIsValue}
            />
          ) : (
            <GaryMetricsSection
              propertyAddress={formData.propertyAddress}
              score={submission.final_score}
              garyCalculations={garyCalculations}
              garyAsIsValue={propertyComps.asIsValue}
            />
          )}

          {/* Section 2: Gary's Full Opinion */}
          <div className="mb-8">
            <GaryOpinion opinion={submission.gary_opinion || ""} />
          </div>

          {/* Section 3: Comps with Map */}
          {propertyComps.compsUsed && propertyComps.compsUsed.length > 0 && propertyCoordinates && (
            <CompsMapSection
              propertyComps={propertyComps}
              propertyCoordinates={propertyCoordinates}
              propertyAddress={formData.propertyAddress}
              compSelectionState={compSelectionState}
            />
          )}

          {/* Section 4: Detailed Calculations */}
          <div className="mb-8">
            <CalculationBreakdown
              formData={formData}
              propertyComps={propertyComps}
              calculations={garyCalculations}
              hideComps={true}
            />
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <a
              href="/underwrite"
              className="inline-block rounded-sm bg-primary px-8 py-3 text-base font-medium text-white hover:bg-primary/90"
            >
              Analyze Another Property
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
