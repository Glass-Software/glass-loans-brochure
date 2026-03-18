/**
 * Parsed location data extracted from Google Places address_components
 */
export interface ParsedLocationData {
  streetAddress: string | null;   // Just street number and name (e.g., "1234 Main St")
  city: string | null;
  state: string | null;           // 2-letter abbreviation (e.g., "TN")
  stateFullName: string | null;   // Full name (e.g., "Tennessee")
  zip: string | null;
  county: string | null;          // County name (e.g., "Davidson County")
  country: string | null;
  latitude: number | null;        // Latitude coordinate
  longitude: number | null;       // Longitude coordinate
}

/**
 * Extracts structured location data from Google Places address_components.
 *
 * @param place - Google Places PlaceResult object
 * @param geometry - Optional geometry object with lat/lng coordinates
 * @returns ParsedLocationData with city, state, zip, coordinates, or null for missing components
 *
 * @example
 * const place = autocomplete.getPlace();
 * const location = parseGooglePlaceAddress(place, { lat: 36.1627, lng: -86.7816 });
 * // { streetAddress: "1234 Main St", city: "Nashville", state: "TN", stateFullName: "Tennessee", zip: "37201", county: "Davidson County", country: "US", latitude: 36.1627, longitude: -86.7816 }
 */
export function parseGooglePlaceAddress(
  place: google.maps.places.PlaceResult,
  geometry?: { lat: number; lng: number }
): ParsedLocationData {
  const result: ParsedLocationData = {
    streetAddress: null,
    city: null,
    state: null,
    stateFullName: null,
    zip: null,
    county: null,
    country: null,
    latitude: geometry?.lat ?? null,
    longitude: geometry?.lng ?? null,
  };

  // Safety check
  if (!place.address_components || place.address_components.length === 0) {
    return result;
  }

  let streetNumber = "";
  let route = "";

  // Loop through components and extract based on types
  for (const component of place.address_components) {
    const types = component.types;

    // Street number
    if (types.includes("street_number")) {
      streetNumber = component.long_name;
    }

    // Street name (route)
    if (types.includes("route")) {
      route = component.long_name;
    }

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

    // County (administrative_area_level_2)
    if (types.includes("administrative_area_level_2")) {
      result.county = component.long_name;
    }

    // Country
    if (types.includes("country")) {
      result.country = component.short_name; // 2-letter code
    }
  }

  // Combine street number and route to form street address
  if (streetNumber && route) {
    result.streetAddress = `${streetNumber} ${route}`;
  } else if (route) {
    result.streetAddress = route;
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
