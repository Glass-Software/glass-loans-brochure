/**
 * Parsed location data extracted from Google Places address_components
 */
export interface ParsedLocationData {
  city: string | null;
  state: string | null;           // 2-letter abbreviation (e.g., "TN")
  stateFullName: string | null;   // Full name (e.g., "Tennessee")
  zip: string | null;
  country: string | null;
}

/**
 * Extracts structured location data from Google Places address_components.
 *
 * @param place - Google Places PlaceResult object
 * @returns ParsedLocationData with city, state, zip, or null for missing components
 *
 * @example
 * const place = autocomplete.getPlace();
 * const location = parseGooglePlaceAddress(place);
 * // { city: "Nashville", state: "TN", stateFullName: "Tennessee", zip: "37201", country: "US" }
 */
export function parseGooglePlaceAddress(
  place: google.maps.places.PlaceResult
): ParsedLocationData {
  const result: ParsedLocationData = {
    city: null,
    state: null,
    stateFullName: null,
    zip: null,
    country: null,
  };

  // Safety check
  if (!place.address_components || place.address_components.length === 0) {
    return result;
  }

  // Loop through components and extract based on types
  for (const component of place.address_components) {
    const types = component.types;

    // City (locality)
    if (types.includes("locality")) {
      result.city = component.long_name;
    }

    // State (administrative_area_level_1)
    if (types.includes("administrative_area_level_1")) {
      result.state = component.short_name; // 2-letter code
      result.stateFullName = component.long_name; // Full name
    }

    // ZIP code (postal_code)
    if (types.includes("postal_code")) {
      result.zip = component.long_name;
    }

    // Country
    if (types.includes("country")) {
      result.country = component.short_name; // 2-letter code
    }
  }

  // Fallback: Try to get city from sublocality if locality is missing
  if (!result.city) {
    for (const component of place.address_components) {
      if (component.types.includes("sublocality") || component.types.includes("sublocality_level_1")) {
        result.city = component.long_name;
        break;
      }
    }
  }

  return result;
}
