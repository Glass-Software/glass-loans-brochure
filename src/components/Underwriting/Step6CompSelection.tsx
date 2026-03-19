"use client";

import { useEffect, useRef, useState } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { formatPricePerSqft } from "@/lib/underwriting/calculations";
import type { PropertyComparable } from "@/types/underwriting";

export default function Step6CompSelection() {
  const {
    propertyComps,
    compSelectionState,
    updateCompSelection,
    getActiveCompsCount,
    formData,
    setIsProcessing,
    setProgressStatus,
    setProgressPercent,
    setProgressStep,
    setResults,
    setError,
    email,
  } = useUnderwriting();

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expose comp update function to window for map marker clicks
  useEffect(() => {
    (window as any).updateCompFromMap = (compIndex: number, action: string) => {
      const activeCount = getActiveCompsCount();
      const currentState = compSelectionState.find((s) => s.compIndex === compIndex);
      const isCurrentlyRemoved = currentState?.removed || false;

      // Prevent removing if at minimum (3 comps)
      if (action === 'remove' && activeCount <= 3 && !isCurrentlyRemoved) {
        setError("Cannot remove comp - minimum 3 required");
        setTimeout(() => setError(null), 3000);
        return;
      }

      // Update comp selection state
      if (action === 'emphasize') {
        updateCompSelection(compIndex, { emphasized: true, removed: false });
      } else if (action === 'normal') {
        updateCompSelection(compIndex, { emphasized: false, removed: false });
      } else if (action === 'remove') {
        updateCompSelection(compIndex, { emphasized: false, removed: true });
      }
    };

    return () => {
      delete (window as any).updateCompFromMap;
    };
  }, [compSelectionState, getActiveCompsCount, updateCompSelection, setError]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || !propertyComps || mapRef.current) return;

    if (!process.env.NEXT_PUBLIC_MAPBOX_API_KEY) {
      console.warn("Mapbox API key not configured");
      return;
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [
        formData.propertyLongitude || -86.7816,
        formData.propertyLatitude || 36.1627,
      ],
      zoom: 12,
    });

    mapRef.current = map;

    // Add subject property marker (red/orange star to stand out)
    if (formData.propertyLatitude && formData.propertyLongitude) {
      const subjectMarker = new mapboxgl.Marker({ color: "#FF6B35" }) // Bright orange-red
        .setLngLat([formData.propertyLongitude, formData.propertyLatitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2">
              <p class="font-semibold text-orange-600">📍 Subject Property</p>
              <p class="text-sm">${formData.propertyAddress || "Your Property"}</p>
            </div>`
          )
        )
        .addTo(map);

      markersRef.current.push(subjectMarker);
    }

    // Add comp markers with clickable popups
    propertyComps.compsUsed.forEach((comp, idx) => {
      if (!comp.latitude || !comp.longitude) return;

      const state = compSelectionState.find((s) => s.compIndex === idx);
      const color = state?.removed
        ? "#9CA3AF"
        : state?.emphasized
          ? "#10B981"
          : "#4A6CF7";

      const isEmphasized = state?.emphasized || false;
      const isRemoved = state?.removed || false;
      const isNormal = !isEmphasized && !isRemoved;

      // Create interactive popup with action buttons
      const popupHTML = `
        <div style="padding: 12px; min-width: 220px;">
          <a href="${comp.listingUrl || '#'}" target="_blank" rel="noopener noreferrer" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #2563eb; text-decoration: underline;">${comp.address}</a>
          <p style="font-size: 12px; margin-bottom: 4px; color: #374151;">$${comp.price.toLocaleString()} • $${formatPricePerSqft(comp.price, comp.sqft)}/sqft</p>
          <p style="font-size: 12px; margin-bottom: 12px; color: #6b7280;">${comp.bedrooms} bed • ${comp.bathrooms} bath • ${comp.sqft.toLocaleString()} sqft</p>
          <div class="flex gap-1">
            <button
              onclick="window.updateCompFromMap(${idx}, 'emphasize')"
              class="flex-1 px-2 py-1.5 text-xs rounded font-medium ${isEmphasized ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
            >
              ${isEmphasized ? '✓ ' : ''}Emphasize
            </button>
            <button
              onclick="window.updateCompFromMap(${idx}, 'normal')"
              class="flex-1 px-2 py-1.5 text-xs rounded font-medium ${isNormal ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
            >
              ${isNormal ? '✓ ' : ''}Normal
            </button>
            <button
              onclick="window.updateCompFromMap(${idx}, 'remove')"
              class="flex-1 px-2 py-1.5 text-xs rounded font-medium ${isRemoved ? 'bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
            >
              ${isRemoved ? '✓ ' : ''}Remove
            </button>
          </div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([comp.longitude, comp.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupHTML))
        .addTo(map);

      // Make marker clickable - open popup on click
      marker.getElement().style.cursor = 'pointer';

      markersRef.current.push(marker);
    });

    // Cleanup on unmount
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [propertyComps, formData, compSelectionState]);

  // Update marker colors when selection state changes
  useEffect(() => {
    if (!mapRef.current || !propertyComps) return;

    // Remove old markers (except first one which is subject property)
    markersRef.current.slice(1).forEach((marker) => marker.remove());
    markersRef.current = markersRef.current.slice(0, 1);

    // Re-add comp markers with updated colors and popups
    propertyComps.compsUsed.forEach((comp, idx) => {
      if (!comp.latitude || !comp.longitude) return;

      const state = compSelectionState.find((s) => s.compIndex === idx);
      const color = state?.removed
        ? "#9CA3AF"
        : state?.emphasized
          ? "#10B981"
          : "#4A6CF7";

      const isEmphasized = state?.emphasized || false;
      const isRemoved = state?.removed || false;
      const isNormal = !isEmphasized && !isRemoved;

      const popupHTML = `
        <div style="padding: 12px; min-width: 220px;">
          <a href="${comp.listingUrl || '#'}" target="_blank" rel="noopener noreferrer" style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px; color: #2563eb; text-decoration: underline;">${comp.address}</a>
          <p style="font-size: 12px; margin-bottom: 4px; color: #374151;">$${comp.price.toLocaleString()} • $${formatPricePerSqft(comp.price, comp.sqft)}/sqft</p>
          <p style="font-size: 12px; margin-bottom: 12px; color: #6b7280;">${comp.bedrooms} bed • ${comp.bathrooms} bath • ${comp.sqft.toLocaleString()} sqft</p>
          <div class="flex gap-1">
            <button
              onclick="window.updateCompFromMap(${idx}, 'emphasize')"
              class="flex-1 px-2 py-1.5 text-xs rounded font-medium ${isEmphasized ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
            >
              ${isEmphasized ? '✓ ' : ''}Emphasize
            </button>
            <button
              onclick="window.updateCompFromMap(${idx}, 'normal')"
              class="flex-1 px-2 py-1.5 text-xs rounded font-medium ${isNormal ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
            >
              ${isNormal ? '✓ ' : ''}Normal
            </button>
            <button
              onclick="window.updateCompFromMap(${idx}, 'remove')"
              class="flex-1 px-2 py-1.5 text-xs rounded font-medium ${isRemoved ? 'bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}"
            >
              ${isRemoved ? '✓ ' : ''}Remove
            </button>
          </div>
        </div>
      `;

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([comp.longitude, comp.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(popupHTML))
        .addTo(mapRef.current);

      marker.getElement().style.cursor = 'pointer';

      markersRef.current.push(marker);
    });
  }, [compSelectionState, propertyComps]);

  const handleSubmit = async () => {
    if (!propertyComps || !email) {
      setError("Missing required data. Please try again.");
      return;
    }

    // Validate minimum comps
    const activeCount = getActiveCompsCount();
    if (activeCount < 3) {
      setError("At least 3 comps must be selected. Please adjust your selections.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setIsProcessing(true);
    setProgressStep(1);
    setProgressStatus("Generating your report...");
    setProgressPercent(0);

    try {
      // Get reCAPTCHA token
      const recaptchaToken = await new Promise<string>((resolve, reject) => {
        if (typeof window !== "undefined" && window.grecaptcha) {
          window.grecaptcha.ready(() => {
            window.grecaptcha
              .execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!, {
                action: "submit_underwriting",
              })
              .then(resolve)
              .catch(reject);
          });
        } else {
          reject(new Error("reCAPTCHA not loaded"));
        }
      });

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

  // Sort comps by distance (closest first)
  const sortedCompsWithIndices = propertyComps.compsUsed
    .map((comp, originalIndex) => ({ comp, originalIndex }))
    .sort((a, b) => {
      // Extract numeric distance value for sorting
      const distanceA = a.comp.distance ? parseFloat(a.comp.distance) : Infinity;
      const distanceB = b.comp.distance ? parseFloat(b.comp.distance) : Infinity;
      return distanceA - distanceB;
    });

  return (
    <div>
      <h3 className="mb-4 text-xl font-semibold text-dark dark:text-white">
        Review & Select Comparable Properties
      </h3>

      <div className="mb-6 rounded-sm border-l-4 border-primary bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="mb-2 text-sm font-medium text-dark dark:text-white">
          Think about your property after renovation is complete.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-body-color dark:text-body-color-dark">
          <li>
            <strong>Emphasize</strong> comps that match your finished property
          </li>
          <li>
            <strong>Remove</strong> comps that aren&apos;t comparable
          </li>
          <li>
            Leave others as <strong>Normal</strong>
          </li>
        </ul>
      </div>

      <p className="mb-6 text-sm text-body-color dark:text-body-color-dark">
        Review {propertyComps.compsUsed.length} comparable properties found for{" "}
        {formData.propertyAddress}. At least 3 comps must remain active.
      </p>

      {/* Comp count indicator */}
      <div className="mb-6 rounded-sm bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
          {activeCount} of {propertyComps.compsUsed.length} comps selected
          {activeCount < 3 && (
            <span className="ml-2 text-danger">
              (minimum 3 required)
            </span>
          )}
        </p>
      </div>

      {/* Map */}
      <div
        ref={mapContainer}
        className="mb-6 h-96 w-full rounded-sm border border-stroke dark:border-stroke-dark"
      />

      {/* Generate Report Button (under map) */}
      <div className="mb-6 flex justify-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || activeCount < 3}
          className="rounded-sm bg-primary px-8 py-3 text-base font-medium text-white transition duration-300 ease-in-out hover:bg-primary/90 hover:shadow-submit disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Generating Report..." : "Generate Report"}
        </button>
      </div>

      {/* Comp Cards - Vertical List (sorted by distance) */}
      <div className="mb-8 space-y-4">
        {sortedCompsWithIndices.map(({ comp, originalIndex }) => (
          <CompCard
            key={originalIndex}
            comp={comp}
            index={originalIndex}
            state={compSelectionState.find((s) => s.compIndex === originalIndex)}
            onUpdate={(updates) => updateCompSelection(originalIndex, updates)}
            disableRemove={activeCount <= 3}
          />
        ))}
      </div>

      {/* Submit Button (bottom) */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-sm border border-stroke px-6 py-3 text-base font-medium text-body-color hover:bg-gray-light dark:border-stroke-dark dark:hover:bg-gray-dark"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || activeCount < 3}
          className="rounded-sm bg-primary px-6 py-3 text-base font-medium text-white transition duration-300 ease-in-out hover:bg-primary/90 hover:shadow-submit disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Generating Report..." : "Generate Report"}
        </button>
      </div>
    </div>
  );
}

interface CompCardProps {
  comp: PropertyComparable;
  index: number;
  state?: { emphasized: boolean; removed: boolean };
  onUpdate: (updates: { emphasized?: boolean; removed?: boolean }) => void;
  disableRemove: boolean;
}

function CompCard({ comp, index, state, onUpdate, disableRemove }: CompCardProps) {
  const isEmphasized = state?.emphasized || false;
  const isRemoved = state?.removed || false;
  const isNormal = !isEmphasized && !isRemoved;

  return (
    <div
      className={`rounded-sm border-l-4 p-4 transition-all ${
        isRemoved
          ? "border-gray-300 bg-gray-50 opacity-50 dark:border-gray-600 dark:bg-gray-800"
          : isEmphasized
            ? "border-success bg-success-light dark:border-success dark:bg-success/10"
            : "border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Comp Details */}
        <div className="flex-1">
          <h4 className="font-semibold mb-2">
            <a
              href={comp.listingUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark dark:text-white hover:text-primary dark:hover:text-primary hover:underline"
            >
              {comp.address}
            </a>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm text-body-color dark:text-body-color-dark">
            <div>
              <span className="font-medium">Price:</span> ${comp.price.toLocaleString()}
            </div>
            <div>
              <span className="font-medium">$/sqft:</span> $
              {formatPricePerSqft(comp.price, comp.sqft)}
            </div>
            <div>
              <span className="font-medium">Size:</span> {comp.sqft.toLocaleString()} sqft
            </div>
            <div>
              <span className="font-medium">Bed/Bath:</span> {comp.bedrooms}/{comp.bathrooms}
            </div>
            {comp.distance && (
              <div>
                <span className="font-medium">Distance:</span> {comp.distance}
              </div>
            )}
            {comp.soldDate && (
              <div>
                <span className="font-medium">Sold:</span> {comp.soldDate}
              </div>
            )}
            {comp.yearBuilt && (
              <div>
                <span className="font-medium">Year:</span> {comp.yearBuilt}
              </div>
            )}
          </div>
        </div>

        {/* Selection Buttons */}
        <div className="flex gap-2 sm:flex-shrink-0">
          <button
            onClick={() => onUpdate({ emphasized: true, removed: false })}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
              isEmphasized
                ? "bg-success text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {isEmphasized ? "✓ " : ""}Emphasize
          </button>
          <button
            onClick={() => onUpdate({ emphasized: false, removed: false })}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-sm transition-colors ${
              isNormal
                ? "bg-primary text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {isNormal ? "✓ " : ""}Normal
          </button>
          <button
            onClick={() => onUpdate({ emphasized: false, removed: true })}
            disabled={disableRemove && !isRemoved}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isRemoved
                ? "bg-gray-500 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {isRemoved ? "✓ " : ""}Remove
          </button>
        </div>
      </div>
    </div>
  );
}
