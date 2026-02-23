"use client";

import { useState, useEffect, useRef } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";

// Extend Window interface for Google Maps callbacks
declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const formatNumber = (value: number | undefined): string => {
  if (!value) return "";
  return value.toLocaleString("en-US");
};

const parseNumber = (value: string): number => {
  return Number(value.replace(/,/g, ""));
};

export default function Step1PropertyDetails() {
  const { formData, updateFormData, goToNextStep } = useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const isPlacesUpdating = useRef(false); // Track when Places API is updating

  // Initialize Google Places Autocomplete
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      // Check if script already loaded
      if (window.google && window.google.maps && window.google.maps.places) {
        initAutocomplete();
        return;
      }

      // Check if script is already being loaded
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        // Wait for it to load
        const checkGoogle = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.places) {
            clearInterval(checkGoogle);
            initAutocomplete();
          }
        }, 100);
        return;
      }

      // Load the script
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => initAutocomplete();
      script.onerror = () => {
        console.warn("Google Maps API failed to load. Address autocomplete will not be available.");
      };
      document.head.appendChild(script);
    };

    const initAutocomplete = () => {
      try {
        if (!addressInputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            types: ["address"],
            componentRestrictions: { country: "us" },
          }
        );

        autocompleteRef.current = autocomplete;

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            // Set flag to prevent onChange interference
            isPlacesUpdating.current = true;
            updateFormData({ propertyAddress: place.formatted_address });

            // Clear flag after update completes
            setTimeout(() => {
              isPlacesUpdating.current = false;
            }, 100);
          }
        });
      } catch (error) {
        console.warn("Failed to initialize Google Places Autocomplete:", error);
        // Form will still work - users can type address manually
      }
    };

    // Suppress Google Maps API errors globally
    window.gm_authFailure = () => {
      console.warn("Google Maps API authentication failed. Please check API key and enabled APIs.");
    };

    loadGoogleMapsScript();

    return () => {
      if (autocompleteRef.current && window.google) {
        try {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [updateFormData]);

  const handleNumberChange = (field: string, value: string) => {
    // Remove non-numeric characters except decimal point
    const cleaned = value.replace(/[^\d]/g, "");
    const numValue = cleaned ? parseInt(cleaned) : 0;
    updateFormData({ [field]: numValue });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stepData = {
      propertyAddress: formData.propertyAddress || "",
      purchasePrice: formData.purchasePrice || 0,
      rehab: formData.rehab || 0,
      squareFeet: formData.squareFeet || 0,
    };

    const validation = validateStep(1, stepData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    goToNextStep();
  };

  const inputClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-body-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit}>
      <div className="-mx-4 flex flex-wrap">
        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="propertyAddress" className={labelClass}>
              Property Address *
            </label>
            <input
              ref={addressInputRef}
              type="text"
              id="propertyAddress"
              value={formData.propertyAddress || ""}
              onChange={(e) => {
                // Don't update if Places API is currently updating
                if (!isPlacesUpdating.current) {
                  updateFormData({ propertyAddress: e.target.value });
                }
              }}
              placeholder="Start typing an address..."
              className={inputClass}
            />
            {errors.propertyAddress && (
              <p className={errorClass}>{errors.propertyAddress}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="purchasePrice" className={labelClass}>
              Purchase Price *
            </label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-body-color">
                $
              </span>
              <input
                type="text"
                id="purchasePrice"
                value={formatNumber(formData.purchasePrice)}
                onChange={(e) => handleNumberChange("purchasePrice", e.target.value)}
                placeholder="140,000"
                className={`${inputClass} pl-10`}
              />
            </div>
            {errors.purchasePrice && (
              <p className={errorClass}>{errors.purchasePrice}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="rehab" className={labelClass}>
              Rehab Budget *
            </label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-body-color">
                $
              </span>
              <input
                type="text"
                id="rehab"
                value={formatNumber(formData.rehab)}
                onChange={(e) => handleNumberChange("rehab", e.target.value)}
                placeholder="25,000"
                className={`${inputClass} pl-10`}
              />
            </div>
            {errors.rehab && <p className={errorClass}>{errors.rehab}</p>}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/2">
          <div className="mb-8">
            <label htmlFor="squareFeet" className={labelClass}>
              Square Feet *
            </label>
            <input
              type="text"
              id="squareFeet"
              value={formatNumber(formData.squareFeet)}
              onChange={(e) => handleNumberChange("squareFeet", e.target.value)}
              placeholder="1,150"
              className={inputClass}
            />
            {errors.squareFeet && (
              <p className={errorClass}>{errors.squareFeet}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4">
          <button
            type="submit"
            className="rounded-sm bg-primary px-9 py-4 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 dark:shadow-submit-dark"
          >
            Next Step
          </button>
        </div>
      </div>
    </form>
  );
}
