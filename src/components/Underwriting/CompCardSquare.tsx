"use client";

import { formatPricePerSqft } from "@/lib/underwriting/calculations";
import type { PropertyComparable } from "@/types/underwriting";

interface CompCardSquareProps {
  comp: PropertyComparable;
  index: number;
  state?: { emphasized: boolean; removed: boolean };
  onUpdate: (updates: { emphasized?: boolean; removed?: boolean }) => void;
  disableRemove: boolean;
  isHighlighted?: boolean;
  compRef?: (el: HTMLDivElement | null) => void;
  onCardClick?: () => void;
  onCategorize?: () => void; // Called when comp is categorized (on desktop only)
}

export default function CompCardSquare({
  comp,
  index,
  state,
  onUpdate,
  disableRemove,
  isHighlighted = false,
  compRef,
  onCardClick,
  onCategorize,
}: CompCardSquareProps) {
  const isEmphasized = state?.emphasized || false;
  const isRemoved = state?.removed || false;
  const isNormal = !isEmphasized && !isRemoved;

  // Generate link: use listing URL if available, otherwise search Google
  const linkUrl =
    comp.listingUrl ||
    `https://www.google.com/search?q=${encodeURIComponent(comp.address)}`;

  // Handle card click - only trigger if not clicking on buttons or links
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // Don't trigger if clicking on a button, link, or their children
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }

    // Call the parent's click handler
    onCardClick?.();
  };

  return (
    <div
      ref={compRef}
      onClick={handleCardClick}
      className={`group relative rounded-sm border p-4 transition-all cursor-pointer ${
        isHighlighted
          ? "border-primary shadow-lg ring-2 ring-primary ring-offset-2"
          : ""
      } ${
        isRemoved
          ? "border-gray-300 bg-gray-50 opacity-60 dark:border-gray-600 dark:bg-gray-800"
          : isEmphasized
            ? "border-success bg-success-light dark:border-success dark:bg-success/10"
            : "border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark"
      }`}
    >
      {/* Comp Details */}
      <div className="mb-3">
        <h4 className="mb-2 text-sm font-semibold">
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-dark hover:text-primary hover:underline dark:text-white dark:hover:text-primary"
          >
            {comp.address}
            <svg
              className="h-3 w-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </h4>

        {/* Price */}
        <div className="mb-2">
          <span className="text-xl font-bold text-primary">
            ${comp.price.toLocaleString()}
          </span>
        </div>

        {/* Details Grid */}
        <div className="space-y-1 text-xs text-body-color dark:text-body-color-dark">
          <div className="flex justify-between">
            <span className="font-medium">$/sqft:</span>
            <span>${formatPricePerSqft(comp.price, comp.sqft)}</span>
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
      </div>

      {/* Action Buttons - Always visible */}
      <div className="mt-3 flex gap-1">
        <button
          onClick={() => {
            onUpdate({ emphasized: true, removed: false });
            // Trigger marker animation on desktop only
            if (typeof window !== "undefined" && window.innerWidth >= 1024) {
              onCategorize?.();
            }
          }}
          className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
            isEmphasized
              ? "bg-success text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          }`}
          title="Emphasize this comp"
        >
          {isEmphasized ? "✓ " : ""}Emphasize
        </button>
        <button
          onClick={() => {
            onUpdate({ emphasized: false, removed: false });
            // Trigger marker animation on desktop only
            if (typeof window !== "undefined" && window.innerWidth >= 1024) {
              onCategorize?.();
            }
          }}
          className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
            isNormal
              ? "bg-primary text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          }`}
          title="Mark as normal"
        >
          {isNormal ? "✓ " : ""}Normal
        </button>
        <button
          onClick={() => {
            onUpdate({ emphasized: false, removed: true });
            // Trigger marker animation on desktop only
            if (typeof window !== "undefined" && window.innerWidth >= 1024) {
              onCategorize?.();
            }
          }}
          disabled={disableRemove && !isRemoved}
          className={`flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isRemoved
              ? "bg-gray-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          }`}
          title={disableRemove && !isRemoved ? "Cannot remove - minimum 3 comps required" : "Remove this comp"}
        >
          {isRemoved ? "✓ " : ""}Remove
        </button>
      </div>
    </div>
  );
}
