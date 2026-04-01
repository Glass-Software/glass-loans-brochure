"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Report {
  id: number;
  reportId: string | null;
  propertyAddress: string;
  propertyCity: string | null;
  propertyState: string | null;
  finalScore: number | null;
  estimatedArv: number | null;
  purchasePrice: number;
  createdAt: Date;
  expiresAt: Date | null;
}

interface ReportsListProps {
  reports: Report[];
  userTier: string;
}

export default function ReportsList({ reports, userTier }: ReportsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);

  const isPro = userTier === "pro";

  // Handle PDF export
  async function handleExportPDF(reportId: string) {
    try {
      setExportingReportId(reportId);

      const response = await fetch(`/api/underwrite/export-pdf/${reportId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to export PDF");
      }

      // Create blob from response
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `GlassLoans_Report_${reportId}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert(error instanceof Error ? error.message : "Failed to export PDF");
    } finally {
      setExportingReportId(null);
    }
  }

  // Filter and sort reports
  const filteredAndSortedReports = useMemo(() => {
    let filtered = reports;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = reports.filter(
        (report) =>
          report.propertyAddress.toLowerCase().includes(query) ||
          report.propertyCity?.toLowerCase().includes(query) ||
          report.propertyState?.toLowerCase().includes(query)
      );
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        // Sort by score (nulls last)
        if (a.finalScore === null) return 1;
        if (b.finalScore === null) return -1;
        return b.finalScore - a.finalScore;
      }
    });

    return sorted;
  }, [reports, searchQuery, sortBy]);

  // Check if report is expired
  function isExpired(report: Report): boolean {
    if (!report.expiresAt || isPro) return false;
    return new Date(report.expiresAt) < new Date();
  }

  // Format currency
  function formatCurrency(value: number | null): string {
    if (value === null) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <div className="shadow-three rounded-lg border border-stroke bg-white p-6 dark:border-white/10 dark:bg-black/40">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-black dark:text-white">
          Your Reports
        </h2>
        <p className="mt-1 text-sm text-body-color dark:text-body-color-dark">
          {reports.length} {reports.length === 1 ? "report" : "reports"} total
        </p>
      </div>

      {/* Search and Sort Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by address, city, or state..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-stroke bg-white px-4 py-2 pl-10 text-sm text-body-color placeholder-body-color/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-dark dark:bg-dark dark:text-white dark:placeholder-white/40"
          />
          <svg
            className="absolute left-3 top-2.5 h-5 w-5 text-body-color/50 dark:text-body-color-dark/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-body-color dark:text-body-color-dark">
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "score")}
            className="rounded-md border border-stroke bg-white px-3 py-2 text-sm text-body-color focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-dark dark:bg-dark dark:text-white"
          >
            <option value="date">Date</option>
            <option value="score">Score</option>
          </select>
        </div>
      </div>

      {/* Reports Grid */}
      {filteredAndSortedReports.length === 0 ? (
        <div className="py-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-body-color/50 dark:text-body-color-dark/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-black dark:text-white">
            {searchQuery ? "No reports found" : "No reports yet"}
          </h3>
          <p className="mt-1 text-sm text-body-color dark:text-body-color-dark">
            {searchQuery
              ? "Try adjusting your search query"
              : "Get started by creating your first underwriting report"}
          </p>
          {!searchQuery && (
            <div className="mt-6">
              <Link
                href="/underwrite"
                className="shadow-submit dark:shadow-submit-dark inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
              >
                <svg
                  className="mr-2 h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Report
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedReports.map((report) => {
            const expired = isExpired(report);
            const reportUrl = report.reportId
              ? `/underwrite/results/${report.reportId}`
              : null;

            return (
              <div
                key={report.id}
                className={`rounded-lg border p-4 transition-colors ${
                  expired
                    ? "border-stroke bg-gray-50 dark:border-white/5 dark:bg-white/5"
                    : "border-stroke bg-white hover:border-primary/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {reportUrl ? (
                        <Link
                          href={reportUrl}
                          className="text-lg font-medium text-black hover:text-primary dark:text-white dark:hover:text-primary"
                        >
                          {report.propertyAddress}
                        </Link>
                      ) : (
                        <h3 className="text-lg font-medium text-black dark:text-white">
                          {report.propertyAddress}
                        </h3>
                      )}
                      {expired && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-400">
                          Expired
                        </span>
                      )}
                    </div>
                    {(report.propertyCity || report.propertyState) && (
                      <p className="mt-1 text-sm text-body-color dark:text-body-color-dark">
                        {[report.propertyCity, report.propertyState]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      {report.finalScore !== null && (
                        <div className="flex items-center gap-1">
                          <span className="text-body-color dark:text-body-color-dark">Score:</span>
                          <span
                            className={`font-semibold ${
                              report.finalScore >= 70
                                ? "text-green-600 dark:text-green-400"
                                : report.finalScore >= 50
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {report.finalScore}/100
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-body-color dark:text-body-color-dark">Purchase:</span>
                        <span className="font-medium text-black dark:text-white">
                          {formatCurrency(report.purchasePrice)}
                        </span>
                      </div>
                      {report.estimatedArv && (
                        <div className="flex items-center gap-1">
                          <span className="text-body-color dark:text-body-color-dark">ARV:</span>
                          <span className="font-medium text-black dark:text-white">
                            {formatCurrency(report.estimatedArv)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-2">
                    <span className="text-sm text-body-color dark:text-body-color-dark">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                    {reportUrl && !expired && (
                      <div className="flex items-center gap-2">
                        {/* Export PDF Button (Pro only) */}
                        {isPro && (
                          <button
                            onClick={() => handleExportPDF(report.reportId!)}
                            disabled={exportingReportId === report.reportId}
                            className="shadow-submit dark:shadow-submit-dark rounded-md border border-stroke bg-white px-2 py-1 text-body-color transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 dark:border-stroke-dark dark:bg-gray-dark dark:text-body-color-dark dark:hover:border-primary dark:hover:text-primary"
                            title="Export as PDF"
                          >
                            {exportingReportId === report.reportId ? (
                              <svg
                                className="h-5 w-5 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            )}
                          </button>
                        )}

                        {/* View Report Button */}
                        <Link
                          href={reportUrl}
                          className="shadow-submit dark:shadow-submit-dark rounded-md bg-primary px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-primary/90"
                        >
                          View Report
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
