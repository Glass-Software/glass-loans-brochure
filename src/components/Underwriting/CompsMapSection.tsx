"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { formatPricePerSqft } from "@/lib/underwriting/calculations";
import type { PropertyComparable, CompSelectionState } from "@/types/underwriting";

interface CompsMapSectionProps {
  propertyComps: {
    compsUsed: PropertyComparable[];
  };
  propertyCoordinates: {
    lat: number;
    lng: number;
  };
  propertyAddress: string;
  compSelectionState: CompSelectionState[];
}

export default function CompsMapSection({
  propertyComps,
  propertyCoordinates,
  propertyAddress,
  compSelectionState,
}: CompsMapSectionProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Filter out removed comps
  const activeComps = propertyComps.compsUsed.filter((_, idx) => {
    const state = compSelectionState.find((s) => s.compIndex === idx);
    return !state?.removed;
  });

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!process.env.NEXT_PUBLIC_MAPBOX_API_KEY) {
      console.warn("Mapbox API key not configured");
      return;
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_API_KEY;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [propertyCoordinates.lng, propertyCoordinates.lat],
      zoom: 12,
    });

    mapRef.current = map;

    // Add subject property marker (red/orange star to stand out)
    const subjectMarker = new mapboxgl.Marker({ color: "#FF6B35" }) // Bright orange-red
      .setLngLat([propertyCoordinates.lng, propertyCoordinates.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="p-2">
            <p class="font-semibold text-orange-600">📍 Subject Property</p>
            <p class="text-sm">${propertyAddress}</p>
          </div>`
        )
      )
      .addTo(map);

    markersRef.current.push(subjectMarker);

    // Add comp markers (only non-removed comps)
    propertyComps.compsUsed.forEach((comp, idx) => {
      if (!comp.latitude || !comp.longitude) return;

      const state = compSelectionState.find((s) => s.compIndex === idx);
      if (state?.removed) return; // Skip removed comps

      const color = state?.emphasized ? "#10B981" : "#4A6CF7";

      // Generate link: use listing URL if available, otherwise search Google
      const linkUrl = comp.listingUrl || `https://www.google.com/search?q=${encodeURIComponent(comp.address)}`;

      const marker = new mapboxgl.Marker({ color })
        .setLngLat([comp.longitude, comp.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div style="padding: 8px;">
              <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" style="display: block; font-weight: 600; margin-bottom: 4px; color: #2563eb; text-decoration: underline;">${comp.address}</a>
              <p style="font-size: 14px; color: #374151;">$${comp.price.toLocaleString()}</p>
              <p style="font-size: 14px; color: #374151;">${formatPricePerSqft(comp.price, comp.sqft)}/sqft</p>
              ${state?.emphasized ? '<p style="font-size: 12px; color: #10B981; font-weight: 500; margin-top: 4px;">Emphasized</p>' : ""}
            </div>`
          )
        )
        .addTo(map);

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
  }, [propertyComps, propertyCoordinates, propertyAddress, compSelectionState]);

  return (
    <div className="mb-8 rounded-sm bg-white p-8 shadow-three dark:bg-gray-dark">
      {/* Header */}
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-dark dark:text-white">
          Comparable Properties
        </h2>
        <p className="text-sm text-body-color dark:text-body-color-dark">
          {activeComps.length} comparable properties used in the analysis
        </p>
      </div>

      {/* Map */}
      <div
        ref={mapContainer}
        className="mb-6 h-96 w-full rounded-sm border border-stroke dark:border-stroke-dark"
      />

      {/* Comp Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {propertyComps.compsUsed.map((comp, idx) => {
          const state = compSelectionState.find((s) => s.compIndex === idx);
          if (state?.removed) return null; // Don't show removed comps

          return (
            <CompCard key={idx} comp={comp} state={state} />
          );
        })}
      </div>
    </div>
  );
}

interface CompCardProps {
  comp: PropertyComparable;
  state?: { emphasized: boolean; removed: boolean };
}

function CompCard({ comp, state }: CompCardProps) {
  const isEmphasized = state?.emphasized || false;

  // Generate link: use listing URL if available, otherwise search Google
  const linkUrl = comp.listingUrl || `https://www.google.com/search?q=${encodeURIComponent(comp.address)}`;

  return (
    <div
      className={`rounded-sm border-2 p-4 transition-all ${
        isEmphasized
          ? "border-success bg-success-light dark:border-success dark:bg-success/10"
          : "border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark"
      }`}
    >
      <div className="mb-3">
        <div className="mb-2 flex items-start justify-between">
          <h4 className="flex-1 font-semibold">
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark dark:text-white hover:text-primary dark:hover:text-primary hover:underline"
            >
              {comp.address}
            </a>
          </h4>
          {isEmphasized && (
            <span className="ml-2 rounded-sm bg-success px-2 py-1 text-xs font-medium text-white">
              Emphasized
            </span>
          )}
        </div>
        <div className="mt-2 space-y-1 text-sm text-body-color dark:text-body-color-dark">
          <div className="flex justify-between">
            <span className="font-medium">Price:</span>
            <span className="whitespace-nowrap">${comp.price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">$/sqft:</span>
            <span className="whitespace-nowrap">${formatPricePerSqft(comp.price, comp.sqft)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Size:</span>
            <span className="whitespace-nowrap">{comp.sqft.toLocaleString()} sqft</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Beds/Baths:</span>
            <span className="whitespace-nowrap">{comp.bedrooms} / {comp.bathrooms}</span>
          </div>
          {comp.yearBuilt && (
            <div className="flex justify-between">
              <span className="font-medium">Built:</span>
              <span className="whitespace-nowrap">{comp.yearBuilt}</span>
            </div>
          )}
          {comp.distance && (
            <div className="flex justify-between">
              <span className="font-medium">Distance:</span>
              <span className="whitespace-nowrap">{comp.distance}</span>
            </div>
          )}
          {comp.soldDate && (
            <div className="flex justify-between">
              <span className="font-medium">Listed:</span>
              <span className="whitespace-nowrap">{comp.soldDate}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
