import {
  RealieCompSearchParams,
  RealieSearchResponse,
  RealieComparable,
} from "./types";

export class RealieAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = "RealieAPIError";
  }
}

export class RealieClient {
  private apiKey: string;
  private baseUrl = "https://app.realie.ai/api/public";

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  /**
   * Search for comparable properties using Premium Comparables API
   */
  async searchComparables(
    params: RealieCompSearchParams
  ): Promise<RealieSearchResponse> {
    // Build query string
    const queryParams = new URLSearchParams({
      latitude: params.latitude.toString(),
      longitude: params.longitude.toString(),
      ...(params.radius && { radius: params.radius.toString() }),
      ...(params.timeFrame && { timeFrame: params.timeFrame.toString() }),
      ...(params.sqftMin && { sqftMin: params.sqftMin.toString() }),
      ...(params.sqftMax && { sqftMax: params.sqftMax.toString() }),
      ...(params.bedsMin && { bedsMin: params.bedsMin.toString() }),
      ...(params.bedsMax && { bedsMax: params.bedsMax.toString() }),
      ...(params.bathsMin && { bathsMin: params.bathsMin.toString() }),
      ...(params.bathsMax && { bathsMax: params.bathsMax.toString() }),
      ...(params.propertyType && { propertyType: params.propertyType }),
      ...(params.priceMin && { priceMin: params.priceMin.toString() }),
      ...(params.priceMax && { priceMax: params.priceMax.toString() }),
      ...(params.maxResults && { maxResults: params.maxResults.toString() }),
    });

    const url = `${this.baseUrl}/premium/comparables/?${queryParams}`;

    console.log(`[Realie] Request URL: ${url}`);
    console.log(`[Realie] Request params:`, params);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Handle 404 "No comparable properties found" as empty result, not an error
        if (response.status === 404 && errorText.includes("No comparable properties found")) {
          return {
            comparables: [],
            metadata: {
              count: 0,
              searchParams: params,
            },
          };
        }

        throw new RealieAPIError(
          `Realie API error: ${response.statusText}`,
          response.status,
          this.getErrorCode(response.status)
        );
      }

      const data: RealieSearchResponse = await response.json();

      // Log the actual response to see what we're getting
      console.log(`[Realie] API Response:`, JSON.stringify(data, null, 2));

      return data;
    } catch (error: any) {
      if (error instanceof RealieAPIError) throw error;
      throw new RealieAPIError(`Network error: ${error.message}`);
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
      case 500:
        return "SERVER_ERROR";
      default:
        return "UNKNOWN_ERROR";
    }
  }
}

// Singleton instance
let realieClient: RealieClient | null = null;

export function getRealieClient(): RealieClient {
  if (!realieClient) {
    const apiKey = process.env.REALIE_API_KEY;
    if (!apiKey) {
      throw new Error("REALIE_API_KEY environment variable is not set");
    }
    realieClient = new RealieClient({ apiKey });
  }
  return realieClient;
}
