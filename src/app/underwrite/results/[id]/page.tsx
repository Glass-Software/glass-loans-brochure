import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSubmissionById, getSubmissionByReportId } from "@/lib/db/queries";
import { calculateUnderwriting } from "@/lib/underwriting/calculations";
import type {
  UnderwritingFormData,
  CalculatedResults
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
    ? getSubmissionById(parseInt(id, 10))
    : getSubmissionByReportId(id);

  if (!submission) {
    notFound();
  }

  // Reconstruct form data
  const formData: UnderwritingFormData = {
    propertyAddress: submission.property_address,
    purchasePrice: submission.purchase_price,
    rehab: submission.rehab,
    squareFeet: submission.square_feet,
    propertyCondition: submission.property_condition as any,
    renovationPerSf: submission.renovation_per_sf as any,
    userEstimatedArv: submission.user_estimated_arv || 0, // Fallback for old submissions
    interestRate: submission.interest_rate,
    months: submission.months,
    loanAtPurchase: submission.loan_at_purchase,
    renovationFunds: submission.renovation_funds,
    closingCostsPercent: submission.closing_costs_percent,
    points: submission.points,
    marketType: submission.market_type as any,
    additionalDetails: submission.additional_details || undefined,
    compLinks: submission.comp_links
      ? JSON.parse(submission.comp_links)
      : undefined,
  };

  // Reconstruct AI estimates
  const aiEstimates = {
    estimatedARV: submission.estimated_arv || 0,
    asIsValue: submission.as_is_value || 0,
    monthlyRent: submission.monthly_rent || 0,
    compsUsed: submission.ai_property_comps
      ? JSON.parse(submission.ai_property_comps)
      : [],
    marketAnalysis: "",
  };

  // Recalculate metrics using Gary's ARV estimate
  const calculations = calculateUnderwriting(
    formData,
    aiEstimates.estimatedARV,
    aiEstimates.asIsValue
  );

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
          {/* Score Card */}
          <div className="mb-8 rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
            <div className="text-center">
              <h1 className="mb-4 text-3xl font-bold text-dark dark:text-white">
                Gary&apos;s Underwriting Analysis
              </h1>
              <p className="mb-6 text-body-color">{formData.propertyAddress}</p>

              <div className="mb-6 inline-flex h-32 w-32 items-center justify-center rounded-full bg-primary/10">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">
                    {submission.final_score}
                  </div>
                  <div className="text-sm text-body-color">/ 100</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-sm bg-gray-50 p-4 dark:bg-gray-900/20">
                  <div className="text-sm text-body-color">ARV</div>
                  <div className="text-lg font-semibold text-dark dark:text-white">
                    ${aiEstimates.estimatedARV.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-sm bg-gray-50 p-4 dark:bg-gray-900/20">
                  <div className="text-sm text-body-color">Loan-to-ARV</div>
                  <div className="text-lg font-semibold text-dark dark:text-white">
                    {calculations.loanToArv.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-sm bg-gray-50 p-4 dark:bg-gray-900/20">
                  <div className="text-sm text-body-color">Borrower Profit</div>
                  <div className="text-lg font-semibold text-dark dark:text-white">
                    ${calculations.borrowerProfit.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-sm bg-gray-50 p-4 dark:bg-gray-900/20">
                  <div className="text-sm text-body-color">Loan Underwater?</div>
                  <div className="text-lg font-semibold text-dark dark:text-white">
                    {calculations.isLoanUnderwater ? "Yes" : "No"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gary's Opinion */}
          <div className="mb-8 rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
            <h2 className="mb-4 text-2xl font-bold text-dark dark:text-white">
              Gary&apos;s Opinion
            </h2>
            <div className="prose max-w-none text-body-color dark:prose-invert">
              {submission.gary_opinion}
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
            <h2 className="mb-4 text-2xl font-bold text-dark dark:text-white">
              Detailed Analysis
            </h2>

            <div className="space-y-6">
              {/* Property Info */}
              <div>
                <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
                  Property Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-body-color">
                      Purchase Price:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      ${formData.purchasePrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">
                      Rehab Budget:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      ${formData.rehab.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">Square Feet:</span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {formData.squareFeet.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">$/SF:</span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      ${calculations.renovationDollarPerSf.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Loan Terms */}
              <div>
                <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
                  Loan Terms
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-body-color">
                      Loan Amount:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      ${calculations.totalLoanAmount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">
                      Interest Rate:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {formData.interestRate}%
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">Term:</span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {formData.months} months
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">
                      Total Interest:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      ${calculations.totalInterest.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div>
                <h3 className="mb-2 text-lg font-semibold text-dark dark:text-white">
                  Key Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-body-color">
                      Loan-to-Cost:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {calculations.loanToCost.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">
                      Loan-to-As-Is:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {calculations.loanToAsIsValue.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">
                      Stress Test L-ARV:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {calculations.stressTestedLArv.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-sm text-body-color">
                      Loan Underwater Day 1:
                    </span>
                    <span className="ml-2 font-medium text-dark dark:text-white">
                      {calculations.isLoanUnderwater ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
