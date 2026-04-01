import {
  RentCastSearchParams,
  RentCastSearchResponse,
  RentCastProperty,
  RentCastAVMParams,
  RentCastAVMResponse,
} from "./types";

export class RentCastAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = "RentCastAPIError";
  }
}

export class RentCastClient {
  private apiKey: string;
  private baseUrl = "https://api.rentcast.io/v1";
  private timeout = 15000; // 15 second timeout for RentCast API responses

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  /**
   * Search for properties using RentCast API
   * https://developers.rentcast.io/reference/search-queries
   */
  async searchProperties(
    params: RentCastSearchParams
  ): Promise<RentCastSearchResponse> {
    // Build query string
    const queryParams = new URLSearchParams({
      ...(params.latitude && { latitude: params.latitude.toString() }),
      ...(params.longitude && { longitude: params.longitude.toString() }),
      ...(params.radius && { radius: params.radius.toString() }),
      ...(params.address && { address: params.address }),
      ...(params.city && { city: params.city }),
      ...(params.state && { state: params.state }),
      ...(params.zipCode && { zipCode: params.zipCode }),
      ...(params.propertyType && { propertyType: params.propertyType }),
      ...(params.bedrooms && { bedrooms: params.bedrooms }),
      ...(params.bathrooms && { bathrooms: params.bathrooms }),
      ...(params.squareFootage && { squareFootage: params.squareFootage }),
      ...(params.lotSize && { lotSize: params.lotSize }),
      ...(params.yearBuilt && { yearBuilt: params.yearBuilt }),
      ...(params.saleDateRange && { saleDateRange: params.saleDateRange }),
      ...(params.daysOld && { daysOld: params.daysOld }),
      ...(params.price && { price: params.price }),
      ...(params.limit && { limit: params.limit.toString() }),
      ...(params.offset && { offset: params.offset.toString() }),
    });

    const url = `${this.baseUrl}/properties?${queryParams}`;

    try {
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Api-Key": this.apiKey,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        // Handle 404 "No properties found" as empty result, not an error
        if (response.status === 404 && errorText.includes("No properties found")) {
          return {
            properties: [],
            total: 0,
          };
        }

        throw new RentCastAPIError(
          `RentCast API error: ${response.statusText}`,
          response.status,
          this.getErrorCode(response.status)
        );
      }

      const data: RentCastProperty[] = await response.json();

      // Log the actual response to see what we're getting
      console.log(`[RentCast] API Response:`, JSON.stringify(data, null, 2));

      // RentCast returns an array directly, not an object with properties array
      return {
        properties: Array.isArray(data) ? data : [],
        total: Array.isArray(data) ? data.length : 0,
      };
    } catch (error: any) {
      if (error instanceof RentCastAPIError) throw error;

      // Handle timeout
      if (error.name === 'AbortError') {
        throw new RentCastAPIError(
          `Request timeout after ${this.timeout}ms`,
          undefined,
          'TIMEOUT'
        );
      }

      throw new RentCastAPIError(`Network error: ${error.message}`);
    }
  }

  /**
   * Get property valuation using RentCast AVM
   * https://developers.rentcast.io/reference/value-estimate
   */
  async getPropertyValue(
    params: RentCastAVMParams
  ): Promise<RentCastAVMResponse> {
    // Build query string
    const queryParams = new URLSearchParams({
      address: params.address,
      ...(params.propertyType && { propertyType: params.propertyType }),
      ...(params.bedrooms && { bedrooms: params.bedrooms.toString() }),
      ...(params.bathrooms && { bathrooms: params.bathrooms.toString() }),
      ...(params.squareFootage && { squareFootage: params.squareFootage.toString() }),
      // Always lookup subject attributes for best accuracy
      lookupSubjectAttributes: (params.lookupSubjectAttributes ?? true).toString(),
      // Comp filtering parameters
      ...(params.maxRadius && { maxRadius: params.maxRadius.toString() }),
      ...(params.daysOld && { daysOld: params.daysOld.toString() }),
      ...(params.compCount && { compCount: params.compCount.toString() }),
      ...(params.yearBuilt && { yearBuilt: params.yearBuilt }),
    });

    const url = `${this.baseUrl}/avm/value?${queryParams}`;

    const startTime = Date.now();

    try {
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Api-Key": this.apiKey,
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const elapsed = Date.now() - startTime;
      console.log(`[RentCast AVM] Request completed in ${elapsed}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        // Handle insufficient comparables error
        if (response.status === 400 && errorData.message?.includes('insufficient comparables')) {
          throw new RentCastAPIError(
            'Unable to find sufficient comparable properties for this address. Please try a different property or ensure the address includes city, state, and ZIP code.',
            response.status,
            'INSUFFICIENT_COMPS'
          );
        }

        throw new RentCastAPIError(
          `RentCast AVM API error: ${errorData.message || response.statusText}`,
          response.status,
          this.getErrorCode(response.status)
        );
      }

      const data: RentCastAVMResponse = await response.json();

      console.log(`[RentCast AVM] Response:`, JSON.stringify(data, null, 2));

      // Validate response has required fields
      if (!data.price || data.price <= 0) {
        throw new RentCastAPIError(
          "AVM response missing valid price",
          200,
          "INVALID_RESPONSE"
        );
      }

      return data;
    } catch (error: any) {
      if (error instanceof RentCastAPIError) throw error;

      // Handle timeout
      if (error.name === 'AbortError') {
        throw new RentCastAPIError(
          `Request timeout after ${this.timeout}ms`,
          undefined,
          'TIMEOUT'
        );
      }

      throw new RentCastAPIError(`Network error: ${error.message}`);
    }
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400:
        return "INVALID_PARAMS";
      case 401:
        return "INVALID_API_KEY";
      case 403:
        return "RATE_LIMIT";
      case 404:
        return "NOT_FOUND";
      case 422:
        return "INVALID_ADDRESS";
      case 500:
        return "SERVER_ERROR";
      default:
        return "UNKNOWN_ERROR";
    }
  }
}

// Singleton instance
let rentCastClient: RentCastClient | null = null;

export function getRentCastClient(): RentCastClient {
  if (!rentCastClient) {
    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
      throw new Error("RENTCAST_API_KEY environment variable is not set");
    }
    rentCastClient = new RentCastClient({ apiKey });
  }
  return rentCastClient;
}
