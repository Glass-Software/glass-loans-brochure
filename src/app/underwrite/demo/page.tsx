"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnderwriting } from "@/context/UnderwritingContext";

/**
 * Demo Page - Loads real data from database and jumps directly to Step 6
 *
 * Usage: Navigate to /underwrite/demo
 *
 * This page:
 * 1. Fetches real data from "514 Betty Lou Drive" submission via API
 * 2. Pre-fills all form data in context
 * 3. Loads real property comps from database
 * 4. Auto-advances to Step 6 (Comp Selection)
 */
export default function DemoPage() {
  const router = useRouter();
  const {
    updateFormData,
    setPropertyComps,
    setCompSelectionState,
    setCurrentStep,
  } = useUnderwriting();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDemoData = async () => {
      try {
        const response = await fetch("/api/underwrite/demo-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "hervey711@gmail.com",
            propertyAddress: "514 betty lou",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load demo data");
        }

        const demoData = await response.json();

        if (!demoData.success) {
          throw new Error("No demo data received");
        }

        // Load data into context
        updateFormData(demoData.formData);
        setPropertyComps(demoData.propertyComps);
        setCompSelectionState(demoData.compSelectionState);

        // Jump to Step 6
        setCurrentStep(6);

        console.log("✅ Demo mode: Loaded data from database for 514 Betty Lou Drive");
        console.log(`✅ Loaded ${demoData.propertyComps.compsUsed.length} comps`);

        // Navigate to underwrite page (which will show Step 6)
        setTimeout(() => {
          router.push("/underwrite");
        }, 100);
      } catch (error: any) {
        console.error("Demo data error:", error);
        setError(error.message || "Failed to load demo data");
      }
    };

    loadDemoData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <div className="mb-4 text-red-600 dark:text-red-400">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Failed to Load Demo
            </h2>
            <p className="mt-2 text-body-color dark:text-body-color-dark">
              {error}
            </p>
          </>
        ) : (
          <>
            <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <h2 className="text-xl font-semibold text-dark dark:text-white">
              Loading Demo...
            </h2>
            <p className="mt-2 text-body-color dark:text-body-color-dark">
              Fetching real data from 514 Betty Lou Drive
            </p>
          </>
        )}
      </div>
    </div>
  );
}
