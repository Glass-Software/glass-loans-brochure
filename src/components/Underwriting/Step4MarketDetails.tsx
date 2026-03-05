"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUnderwriting } from "@/context/UnderwritingContext";
import { validateStep } from "@/lib/underwriting/validation";
import type { MarketType } from "@/types/underwriting";

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google?: any;
  }
}

export default function Step4MarketDetails() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useUnderwriting();
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Autocomplete state for each comp field
  const [suggestions, setSuggestions] = useState<any[][]>([[], [], []]);
  const [showDropdown, setShowDropdown] = useState<boolean[]>([false, false, false]);
  const [loading, setLoading] = useState<boolean[]>([false, false, false]);
  const [selectedIndex, setSelectedIndex] = useState<number[]>([-1, -1, -1]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const sessionTokenRef = useRef<any>(null);
  const debounceTimersRef = useRef<(NodeJS.Timeout | null)[]>([null, null, null]);
  const googleLoadedRef = useRef(false);

  const compLinks = useMemo(
    () => formData.compLinks || ["", "", ""],
    [formData.compLinks]
  );

  // Initialize Google Places API
  useEffect(() => {
    const loadGoogleMapsScript = () => {
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

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        googleLoadedRef.current = true;
        createSessionToken();
      };
      script.onerror = () => {
        console.warn("Google Maps API failed to load.");
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
  const fetchSuggestions = useCallback(async (input: string, fieldIndex: number) => {
    if (!input || input.length < 3 || !googleLoadedRef.current) {
      const newSuggestions = [...suggestions];
      newSuggestions[fieldIndex] = [];
      setSuggestions(newSuggestions);

      const newShowDropdown = [...showDropdown];
      newShowDropdown[fieldIndex] = false;
      setShowDropdown(newShowDropdown);
      return;
    }

    const newLoading = [...loading];
    newLoading[fieldIndex] = true;
    setLoading(newLoading);

    try {
      const { AutocompleteSuggestion } = await window.google.maps.importLibrary("places");

      const request = {
        input,
        includedRegionCodes: ['us'],
        sessionToken: sessionTokenRef.current
      };

      const { suggestions: fetchedSuggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      if (fetchedSuggestions && fetchedSuggestions.length > 0) {
        const newSuggestions = [...suggestions];
        newSuggestions[fieldIndex] = fetchedSuggestions;
        setSuggestions(newSuggestions);

        const newShowDropdown = [...showDropdown];
        newShowDropdown[fieldIndex] = true;
        setShowDropdown(newShowDropdown);
      } else {
        const newSuggestions = [...suggestions];
        newSuggestions[fieldIndex] = [];
        setSuggestions(newSuggestions);

        const newShowDropdown = [...showDropdown];
        newShowDropdown[fieldIndex] = false;
        setShowDropdown(newShowDropdown);
      }
    } catch (error) {
      console.warn("Failed to fetch autocomplete suggestions:", error);
      const newSuggestions = [...suggestions];
      newSuggestions[fieldIndex] = [];
      setSuggestions(newSuggestions);

      const newShowDropdown = [...showDropdown];
      newShowDropdown[fieldIndex] = false;
      setShowDropdown(newShowDropdown);
    } finally {
      const newLoading = [...loading];
      newLoading[fieldIndex] = false;
      setLoading(newLoading);
    }
  }, [suggestions, showDropdown, loading]);

  // Handle address input with debounce
  const handleAddressInput = useCallback((value: string, fieldIndex: number) => {
    const newCompLinks = [...compLinks];
    newCompLinks[fieldIndex] = value;
    const filteredLinks = newCompLinks.filter((link) => link.trim() !== "");
    updateFormData({ compLinks: filteredLinks.length > 0 ? filteredLinks : undefined });

    // Clear existing timer
    if (debounceTimersRef.current[fieldIndex]) {
      clearTimeout(debounceTimersRef.current[fieldIndex]!);
    }

    // Set new timer
    debounceTimersRef.current[fieldIndex] = setTimeout(() => {
      fetchSuggestions(value, fieldIndex);
    }, 300);
  }, [compLinks, updateFormData, fetchSuggestions]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback(async (suggestion: any, fieldIndex: number) => {
    try {
      const place = await suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents'] });

      if (place.addressComponents) {
        // Extract full address
        const addressComponents = place.addressComponents.map((comp: any) => ({
          long_name: comp.longText,
          short_name: comp.shortText,
          types: comp.types
        }));

        // Build formatted address string
        const streetNumber = addressComponents.find((c: any) => c.types.includes('street_number'))?.long_name || '';
        const route = addressComponents.find((c: any) => c.types.includes('route'))?.long_name || '';
        const city = addressComponents.find((c: any) => c.types.includes('locality'))?.long_name || '';
        const state = addressComponents.find((c: any) => c.types.includes('administrative_area_level_1'))?.short_name || '';
        const zip = addressComponents.find((c: any) => c.types.includes('postal_code'))?.long_name || '';

        const formattedAddress = `${streetNumber} ${route}, ${city}, ${state} ${zip}`.trim();

        // Update the specific comp field
        const newCompLinks = [...compLinks];
        newCompLinks[fieldIndex] = formattedAddress;
        const filteredLinks = newCompLinks.filter((link) => link.trim() !== "");
        updateFormData({ compLinks: filteredLinks.length > 0 ? filteredLinks : undefined });
      }

      // Close dropdown
      const newShowDropdown = [...showDropdown];
      newShowDropdown[fieldIndex] = false;
      setShowDropdown(newShowDropdown);

      const newSuggestions = [...suggestions];
      newSuggestions[fieldIndex] = [];
      setSuggestions(newSuggestions);

      const newSelectedIndex = [...selectedIndex];
      newSelectedIndex[fieldIndex] = -1;
      setSelectedIndex(newSelectedIndex);

      // Create new session token
      if (window.google?.maps?.places?.AutocompleteSessionToken) {
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
      }
    } catch (error) {
      console.warn("Failed to fetch place details:", error);
    }
  }, [compLinks, updateFormData, showDropdown, suggestions, selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, fieldIndex: number) => {
    if (!showDropdown[fieldIndex] || suggestions[fieldIndex].length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const newSelectedIndexDown = [...selectedIndex];
        newSelectedIndexDown[fieldIndex] = selectedIndex[fieldIndex] < suggestions[fieldIndex].length - 1
          ? selectedIndex[fieldIndex] + 1
          : selectedIndex[fieldIndex];
        setSelectedIndex(newSelectedIndexDown);
        break;
      case 'ArrowUp':
        e.preventDefault();
        const newSelectedIndexUp = [...selectedIndex];
        newSelectedIndexUp[fieldIndex] = selectedIndex[fieldIndex] > 0
          ? selectedIndex[fieldIndex] - 1
          : -1;
        setSelectedIndex(newSelectedIndexUp);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex[fieldIndex] >= 0 && selectedIndex[fieldIndex] < suggestions[fieldIndex].length) {
          handleSelectSuggestion(suggestions[fieldIndex][selectedIndex[fieldIndex]], fieldIndex);
        }
        break;
      case 'Escape':
        const newShowDropdownEsc = [...showDropdown];
        newShowDropdownEsc[fieldIndex] = false;
        setShowDropdown(newShowDropdownEsc);

        const newSelectedIndexEsc = [...selectedIndex];
        newSelectedIndexEsc[fieldIndex] = -1;
        setSelectedIndex(newSelectedIndexEsc);
        break;
    }
  }, [showDropdown, suggestions, selectedIndex, handleSelectSuggestion]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      dropdownRefs.current.forEach((dropdownRef, index) => {
        if (
          dropdownRef &&
          !dropdownRef.contains(event.target as Node) &&
          inputRefs.current[index] &&
          !inputRefs.current[index]!.contains(event.target as Node)
        ) {
          const newShowDropdown = [...showDropdown];
          newShowDropdown[index] = false;
          setShowDropdown(newShowDropdown);

          const newSelectedIndex = [...selectedIndex];
          newSelectedIndex[index] = -1;
          setSelectedIndex(newSelectedIndex);
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, selectedIndex]);

  const updateCompLink = (index: number, value: string) => {
    const newCompLinks = [...compLinks];
    newCompLinks[index] = value;
    // Filter out empty strings before saving
    const filteredLinks = newCompLinks.filter((link) => link.trim() !== "");
    updateFormData({ compLinks: filteredLinks.length > 0 ? filteredLinks : undefined });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const stepData = {
      marketType: formData.marketType,
      additionalDetails: formData.additionalDetails,
      compLinks: formData.compLinks,
    };

    const validation = validateStep(4, stepData);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    goToNextStep();
  };

  const selectClass =
    "border-stroke w-full rounded-sm border bg-[#f8f8f8] px-6 py-3 text-base text-dark placeholder:text-body-color outline-none focus:border-primary dark:border-transparent dark:bg-[#2C303B] dark:text-white dark:placeholder:text-body-color-dark dark:shadow-two dark:focus:border-primary dark:focus:shadow-none";
  const labelClass = "mb-3 block text-sm font-medium text-dark dark:text-white";
  const errorClass = "mt-1 text-sm text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit}>
      <div className="-mx-4 flex flex-wrap">
        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="marketType" className={labelClass}>
              Market Type *
            </label>
            <select
              id="marketType"
              value={formData.marketType || ""}
              onChange={(e) =>
                updateFormData({ marketType: e.target.value as MarketType })
              }
              className={selectClass}
            >
              <option value="">Select market type...</option>
              <option value="Primary">Primary</option>
              <option value="Secondary">Secondary</option>
              <option value="Tertiary">Tertiary</option>
            </select>
            {errors.marketType && (
              <p className={errorClass}>{errors.marketType}</p>
            )}
            <p className="mt-1 text-xs text-body-color">
              Primary: Major metro areas • Secondary: Mid-size cities • Tertiary: Small markets
            </p>
          </div>
        </div>

        <div className="w-full px-4">
          <div className="mb-8">
            <label htmlFor="additionalDetails" className={labelClass}>
              Additional Details for Gary (Optional)
            </label>
            <textarea
              id="additionalDetails"
              rows={4}
              value={formData.additionalDetails || ""}
              onChange={(e) =>
                updateFormData({ additionalDetails: e.target.value })
              }
              placeholder="Share any additional context about this deal that would help Gary provide a more accurate opinion... (e.g., market trends, property specifics, exit strategy, timeline constraints, etc.)"
              className={selectClass}
            />
            {errors.additionalDetails && (
              <p className={errorClass}>{errors.additionalDetails}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4">
          <div className="mb-8">
            <label className={labelClass}>
              Property Comparables (Optional)
            </label>
            <p className="mb-3 text-xs text-body-color">
              Provide up to 3 addresses of comparable properties to help Gary analyze this deal more accurately
            </p>

            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="relative">
                  <input
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    value={compLinks[index] || ""}
                    onChange={(e) => handleAddressInput(e.target.value, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder={`Comp ${index + 1} address (e.g., 1904 Avalon Dr, Nashville, TN 37216)`}
                    className={selectClass}
                    autoComplete="off"
                  />

                  {/* Custom Autocomplete Dropdown */}
                  {showDropdown[index] && (
                    <div
                      ref={(el) => { dropdownRefs.current[index] = el; }}
                      className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-dark border border-stroke dark:border-transparent rounded-sm shadow-three dark:shadow-two max-h-60 overflow-y-auto"
                    >
                      {loading[index] ? (
                        <div className="px-6 py-3 text-sm text-body-color dark:text-body-color-dark">
                          Loading suggestions...
                        </div>
                      ) : suggestions[index].length > 0 ? (
                        suggestions[index].map((suggestion: any, suggestionIndex: number) => {
                          const mainText = suggestion.placePrediction?.text?.text || '';
                          const parts = mainText.split(', ');
                          const primary = parts[0] || mainText;
                          const secondary = parts.slice(1).join(', ') || '';

                          return (
                            <div
                              key={suggestionIndex}
                              onClick={() => handleSelectSuggestion(suggestion, index)}
                              className={`px-6 py-3 cursor-pointer text-sm transition-colors ${
                                suggestionIndex === selectedIndex[index]
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
                </div>
              ))}
            </div>
            {errors.compLinks && (
              <p className={errorClass}>{errors.compLinks}</p>
            )}
          </div>
        </div>

        <div className="w-full px-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={goToPreviousStep}
              className="rounded-sm border border-primary px-9 py-4 text-base font-medium text-primary duration-300 hover:bg-primary hover:text-white"
            >
              Previous
            </button>
            <button
              type="submit"
              className="rounded-sm bg-primary px-9 py-4 text-base font-medium text-white shadow-submit duration-300 hover:bg-primary/90 dark:shadow-submit-dark"
            >
              Next: Get Results
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
