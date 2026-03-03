import { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyUserEmail } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Email Verification | Glass Loans",
  description: "Verify your email to view underwriting results",
};

interface VerifyPageProps {
  searchParams: Promise<{
    token?: string;
    submission?: string;
    report?: string;
  }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { token, submission: submissionId, report: reportId } = await searchParams;

  if (!token) {
    return (
      <section className="overflow-hidden py-16 md:py-20 lg:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="rounded-sm bg-white p-12 shadow-three dark:bg-gray-dark">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg
                  className="h-8 w-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h1 className="mb-4 text-2xl font-bold text-dark dark:text-white">
                Invalid Verification Link
              </h1>
              <p className="mb-6 text-body-color">
                This verification link is missing required information.
              </p>
              <a
                href="/underwrite"
                className="inline-block rounded-sm bg-primary px-8 py-3 text-base font-medium text-white hover:bg-primary/90"
              >
                Start New Underwriting
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Verify the token
  const user = await verifyUserEmail(token);

  if (!user) {
    return (
      <section className="overflow-hidden py-16 md:py-20 lg:py-28">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="rounded-sm bg-white p-12 shadow-three dark:bg-gray-dark">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg
                  className="h-8 w-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="mb-4 text-2xl font-bold text-dark dark:text-white">
                Verification Link Expired
              </h1>
              <p className="mb-6 text-body-color">
                This verification link has expired or is invalid. Verification
                links are valid for 24 hours.
              </p>
              <a
                href="/underwrite"
                className="inline-block rounded-sm bg-primary px-8 py-3 text-base font-medium text-white hover:bg-primary/90"
              >
                Request New Link
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Success! If there's a report ID or submission ID, redirect to results page
  // Otherwise redirect to underwrite form
  if (reportId) {
    redirect(`/underwrite/results/${reportId}?verified=true`);
  } else if (submissionId) {
    // Backward compatibility for old verification links
    redirect(`/underwrite/results/${submissionId}?verified=true`);
  } else {
    redirect(`/underwrite?email=${encodeURIComponent(user.email)}&verified=true`);
  }
}
