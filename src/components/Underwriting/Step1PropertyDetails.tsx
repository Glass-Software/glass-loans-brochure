"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";
import { parseGooglePlaceAddress } from "@/lib/utils/address-parser";

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google?: any;
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
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const addressInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const googleLoadedRef = useRef(false);

  // Initialize Google Places API and session token
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      // Check if script already loaded
      if (window.google?.maps?.places) {
        googleLoadedRef.current = true;
        createSessionToken();
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        const checkGoogle = setInterval(() => {
          if (window.google?.maps?.places) {
            clearInterval(checkGoogle);
            googleLoadedRef.current = true;
            createSessionToken();
          }
        }, 100);
        return;
      }

      // Load the Places API script
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        googleLoadedRef.current = true;
        createSessionToken();
      };
      script.onerror = () => {
        console.warn("Google Maps API failed to load. Address autocomplete will not be available.");
      };
      document.head.appendChild(script);
    };

    const createSessionToken = () => {
      if (window.google?.maps?.places?.AutocompleteSessionToken) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
    };

    loadGoogleMapsScript();
  }, []);

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input || input.length < 3 || !googleLoadedRef.current) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);

    try {
      const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places");

      const request = {
        input,
        includedRegionCodes: ['us'],
        sessionToken: sessionTokenRef.current
      };

      const { suggestions: fetchedSuggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      if (fetchedSuggestions && fetchedSuggestions.length > 0) {
        setSuggestions(fetchedSuggestions);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.warn("Failed to fetch autocomplete suggestions:", error);
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced input handler
  const handleAddressInput = useCallback((value: string) => {
    updateFormData({ propertyAddress: value });

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }, [fetchSuggestions, updateFormData]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(async (suggestion: any) => {
    try {
      // Convert suggestion to Place object
      const place = await suggestion.placePrediction.toPlace();

      // Fetch address components
      await place.fetchFields({ fields: ['addressComponents'] });

      if (place.addressComponents) {
        // Convert to format our parser expects
        const addressComponents = place.addressComponents.map((comp: any) => ({
          long_name: comp.longText,
          short_name: comp.shortText,
          types: comp.types
        }));

        const mockPlace = { address_components: addressComponents };
        const locationData = parseGooglePlaceAddress(mockPlace as any);

        // Update form with parsed data
        updateFormData({
          propertyAddress: locationData.streetAddress || "",
          propertyCity: locationData.city || undefined,
          propertyState: locationData.state || undefined,
          propertyZip: locationData.zip || undefined,
          propertyCounty: locationData.county || undefined,
        });
      }

      // Close dropdown and create new session token
      setShowDropdown(false);
      setSuggestions([]);
      setSelectedIndex(-1);

      // Create new session token for next search
      if (window.google?.maps?.places?.AutocompleteSessionToken) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
    } catch (error) {
      console.warn("Failed to fetch place details:", error);
    }
  }, [updateFormData]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showDropdown, suggestions, selectedIndex, handleSelectSuggestion]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        addressInputRef.current &&
        !addressInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      bedrooms: formData.bedrooms || 0,
      bathrooms: formData.bathrooms || 0,
      yearBuilt: formData.yearBuilt || 0,
      propertyType: formData.propertyType || "",
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
          <div className="mb-8 relative">
            <label htmlFor="propertyAddress" className={labelClass}>
              Property Address *
            </label>
            <input
              ref={addressInputRef}
              type="text"
              id="propertyAddress"
              value={formData.propertyAddress || ""}
              onChange={(e) => handleAddressInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="1234 Main St"
              className={inputClass}
              autoComplete="off"
            />

            {/* Custom Autocomplete Dropdown */}
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-dark border border-stroke dark:border-transparent rounded-sm shadow-three dark:shadow-two max-h-60 overflow-y-auto"
              >
                {loading ? (
                  <div className="px-6 py-3 text-sm text-body-color dark:text-body-color-dark">
                    Loading suggestions...
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => {
                    const mainText = suggestion.placePrediction?.text?.text || '';
                    const parts = mainText.split(', ');
                    const primary = parts[0] || mainText;
                    const secondary = parts.slice(1).join(', ') || '';

                    return (
                      <div
                        key={index}
                        onClick={() => handleSelectSuggestion(suggestion)}
                        className={`px-6 py-3 cursor-pointer text-sm transition-colors ${
                          index === selectedIndex
                            ? 'bg-primary/10 dark:bg-primary/20'
                            : 'hover:bg-gray-light dark:hover:bg-stroke-dark'
                        }`}
                      >
                        <div className="font-medium text-dark dark:text-white">
                          {primary}
                        </div>
                        {secondary && (
                          <div className="text-xs text-body-color dark:text-body-color-dark">
                            {secondary}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : null}
              </div>
            )}

            {errors.propertyAddress && (
              <p className={errorClass}>{errors.propertyAddress}</p>
            )}
            <p className="mt-1 text-xs text-body-color">
              Start typing and select an address from the dropdown
            </p>
          </div>
        </div>

        {/* Location Fields - Auto-populated from Google Places */}
        <div className="w-full px-4 md:w-1/3">
          <div className="mb-8">
            <label htmlFor="propertyCity" className={labelClass}>
              City
            </label>
            <input
              type="text"
              id="propertyCity"
              value={formData.propertyCity || ""}
              onChange={(e) => updateFormData({ propertyCity: e.target.value })}
              placeholder="City"
              className={inputClass}
            />
          </div>
        </div>

        <div className="w-full px-4 md:w-1/3">
          <div className="mb-8">
            <label htmlFor="propertyState" className={labelClass}>
              State
            </label>
            <input
              type="text"
              id="propertyState"
              value={formData.propertyState || ""}
              onChange={(e) => updateFormData({ propertyState: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="State"
              maxLength={2}
              className={inputClass}
            />
          </div>
        </div>

        <div className="w-full px-4 md:w-1/3">
          <div className="mb-8">
            <label htmlFor="propertyZip" className={labelClass}>
              ZIP Code
            </label>
            <input
              type="text"
              id="propertyZip"
              value={formData.propertyZip || ""}
              onChange={(e) => updateFormData({ propertyZip: e.target.value.slice(0, 10) })}
              placeholder="37201"
              maxLength={10}
              className={inputClass}
            />
          </div>
        </div>

        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="propertyCounty" className={labelClass}>
              County
            </label>
            <input
              type="text"
              id="propertyCounty"
              value={formData.propertyCounty || ""}
              onChange={(e) => updateFormData({ propertyCounty: e.target.value })}
              placeholder="Davidson County"
              className={inputClass}
            />
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

        <div className="w-full px-4 md:w-1/3">
          <div className="mb-8">
            <label htmlFor="bedrooms" className={labelClass}>
              Bedrooms *
            </label>
            <input
              type="number"
              id="bedrooms"
              min="1"
              max="10"
              step="1"
              value={formData.bedrooms || ""}
              onChange={(e) => updateFormData({ bedrooms: parseInt(e.target.value) || 0 })}
              placeholder="3"
              className={inputClass}
            />
            {errors.bedrooms && (
              <p className={errorClass}>{errors.bedrooms}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/3">
          <div className="mb-8">
            <label htmlFor="bathrooms" className={labelClass}>
              Bathrooms *
            </label>
            <input
              type="number"
              id="bathrooms"
              min="1"
              max="8"
              step="0.5"
              value={formData.bathrooms || ""}
              onChange={(e) => updateFormData({ bathrooms: parseFloat(e.target.value) || 0 })}
              placeholder="2.5"
              className={inputClass}
            />
            {errors.bathrooms && (
              <p className={errorClass}>{errors.bathrooms}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4 md:w-1/3">
          <div className="mb-8">
            <label htmlFor="yearBuilt" className={labelClass}>
              Year Built *
            </label>
            <input
              type="number"
              id="yearBuilt"
              min="1800"
              max={new Date().getFullYear()}
              step="1"
              value={formData.yearBuilt || ""}
              onChange={(e) => updateFormData({ yearBuilt: parseInt(e.target.value) || 0 })}
              placeholder="2005"
              className={inputClass}
            />
            {errors.yearBuilt && (
              <p className={errorClass}>{errors.yearBuilt}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="propertyType" className={labelClass}>
              Property Type *
            </label>
            <select
              id="propertyType"
              value={formData.propertyType || ""}
              onChange={(e) => updateFormData({ propertyType: e.target.value as any })}
              className={inputClass}
            >
              <option value="">Select property type...</option>
              <option value="SFR">Single Family Residence (SFR)</option>
              <option value="Condo">Condo</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Multi-Family">Multi-Family</option>
            </select>
            {errors.propertyType && (
              <p className={errorClass}>{errors.propertyType}</p>
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
