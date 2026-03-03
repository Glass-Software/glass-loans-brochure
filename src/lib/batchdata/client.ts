/**
 * BatchData API Client
 * Wrapper for BatchData Real Estate API with retry logic and error handling
 */

import {
  AddressInput,
  BatchDataAddressResponse,
  BatchDataPropertyResponse,
  PropertySearchCriteria,
  BatchDataSearchResponse,
} from "./types";
import {
  BatchDataAPIError,
  BatchDataTimeoutError,
  BatchDataRateLimitError,
} from "./errors";

interface BatchDataConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // ms
  retryableStatusCodes: Set<number>;
}

export class BatchDataClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retryConfig: RetryConfig;

  constructor(config: BatchDataConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.batchdata.com/api/v1";
    this.timeout = config.timeout || 30000; // 30s default
    this.retryConfig = {
      maxRetries: config.maxRetries || 3,
      retryDelay: 1000,
      retryableStatusCodes: new Set([408, 429, 500, 502, 503, 504]),
    };
  }

  /**
   * Execute API request with retry logic
   */
  private async request<T>(
    endpoint: string,
    data: any,
    attempt: number = 1
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json, application/xml",
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : this.retryConfig.retryDelay;

        if (attempt < this.retryConfig.maxRetries) {
          console.log(`Rate limited, retrying after ${delay}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`);
          await this.sleep(delay);
          return this.request<T>(endpoint, data, attempt + 1);
        }
        throw new BatchDataRateLimitError("Rate limit exceeded");
      }

      // Handle retryable errors
      if (this.retryConfig.retryableStatusCodes.has(response.status)) {
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelay * attempt; // Exponential backoff
          console.log(`Request failed with ${response.status}, retrying after ${delay}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`);
          await this.sleep(delay);
          return this.request<T>(endpoint, data, attempt + 1);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new BatchDataAPIError(
          `BatchData API error: ${response.status}`,
          response.status,
          errorText
        );
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new BatchDataTimeoutError("Request timed out");
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse a full address string into structured components
   * This is a basic parser - for production, consider using a proper address parsing library
   */
  private parseAddress(addressString: string): AddressInput {
    // Simple regex-based parsing
    // Format: "Street, City, State ZIP" or "Street City State ZIP"
    const parts = addressString.split(",").map((p) => p.trim());

    if (parts.length >= 3) {
      // Format: "Street, City, State ZIP"
      const street = parts[0];
      const city = parts[1];
      const stateZip = parts[2].trim().split(/\s+/);
      const state = stateZip[0];
      const zip = stateZip[1] || "";
      return { street, city, state, zip };
    } else {
      // Fallback: Try to extract what we can
      const tokens = addressString.trim().split(/\s+/);
      const zip = tokens[tokens.length - 1].match(/^\d{5}(-\d{4})?$/) ? tokens.pop()! : "";
      const state = tokens.length > 0 ? tokens.pop()! : "";
      const city = tokens.length > 0 ? tokens.pop()! : "";
      const street = tokens.join(" ");
      return { street, city, state, zip };
    }
  }

  /**
   * Verify and standardize address
   */
  async verifyAddress(
    address: string | AddressInput
  ): Promise<BatchDataAddressResponse> {
    const addressInput = typeof address === "string" ? this.parseAddress(address) : address;
    const response = await this.request<{ results: { addresses: BatchDataAddressResponse[] } }>(
      "/address/verify",
      { requests: [addressInput] }
    );
    // BatchData returns results.addresses array, we take the first one
    const addr = response.results.addresses[0];
    if (addr.error) {
      throw new BatchDataAPIError(`Address verification failed: ${addr.error}`, 400, addr.error);
    }
    return addr;
  }

  /**
   * Lookup property details with all attributes
   */
  async lookupProperty(
    address: string | AddressInput
  ): Promise<BatchDataPropertyResponse> {
    const addressInput = typeof address === "string" ? this.parseAddress(address) : address;
    const response = await this.request<{ results: { properties: BatchDataPropertyResponse[] } }>(
      "/property/lookup/all-attributes",
      { requests: [addressInput] }
    );
    // BatchData returns results.properties array, we take the first one
    const property = response.results.properties[0];
    if (!property) {
      throw new BatchDataAPIError(`Property not found`, 404, "No property data returned");
    }
    return property;
  }

  /**
   * Search for properties matching criteria
   * Also used for comparable property search with compAddress
   */
  async searchProperties(
    searchCriteria: any,
    options?: any
  ): Promise<BatchDataSearchResponse> {
    const requestBody: any = { searchCriteria };
    if (options) {
      requestBody.options = options;
    }

    const response = await this.request<{ results: { properties: any[] } }>(
      "/property/search",
      requestBody
    );

    // BatchData returns results.properties array
    return {
      properties: response.results.properties || [],
      totalResults: response.results.properties?.length || 0
    };
  }

  /**
   * Get comparable properties for a subject property
   * Uses Property Search API with compAddress + options filters
   */
  async getComparableProperties(
    subjectAddress: AddressInput,
    options?: {
      distanceMiles?: number;
      minBedrooms?: number;    // Relative: -1 means "subject bedrooms - 1"
      maxBedrooms?: number;    // Relative: +1 means "subject bedrooms + 1"
      minBathrooms?: number;   // Relative
      maxBathrooms?: number;   // Relative
      minAreaPercent?: number; // Percentage: -20 means "80% of subject sqft"
      maxAreaPercent?: number; // Percentage: +20 means "120% of subject sqft"
      minYearBuilt?: number;   // Relative: -10 means "subject year - 10"
      maxYearBuilt?: number;   // Relative: +10 means "subject year + 10"
    }
  ): Promise<BatchDataSearchResponse> {
    const searchCriteria = {
      compAddress: {
        street: subjectAddress.street,
        city: subjectAddress.city,
        state: subjectAddress.state,
        zip: subjectAddress.zip,
      }
    };

    const searchOptions: any = {};

    // Distance filter
    if (options?.distanceMiles !== undefined) {
      searchOptions.useDistance = true;
      searchOptions.distanceMiles = options.distanceMiles;
    }

    // Bedrooms filter (relative values)
    if (options?.minBedrooms !== undefined || options?.maxBedrooms !== undefined) {
      searchOptions.useBedrooms = true;
      if (options.minBedrooms !== undefined) searchOptions.minBedrooms = options.minBedrooms;
      if (options.maxBedrooms !== undefined) searchOptions.maxBedrooms = options.maxBedrooms;
    }

    // Bathrooms filter (relative values)
    if (options?.minBathrooms !== undefined || options?.maxBathrooms !== undefined) {
      searchOptions.useBathrooms = true;
      if (options.minBathrooms !== undefined) searchOptions.minBathrooms = options.minBathrooms;
      if (options.maxBathrooms !== undefined) searchOptions.maxBathrooms = options.maxBathrooms;
    }

    // Area filter (percentage values)
    if (options?.minAreaPercent !== undefined || options?.maxAreaPercent !== undefined) {
      searchOptions.useArea = true;
      if (options.minAreaPercent !== undefined) searchOptions.minAreaPercent = options.minAreaPercent;
      if (options.maxAreaPercent !== undefined) searchOptions.maxAreaPercent = options.maxAreaPercent;
    }

    // Year built filter (relative values)
    if (options?.minYearBuilt !== undefined || options?.maxYearBuilt !== undefined) {
      searchOptions.useYearBuilt = true;
      if (options.minYearBuilt !== undefined) searchOptions.minYearBuilt = options.minYearBuilt;
      if (options.maxYearBuilt !== undefined) searchOptions.maxYearBuilt = options.maxYearBuilt;
    }

    return this.searchProperties(searchCriteria, searchOptions);
  }
}

// Singleton instance
let batchDataClient: BatchDataClient | null = null;

/**
 * Get singleton BatchData client instance
 */
export function getBatchDataClient(): BatchDataClient {
  if (!batchDataClient) {
    // Support mock server for testing
    const useMock = process.env.BATCHDATA_USE_MOCK === "true";

    // Use appropriate API key based on environment
    const apiKey = useMock
      ? process.env.BATCHDATA_MOCK_API_KEY
      : process.env.BATCHDATA_API_KEY;

    if (!apiKey) {
      const keyName = useMock ? "BATCHDATA_MOCK_API_KEY" : "BATCHDATA_API_KEY";
      throw new Error(`${keyName} environment variable not set`);
    }

    const baseUrl = useMock
      ? "https://stoplight.io/mocks/batchdata/batchdata/20349728"
      : "https://api.batchdata.com/api/v1";

    console.log(`[BatchData] Using ${useMock ? "MOCK" : "PRODUCTION"} endpoint: ${baseUrl}`);

    batchDataClient = new BatchDataClient({ apiKey, baseUrl });
  }
  return batchDataClient;
}
