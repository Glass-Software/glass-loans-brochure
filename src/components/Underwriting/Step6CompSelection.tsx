"use client";

import { useEffect, useRef, useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { useModal } from "@/context/ModalContext";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { PropertyComparable } from "@/types/underwriting";
import CompCardSquare from "./CompCardSquare";
import SortDropdown, { SortOption } from "./SortDropdown";
import ResizablePanel from "./ResizablePanel";
import { formatPricePerSqft } from "@/lib/underwriting/calculations";

interface Step6CompSelectionProps {
  error?: string;
}

/**
 * Step 6: Zillow-style Comparable Properties Selection
 *
 * Features:
 * - Desktop: Large map + resizable drawer with comp cards
 * - Mobile: Toggle between map and list views
 * - Sorting: 9 sort options (distance, price, sqft, year, $/sqft)
 * - Map interaction: Click marker → scroll to comp and highlight
 *
 * Demo Mode:
 * - Add ?demo=true to URL to load test data from "514 Betty Lou Drive"
 * - Example: http://localhost:3000/underwrite?demo=true
 * - Navigate to Step 6 to see the Zillow-style UI with real comp data
 */
export default function Step6CompSelection({
  error,
}: Step6CompSelectionProps = {}) {
  const {
    propertyComps,
    compSelectionState,
    updateCompSelection,
    getActiveCompsCount,
    formData,
    updateFormData,
    setIsProcessing,
    setProgressStatus,
    setProgressPercent,
    setProgressStep,
    setResults,
    setError,
    email,
    setEmail,
    setPropertyComps,
    setCompSelectionState,
    isDemoMode,
    setIsDemoMode,
    cachedGaryData,
  } = useUnderwriting();

  const { openUpgradeModal } = useModal();

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const compMarkersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const compCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [highlightedCompIndex, setHighlightedCompIndex] = useState<
    number | null
  >(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [selectedCompForModal, setSelectedCompForModal] = useState<
    number | null
  >(null);

  // Check for demo mode from URL on mount (if not already set in context)
  useEffect(() => {
    if (!isDemoMode) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("demo") === "true") {
        setIsDemoMode(true);
      }
    }
  }, [isDemoMode, setIsDemoMode]);

  // Load demo data from existing submission
  const loadDemoData = async () => {
    setIsProcessing(true);
    setProgressStep(1);
    setProgressStatus("Loading demo data...");
    setProgressPercent(30);

    try {
      const response = await fetch("/api/underwrite/demo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "hervey711@gmail.com",
          propertyAddress: "514 betty lou",
          // Optional: add demoKey if needed in production
          // demoKey: "your-demo-key-here"
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

      setProgressStatus("Setting up demo...");
      setProgressPercent(80);

      // Update context with demo data
      setPropertyComps(demoData.propertyComps);
      setCompSelectionState(demoData.compSelectionState);
      setEmail("hervey711@gmail.com"); // Set email for submission
      setIsDemoMode(true); // Enable demo mode to skip usage checks

      // Also update formData if needed
      Object.entries(demoData.formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          updateFormData({ [key]: value });
        }
      });

      setProgressPercent(100);
      setProgressStatus("Demo loaded!");

      console.log("✅ Demo mode: Loaded data from 514 Betty Lou Drive");
    } catch (error: any) {
      console.error("Demo data error:", error);
      setError(
        error.message ||
          "Failed to load demo data. Please try without demo mode.",
      );
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgressStep(0);
        setProgressStatus("");
        setProgressPercent(0);
      }, 1000);
    }
  };

  // Fetch comps when component mounts (if not already loaded)
  useEffect(() => {
    if (propertyComps) return; // Already loaded

    // If demo mode, load demo data instead
    if (isDemoMode) {
      loadDemoData();
      return;
    }

    const fetchCompsWithRetry = async (attempt = 1, maxAttempts = 3) => {
      setIsProcessing(true);
      setProgressStep(1);

      const attemptText =
        attempt > 1 ? ` (attempt ${attempt}/${maxAttempts})` : "";
      setProgressStatus(`Fetching comparable properties${attemptText}...`);
      setProgressPercent(30);

      try {
        // Add 60 second timeout for comp fetching
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const compsResponse = await fetch("/api/underwrite/fetch-comps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ formData, email }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!compsResponse.ok) {
          const errorData = await compsResponse.json();
          throw new Error(errorData.error || "Failed to fetch comps");
        }

        const compsData = await compsResponse.json();

        if (!compsData.success || !compsData.propertyComps) {
          throw new Error("No comps data received");
        }

        setProgressStatus("Loading comp selection...");
        setProgressPercent(80);

        // Store comps in context
        setPropertyComps(compsData.propertyComps);

        // Initialize selection state (all normal by default)
        const initialState = compsData.propertyComps.compsUsed.map(
          (_: any, idx: number) => ({
            compIndex: idx,
            emphasized: false,
            removed: false,
          }),
        );
        setCompSelectionState(initialState);

        setProgressPercent(100);
        setProgressStatus("Complete!");
      } catch (error: any) {
        console.error(`Fetch comps error (attempt ${attempt}):`, error);

        // Retry logic for timeout/network errors
        const isRetryable =
          error.name === "AbortError" ||
          error.message.includes("timeout") ||
          error.message.includes("network");

        if (isRetryable && attempt < maxAttempts) {
          // Exponential backoff: 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          setProgressStatus(`Retrying in ${delay / 1000}s...`);

          await new Promise((resolve) => setTimeout(resolve, delay));
          return fetchCompsWithRetry(attempt + 1, maxAttempts);
        }

        // Final failure
        setError(
          error.message ||
            "Failed to fetch comparable properties. Please try refreshing the page.",
        );
      } finally {
        setIsProcessing(false);
        // Reset progress
        setTimeout(() => {
          setProgressStep(0);
          setProgressStatus("");
          setProgressPercent(0);
        }, 1000);
      }
    };

    fetchCompsWithRetry();
  }, [
    propertyComps,
    formData,
    email,
    isDemoMode,
    setPropertyComps,
    setCompSelectionState,
    setIsProcessing,
    setProgressStep,
    setProgressStatus,
    setProgressPercent,
    setError,
  ]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || !propertyComps || mapRef.current) return;

    if (!process.env.NEXT_PUBLIC_MAPBOX_API_KEY) {
      console.warn("Mapbox API key not configured");
      return;
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    // Use subject property coordinates from propertyComps (more reliable than formData)
    const centerLng =
      propertyComps.subjectLongitude || formData.propertyLongitude || -86.7816;
    const centerLat =
      propertyComps.subjectLatitude || formData.propertyLatitude || 36.1627;

    console.log("🗺️ Initializing map at:", { centerLat, centerLng });
    console.log("🗺️ Map container dimensions:", {
      width: mapContainer.current.offsetWidth,
      height: mapContainer.current.offsetHeight,
    });

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [centerLng, centerLat],
      zoom: 12,
    });

    map.on("load", () => {
      console.log("🗺️ Map loaded successfully");
      // Force resize to ensure map fills container properly
      map.resize();
    });

    map.on("error", (e) => {
      console.error("🗺️ Map error:", e);
    });

    mapRef.current = map;

    // Force an initial resize after a short delay to ensure container has dimensions
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.resize();
        console.log("🗺️ Map resized");
      }
    }, 100);

    // Add subject property marker (red/orange star to stand out)
    const subjectLat =
      propertyComps.subjectLatitude || formData.propertyLatitude;
    const subjectLng =
      propertyComps.subjectLongitude || formData.propertyLongitude;

    if (subjectLat && subjectLng) {
      const subjectMarker = new mapboxgl.Marker({ color: "#FF6B35" }) // Bright orange-red
        .setLngLat([subjectLng, subjectLat])
        .addTo(map);

      markersRef.current.push(subjectMarker);
    }

    // Add comp markers with click handlers (no popups)
    propertyComps.compsUsed.forEach((comp, idx) => {
      if (!comp.latitude || !comp.longitude) return;

      const state = compSelectionState.find((s) => s.compIndex === idx);
      const color = state?.removed
        ? "#9CA3AF"
        : state?.emphasized
          ? "#10B981"
          : "#4A6CF7";

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([comp.longitude, comp.latitude])
        .addTo(map);

      // Make marker clickable - show modal on mobile, scroll to comp on desktop
      marker.getElement().style.cursor = "pointer";
      marker.getElement().addEventListener("click", (e) => {
        // Prevent event bubbling
        e.stopPropagation();

        // On mobile, show modal; on desktop, scroll to comp
        if (window.innerWidth < 1024) {
          setSelectedCompForModal(idx);

          // Animate the marker
          const svg = marker.getElement().querySelector("svg");
          if (svg) {
            svg.style.transition = "transform 150ms ease-out";
            svg.style.transform = "scale(1.2) translateY(-10px)";
            setTimeout(() => {
              svg.style.transform = "scale(1) translateY(0)";
            }, 150);
            setTimeout(() => {
              svg.style.transition = "";
              svg.style.transform = "";
            }, 300);
          }
        } else {
          handleMarkerClick(idx);
        }
      });

      markersRef.current.push(marker);
      compMarkersRef.current.set(idx, marker);
    });

    // Cleanup on unmount only
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      compMarkersRef.current.clear();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [propertyComps, formData]); // Removed compSelectionState - map should only initialize once

  // Resize map when switching to map view on mobile
  useEffect(() => {
    if (mobileView === "map" && mapRef.current) {
      // Small delay to ensure the container is visible and has dimensions
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.resize();
          console.log("🗺️ Map resized after mobile view switch");
        }
      }, 100);
    }
  }, [mobileView]);

  // Update marker colors when selection state changes
  useEffect(() => {
    if (!mapRef.current || !propertyComps) return;

    // Update existing markers instead of recreating them
    propertyComps.compsUsed.forEach((comp, idx) => {
      const marker = compMarkersRef.current.get(idx);
      if (!marker || !comp.latitude || !comp.longitude) return;

      const state = compSelectionState.find((s) => s.compIndex === idx);
      const color = state?.removed
        ? "#9CA3AF"
        : state?.emphasized
          ? "#10B981"
          : "#4A6CF7";

      // Update marker color by replacing the marker element
      const element = marker.getElement();
      const svg = element.querySelector("svg");
      if (svg) {
        const path = svg.querySelector("path");
        if (path) {
          path.setAttribute("fill", color);
        }
      }
    });
  }, [compSelectionState, propertyComps]);

  // Handle marker click - scroll to comp and highlight
  const handleMarkerClick = (compIndex: number) => {
    // Scroll to comp card
    const element = compCardRefs.current.get(compIndex);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight temporarily
      setHighlightedCompIndex(compIndex);
      setTimeout(() => setHighlightedCompIndex(null), 2000);
    }
  };

  // Animate marker for a given comp index
  const animateMarker = (compIndex: number) => {
    const marker = markersRef.current[compIndex + 1]; // +1 because index 0 is subject property
    if (marker) {
      const element = marker.getElement();
      const svg = element.querySelector("svg");

      if (svg) {
        // Apply snappy scale + bounce animation to SVG only
        svg.style.transition = "transform 150ms ease-out";
        svg.style.transform = "scale(1.2) translateY(-10px)";

        // Return to normal
        setTimeout(() => {
          svg.style.transform = "scale(1) translateY(0)";
        }, 150);

        // Clear inline styles after animation completes
        setTimeout(() => {
          svg.style.transition = "";
          svg.style.transform = "";
        }, 300);
      }
    }
  };

  // Handle comp card click - animate the marker and show modal on mobile map view
  const handleCompCardClick = (compIndex: number) => {
    if (!mapRef.current) return;

    const comp = propertyComps.compsUsed[compIndex];
    if (comp && comp.latitude && comp.longitude) {
      // On mobile map view, open modal
      if (window.innerWidth < 1024 && mobileView === "map") {
        setSelectedCompForModal(compIndex);
      }

      // Animate marker on all resolutions
      const marker = markersRef.current[compIndex + 1]; // +1 because index 0 is subject property
      if (marker) {
        const element = marker.getElement();
        const svg = element.querySelector("svg");

        if (svg) {
          // Apply snappy scale + bounce animation to SVG only
          svg.style.transition = "transform 150ms ease-out";
          svg.style.transform = "scale(1.2) translateY(-10px)";

          // Return to normal
          setTimeout(() => {
            svg.style.transform = "scale(1) translateY(0)";
          }, 150);

          // Clear inline styles after animation completes
          setTimeout(() => {
            svg.style.transition = "";
            svg.style.transform = "";
          }, 300);
        }
      }
    }
  };

  // Sort comps based on selected option
  const sortComps = (
    comps: PropertyComparable[],
    sortOption: SortOption,
  ): PropertyComparable[] => {
    const sorted = [...comps];
    switch (sortOption) {
      case "price-high":
        return sorted.sort((a, b) => b.price - a.price);
      case "price-low":
        return sorted.sort((a, b) => a.price - b.price);
      case "sqft-high":
        return sorted.sort((a, b) => b.sqft - a.sqft);
      case "sqft-low":
        return sorted.sort((a, b) => a.sqft - b.sqft);
      case "year-new":
        return sorted.sort((a, b) => (b.yearBuilt || 0) - (a.yearBuilt || 0));
      case "year-old":
        return sorted.sort((a, b) => (a.yearBuilt || 0) - (b.yearBuilt || 0));
      case "psf-high":
        return sorted.sort((a, b) => b.price / b.sqft - a.price / a.sqft);
      case "psf-low":
        return sorted.sort((a, b) => a.price / a.sqft - b.price / b.sqft);
      case "distance":
      default:
        // Already sorted by distance from API
        return comps;
    }
  };

  const handleSubmit = async () => {
    if (!propertyComps || !email) {
      setError("Missing required data. Please try again.");
      return;
    }

    // Validate minimum comps
    const activeCount = getActiveCompsCount();
    if (activeCount < 3) {
      setError(
        "At least 3 comps must be selected. Please adjust your selections.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setIsProcessing(true);
    setProgressStep(1);
    setProgressStatus("Generating your report...");
    setProgressPercent(0);

    try {
      // Get reCAPTCHA token (skip if not configured)
      let recaptchaToken = null;
      if (
        typeof window !== "undefined" &&
        window.grecaptcha &&
        process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
      ) {
        try {
          recaptchaToken = await new Promise<string>((resolve, reject) => {
            window.grecaptcha.ready(() => {
              window.grecaptcha
                .execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!, {
                  action: "submit_underwriting",
                })
                .then(resolve)
                .catch(reject);
            });
          });
        } catch (error) {
          console.warn(
            "reCAPTCHA execution failed, continuing without it:",
            error,
          );
        }
      }

      // Submit with comp selection (email was already verified in Step 5)
      const response = await fetch("/api/underwrite/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          recaptchaToken,
          formData,
          propertyComps,
          compSelectionState,
          isDemoMode, // Pass demo mode flag to skip usage checks
          cachedGaryData, // Pass cached Gary data to skip OpenRouter calls in demo mode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "progress") {
                setProgressStep(data.step);
                setProgressStatus(data.status);
                setProgressPercent(data.progress);
              } else if (data.type === "complete") {
                // Redirect to results page with reportId
                if (data.data?.reportId) {
                  window.location.href = `/underwrite/results/${data.data.reportId}?verified=1`;
                } else {
                  // Fallback: set results if full data was returned (shouldn't happen)
                  setResults(data.data);
                  setIsProcessing(false);
                }
                return;
              } else if (data.type === "error") {
                // Check if this is a usage limit error
                if (data.data?.code === "USAGE_LIMIT") {
                  // Open upgrade modal instead of showing error
                  openUpgradeModal();
                  setIsProcessing(false);
                  setIsSubmitting(false);
                  return;
                }
                throw new Error(data.status);
              }
            } catch (parseError) {
              console.error("Failed to parse progress event:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      setError(error instanceof Error ? error.message : "Failed to submit");
      setIsProcessing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!propertyComps) {
    return (
      <div className="text-center">
        <p className="text-body-color dark:text-body-color-dark">
          Loading comparable properties...
        </p>
      </div>
    );
  }

  const activeCount = getActiveCompsCount();

  // Get sorted comps with original indices
  const sortedCompsWithIndices = sortComps(propertyComps.compsUsed, sortBy).map(
    (comp) => {
      const originalIndex = propertyComps.compsUsed.indexOf(comp);
      return { comp, originalIndex };
    },
  );

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 72px)" }}>
      {/* Mobile Toggle - Only visible on mobile */}
      <div className="flex-shrink-0 border-b border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark lg:hidden">
        <div className="flex">
          <button
            onClick={() => setMobileView("list")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mobileView === "list"
                ? "border-b-2 border-primary text-primary"
                : "text-body-color dark:text-body-color-dark"
            }`}
          >
            List ({propertyComps.compsUsed.length})
          </button>
          <button
            onClick={() => setMobileView("map")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mobileView === "map"
                ? "border-b-2 border-primary text-primary"
                : "text-body-color dark:text-body-color-dark"
            }`}
          >
            Map
          </button>
        </div>
      </div>

      {/* Map + Drawer Layout - Full Height */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* Map - Full Width with Overlay Header */}
        <div
          className={`relative flex-1 ${
            mobileView === "list" ? "hidden lg:block" : "block"
          }`}
        >
          {/* Minimal Overlay - Property Address Only */}
          <div className="absolute left-2 top-2 z-10 rounded-sm bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-sm dark:bg-gray-dark/95 lg:left-4 lg:top-4 lg:px-3 lg:py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-body-color/60 dark:text-body-color-dark/60 lg:text-[10px]">
              Subject Property
            </p>
            <h3 className="text-xs font-semibold text-dark dark:text-white lg:text-sm">
              {formData.propertyAddress || "Property Address Not Available"}
            </h3>
          </div>

          {/* Map */}
          <div
            ref={mapContainer}
            className="border-stroke h-full w-full rounded-l-sm border dark:border-stroke-dark"
            style={{ minHeight: "500px" }}
          />
        </div>

        {/* Resizable Drawer with Comps */}
        <div
          className={`${
            mobileView === "list" ? "flex" : "hidden"
          } h-full w-full lg:flex lg:w-auto`}
        >
          <ResizablePanel
            minWidth={400}
            maxWidth={1200}
            defaultWidth={800}
            onResize={() => {
              // Trigger map resize when drawer width changes
              if (mapRef.current) {
                mapRef.current.resize();
              }
            }}
          >
          <div className="flex h-full flex-col">
            {/* Conditional Alerts Section - Fixed at Top */}
            <div className="flex-shrink-0">
              {/* Error Display */}
              {error && (
                <div className="mb-2 rounded-sm bg-red-50 p-2 dark:bg-red-900/20">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Demo Mode Indicator */}
              {isDemoMode && (
                <div className="mb-2 rounded-sm border-l-4 border-warning bg-warning/10 p-2">
                  <p className="text-xs font-semibold text-warning">
                    🎨 Demo Mode: Showing data from 514 Betty Lou Drive
                  </p>
                </div>
              )}

              {/* Instructions */}
              <div className="border-stroke mb-2 rounded-r-sm border border-l-0 bg-gray-light/50 p-2 dark:border-stroke-dark dark:bg-gray-dark/50">
                <h4 className="mb-1 text-base font-semibold text-dark dark:text-white lg:text-lg">
                  Review {propertyComps.compsUsed.length} Comparable Properties
                </h4>
                <p className="mb-1 text-sm text-body-color dark:text-body-color-dark lg:text-base">
                  <strong>Emphasize</strong> similar properties •{" "}
                  <strong>Remove</strong> non-comparable
                </p>
              </div>

              {/* Sort Dropdown + Comp Count */}
              <div className="border-stroke mb-2 rounded-r-sm border border-l-0 bg-white p-2 dark:border-stroke-dark dark:bg-gray-dark">
                <SortDropdown value={sortBy} onChange={setSortBy} />
                <p className="mt-1 text-xs font-medium text-primary dark:text-primary">
                  {activeCount} of {propertyComps.compsUsed.length} selected
                  {activeCount < 3 && (
                    <span className="ml-1 text-danger">
                      (minimum 3 required)
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Comp Cards Grid - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              <div className="@[500px]:grid-cols-2 @[900px]:grid-cols-3 grid grid-cols-1 gap-3 pb-4 pl-1 pr-2 pt-2">
                {sortedCompsWithIndices.map(({ comp, originalIndex }) => (
                  <CompCardSquare
                    key={originalIndex}
                    comp={comp}
                    index={originalIndex}
                    state={compSelectionState.find(
                      (s) => s.compIndex === originalIndex,
                    )}
                    onUpdate={(updates) =>
                      updateCompSelection(originalIndex, updates)
                    }
                    disableRemove={activeCount <= 3}
                    isHighlighted={highlightedCompIndex === originalIndex}
                    compRef={(el) => {
                      if (el) {
                        compCardRefs.current.set(originalIndex, el);
                      }
                    }}
                    onCardClick={() => handleCompCardClick(originalIndex)}
                    onCategorize={() => animateMarker(originalIndex)}
                  />
                ))}
              </div>
            </div>
          </div>
        </ResizablePanel>
        </div>
      </div>

      {/* Submit Buttons with Disclaimer - Fixed Footer */}
      <div className="border-stroke flex-shrink-0 border-t bg-white dark:border-stroke-dark dark:bg-gray-dark">
        <div className="container max-w-screen-2xl px-4 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="border-stroke rounded-sm border px-3 py-1.5 text-sm font-medium text-body-color hover:bg-gray-light dark:border-stroke-dark dark:hover:bg-gray-dark"
            >
              Back
            </button>

            {/* Disclaimer - Abbreviated */}
            <p className="hidden flex-1 px-2 text-center text-[10px] leading-tight text-body-color/80 dark:text-body-color-dark/80 lg:block">
              Informational only • No liability • Users assume full responsibility
            </p>

            {/* Mobile info icon with title tooltip */}
            <div
              className="flex-1 text-center lg:hidden"
              title="This AI analysis is for informational purposes only. Glass Loans assumes no liability for lending decisions made based on this tool. Users accept full responsibility for their investment decisions."
            >
              <span className="text-[10px] text-body-color/60 dark:text-body-color-dark/60">
                ⓘ Informational only
              </span>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || activeCount < 3}
              className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-white transition duration-300 ease-in-out hover:bg-primary/90 hover:shadow-submit disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Comp Modal - Shows comp details over map */}
      {selectedCompForModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:hidden"
          onClick={() => setSelectedCompForModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-lg bg-white p-4 shadow-xl dark:bg-gray-dark"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedCompForModal(null)}
              className="absolute right-4 top-4 text-2xl text-body-color hover:text-dark dark:text-body-color-dark dark:hover:text-white"
            >
              ×
            </button>

            {/* Comp details */}
            {(() => {
              const comp = propertyComps.compsUsed[selectedCompForModal];
              const state = compSelectionState.find(
                (s) => s.compIndex === selectedCompForModal,
              );
              const isEmphasized = state?.emphasized || false;
              const isRemoved = state?.removed || false;
              const isNormal = !isEmphasized && !isRemoved;

              return (
                <div>
                  <h4 className="mb-3 pr-8 text-sm font-semibold text-dark dark:text-white">
                    <a
                      href={
                        comp.listingUrl ||
                        `https://www.google.com/search?q=${encodeURIComponent(comp.address)}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary hover:underline"
                    >
                      {comp.address}
                    </a>
                  </h4>

                  {/* Price */}
                  <div className="mb-3">
                    <span className="text-2xl font-bold text-primary">
                      ${comp.price.toLocaleString()}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="mb-4 space-y-2 text-sm text-body-color dark:text-body-color-dark">
                    <div className="flex justify-between">
                      <span className="font-medium">$/sqft:</span>
                      <span>
                        ${formatPricePerSqft(comp.price, comp.sqft)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Size:</span>
                      <span>{comp.sqft.toLocaleString()} sqft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Bed/Bath:</span>
                      <span>
                        {comp.bedrooms}/{comp.bathrooms}
                      </span>
                    </div>
                    {comp.distance && (
                      <div className="flex justify-between">
                        <span className="font-medium">Distance:</span>
                        <span>{comp.distance}</span>
                      </div>
                    )}
                    {comp.soldDate && (
                      <div className="flex justify-between">
                        <span className="font-medium">Sold:</span>
                        <span>{comp.soldDate}</span>
                      </div>
                    )}
                    {comp.yearBuilt && (
                      <div className="flex justify-between">
                        <span className="font-medium">Year:</span>
                        <span>{comp.yearBuilt}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateCompSelection(selectedCompForModal, {
                          emphasized: true,
                          removed: false,
                        });
                        setSelectedCompForModal(null);
                      }}
                      className={`flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                        isEmphasized
                          ? "bg-success text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {isEmphasized ? "✓ " : ""}Emphasize
                    </button>
                    <button
                      onClick={() => {
                        updateCompSelection(selectedCompForModal, {
                          emphasized: false,
                          removed: false,
                        });
                        setSelectedCompForModal(null);
                      }}
                      className={`flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                        isNormal
                          ? "bg-primary text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {isNormal ? "✓ " : ""}Normal
                    </button>
                    <button
                      onClick={() => {
                        updateCompSelection(selectedCompForModal, {
                          emphasized: false,
                          removed: true,
                        });
                        setSelectedCompForModal(null);
                      }}
                      disabled={activeCount <= 3 && !isRemoved}
                      className={`flex-1 rounded-sm px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isRemoved
                          ? "bg-gray-500 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {isRemoved ? "✓ " : ""}Remove
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
