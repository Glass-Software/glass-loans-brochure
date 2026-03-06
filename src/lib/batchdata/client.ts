/**
 * BatchData API Client
 * Wrapper for BatchData Real Estate API with retry logic and error handling
 */

import {
  AddressInput,
  BatchDataAddressResponse,
  BatchDataPropertyResponse,
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
    attempt: number = 1,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json, application/xml",
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
          console.log(
            `Rate limited, retrying after ${delay}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`,
          );
          await this.sleep(delay);
          return this.request<T>(endpoint, data, attempt + 1);
        }
        throw new BatchDataRateLimitError("Rate limit exceeded");
      }

      // Handle retryable errors
      if (this.retryConfig.retryableStatusCodes.has(response.status)) {
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.retryDelay * attempt; // Exponential backoff
          console.log(
            `Request failed with ${response.status}, retrying after ${delay}ms (attempt ${attempt}/${this.retryConfig.maxRetries})`,
          );
          await this.sleep(delay);
          return this.request<T>(endpoint, data, attempt + 1);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new BatchDataAPIError(
          `BatchData API error: ${response.status}`,
          response.status,
          errorText,
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
      const zip = tokens[tokens.length - 1].match(/^\d{5}(-\d{4})?$/)
        ? tokens.pop()!
        : "";
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
    address: string | AddressInput,
  ): Promise<BatchDataAddressResponse> {
    const addressInput =
      typeof address === "string" ? this.parseAddress(address) : address;
    const response = await this.request<{ results: { addresses: any[] } }>(
      "/address/verify",
      { requests: [addressInput] },
    );
    // BatchData returns results.addresses array, we take the first one
    const addr = response.results.addresses[0];
    if (addr.error) {
      throw new BatchDataAPIError(
        `Address verification failed: ${addr.error}`,
        400,
        addr.error,
      );
    }

    // Normalize address response to expected format
    return {
      standardizedAddress: addr.streetNoUnit || addr.street || "",
      streetNumber: addr.houseNumber || "",
      streetName: addr.formattedStreet || "",
      city: addr.city || "",
      state: addr.state || "",
      zipCode: addr.zip || "",
      zipPlus4: addr.zipPlus4 || "",
      county: addr.county || "",
      countyFips: addr.countyFipsCode || "",
      latitude: addr.latitude || 0,
      longitude: addr.longitude || 0,
      validated: addr.meta?.normalized || true,
    };
  }

  /**
   * Lookup property details with all attributes
   */
  async lookupProperty(
    address: string | AddressInput,
  ): Promise<BatchDataPropertyResponse> {
    const addressInput =
      typeof address === "string" ? this.parseAddress(address) : address;
    const response = await this.request<{ results: { properties: any[] } }>(
      "/property/lookup/all-attributes",
      { requests: [addressInput] },
    );
    // BatchData returns results.properties array, we take the first one
    const property = response.results.properties[0];
    if (!property) {
      throw new BatchDataAPIError(
        `Property not found`,
        404,
        "No property data returned",
      );
    }

    // Normalize property response to match expected format
    return this.normalizePropertyResponse(property);
  }

  /**
   * Normalize BatchData property response to expected format
   * Handles both production API and mock server responses
   */
  private normalizePropertyResponse(prop: any): BatchDataPropertyResponse {
    return {
      address: {
        standardizedAddress:
          prop.address?.street || prop.address?.streetNoUnit || "",
        streetNumber: prop.address?.houseNumber || "",
        streetName:
          prop.address?.streetName || prop.address?.formattedStreet || "",
        city: prop.address?.city || "",
        state: prop.address?.state || "",
        zipCode: prop.address?.zip || "",
        zipPlus4: prop.address?.zipPlus4 || "",
        county: prop.address?.county || "",
        countyFips: prop.address?.countyFipsCode || "",
        latitude: prop.address?.latitude || 0,
        longitude: prop.address?.longitude || 0,
        validated: true,
      },
      propertyType: prop.general?.propertyTypeDetail || "Single Family",
      bedrooms:
        prop.building?.bedroomCount ||
        prop.building?.calculatedBathroomCount ||
        0,
      bathrooms:
        prop.building?.bathroomCount ||
        prop.building?.calculatedBathroomCount ||
        0,
      squareFeet:
        prop.building?.totalBuildingAreaSquareFeet ||
        prop.building?.livingAreaSquareFeet ||
        0,
      lotSize: prop.lot?.lotSizeSquareFeet || 0,
      yearBuilt: prop.building?.yearBuilt || 0,
      lastSaleDate:
        prop.sale?.lastSale?.saleDate ||
        prop.deedHistory?.[0]?.saleDate ||
        null,
      lastSalePrice:
        prop.sale?.lastSale?.salePrice ||
        prop.deedHistory?.[0]?.salePrice ||
        null,
      taxAssessedValue:
        prop.assessment?.totalAssessedValue ||
        prop.assessment?.totalMarketValue ||
        0,
      taxAssessmentHistory: (prop.listing?.taxes || []).map((tax: any) => ({
        year: tax.year || 0,
        assessedValue: tax.amount || 0,
      })),
      zoning: prop.lot?.zoningCode || "",
      avm: {
        value: prop.valuation?.estimatedValue || 0,
        confidenceScore: prop.valuation?.confidenceScore || 0,
        valuationDate: prop.valuation?.asOfDate || new Date().toISOString(),
        lowEstimate: prop.valuation?.priceRangeMin || 0,
        highEstimate: prop.valuation?.priceRangeMax || 0,
      },
      preForeclosure: prop.foreclosure?.status ? true : false,
    };
  }

  /**
   * Search for properties matching criteria
   * Also used for comparable property search with compAddress
   */
  async searchProperties(
    searchCriteria: any,
    options?: any,
  ): Promise<BatchDataSearchResponse> {
    const requestBody: any = { searchCriteria };

    // Add options with 'take' parameter to limit results (per BatchData docs)
    if (options) {
      requestBody.options = {
        ...options,
        take: 5, // Get 5 high-quality comps (cost optimization)
        // Try to request all property details
        includePropertyDetails: true,
        fields: [
          "address",
          "building",
          "sale",
          "listing",
          "valuation",
          "assessment",
          "ids",
        ],
        // Sort by most recent sales first
        sort: {
          sortOrder: "desc",
          field: "lastSoldDate",
        },
      };
    } else {
      requestBody.options = {
        take: 5,
        includePropertyDetails: true,
        fields: [
          "address",
          "building",
          "sale",
          "listing",
          "valuation",
          "assessment",
          "ids",
        ],
        // Sort by most recent sales first
        sort: {
          sortOrder: "desc",
          field: "lastSoldDate",
        },
      };
    }

    // DEBUG: Log the exact request being sent
    console.log(
      "[BatchData] DEBUG: Request body being sent to /property/search:",
    );
    console.log(JSON.stringify(requestBody, null, 2));

    const response = await this.request<{ results: { properties: any[] } }>(
      "/property/search",
      requestBody,
    );

    // DEBUG: Log full raw response to see what BatchData is returning
    console.log("[BatchData] DEBUG: Full API response:");
    console.log(JSON.stringify(response, null, 2));

    // Normalize BatchData property objects to simplified format
    const rawProperties = response.results.properties || [];
    const normalizedProperties = rawProperties
      .map((prop: any) => {
      // Extract address string
      const addressStr =
        prop.address?.street ||
        `${prop.address?.houseNumber || ""} ${prop.address?.streetName || ""}`.trim() ||
        "Unknown";

      // Extract sale data - check multiple possible locations
      const lastSalePrice =
        prop.listing?.soldPrice ||
        prop.sale?.lastSale?.salePrice ||
        prop.valuation?.estimatedValue ||
        0;

      const lastSaleDate =
        prop.listing?.soldDate ||
        prop.sale?.lastSale?.saleDate ||
        prop.deedHistory?.[0]?.saleDate ||
        null;

      // Extract property characteristics
      // Prioritize livingAreaSquareFeet since that's what we filter on in the query
      const squareFeet =
        prop.building?.livingAreaSquareFeet ||
        prop.listing?.livingAreaSquareFeet ||
        prop.building?.totalBuildingAreaSquareFeet ||
        prop.listing?.totalBuildingAreaSquareFeet ||
        0;

      const lotSize = prop.lot?.lotSizeSquareFeet || 0;

      const bedrooms =
        prop.listing?.bedroomCount || prop.building?.bedroomCount || 0;

      const bathrooms =
        prop.listing?.bathroomCount || prop.building?.bathroomCount || 0;

      const yearBuilt = prop.building?.yearBuilt || prop.listing?.yearBuilt || 0;

      // Extract distance from BatchData API response
      const distance = prop.address?.distanceFromSubject || prop.distance || 0;

      // NEW: Extract valuation data
      const avmValue = prop.valuation?.estimatedValue || 0;
      const avmConfidence = prop.valuation?.confidenceScore || 0;
      const avmDate = prop.valuation?.asOfDate || new Date().toISOString();

      const taxAssessedValue =
        prop.assessment?.totalAssessedValue ||
        prop.assessment?.totalMarketValue ||
        0;

      const preForeclosure = prop.foreclosure?.status ? true : false;

      // NEW: Calculate derived metrics
      const pricePerSqft =
        squareFeet > 0 && lastSalePrice > 0 ? lastSalePrice / squareFeet : 0;

      const taxAssessmentRatio =
        taxAssessedValue > 0 && lastSalePrice > 0
          ? lastSalePrice / taxAssessedValue
          : 0;

      // Extract listing URL if available
      const listingUrl = prop.listing?.url || prop.listing?.listingUrl || null;

      return {
        address: addressStr,
        propertyType: prop.general?.propertyTypeDetail || "Single Family",
        bedrooms,
        bathrooms,
        squareFeet,
        yearBuilt: yearBuilt > 0 ? yearBuilt : undefined,
        lotSize: lotSize > 0 ? lotSize : undefined,
        lastSaleDate,
        lastSalePrice,
        distance,
        daysOnMarket: 0,
        // NEW: Include valuation metrics
        avm:
          avmValue > 0
            ? {
                value: avmValue,
                confidenceScore: avmConfidence,
                valuationDate: avmDate,
              }
            : undefined,
        taxAssessedValue: taxAssessedValue > 0 ? taxAssessedValue : undefined,
        preForeclosure: preForeclosure || undefined,
        pricePerSqft: pricePerSqft > 0 ? pricePerSqft : undefined,
        taxAssessmentRatio:
          taxAssessmentRatio > 0 ? taxAssessmentRatio : undefined,
        listingUrl: listingUrl || undefined,
      };
    })
      .filter((prop: any) => {
        // Filter out invalid comps that don't meet our minimum requirements
        if (prop.squareFeet === 0) {
          console.log(`[BatchData] Filtering out comp with 0 sqft: ${prop.address}`);
          return false;
        }
        if (prop.lastSalePrice === 0) {
          console.log(`[BatchData] Filtering out comp with no sale price: ${prop.address}`);
          return false;
        }
        return true;
      });

    return {
      properties: normalizedProperties,
      totalResults: normalizedProperties.length,
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
      minBedrooms?: number; // Relative: -1 means "subject bedrooms - 1"
      maxBedrooms?: number; // Relative: +1 means "subject bedrooms + 1"
      minBathrooms?: number; // Relative
      maxBathrooms?: number; // Relative
      minAreaPercent?: number; // Percentage: -20 means "80% of subject sqft"
      maxAreaPercent?: number; // Percentage: +20 means "120% of subject sqft"
      minYearBuilt?: number; // Relative: -10 means "subject year - 10"
      maxYearBuilt?: number; // Relative: +10 means "subject year + 10"
    },
  ): Promise<BatchDataSearchResponse> {
    const searchCriteria = {
      compAddress: {
        street: subjectAddress.street,
        city: subjectAddress.city,
        state: subjectAddress.state,
        zip: subjectAddress.zip,
      },
      building: {
        livingAreaSquareFeet: {
          min: 1, // CRITICAL: Only return comps with valid square footage
        },
      },
    };

    const searchOptions: any = {};

    // Distance filter
    if (options?.distanceMiles !== undefined) {
      searchOptions.useDistance = true;
      searchOptions.distanceMiles = options.distanceMiles;
    }

    // Bedrooms filter (relative values)
    if (
      options?.minBedrooms !== undefined ||
      options?.maxBedrooms !== undefined
    ) {
      searchOptions.useBedrooms = true;
      if (options.minBedrooms !== undefined)
        searchOptions.minBedrooms = options.minBedrooms;
      if (options.maxBedrooms !== undefined)
        searchOptions.maxBedrooms = options.maxBedrooms;
    }

    // Bathrooms filter (relative values)
    if (
      options?.minBathrooms !== undefined ||
      options?.maxBathrooms !== undefined
    ) {
      searchOptions.useBathrooms = true;
      if (options.minBathrooms !== undefined)
        searchOptions.minBathrooms = options.minBathrooms;
      if (options.maxBathrooms !== undefined)
        searchOptions.maxBathrooms = options.maxBathrooms;
    }

    // Area filter (percentage values)
    if (
      options?.minAreaPercent !== undefined ||
      options?.maxAreaPercent !== undefined
    ) {
      searchOptions.useArea = true;
      if (options.minAreaPercent !== undefined)
        searchOptions.minAreaPercent = options.minAreaPercent;
      if (options.maxAreaPercent !== undefined)
        searchOptions.maxAreaPercent = options.maxAreaPercent;
    }

    // Year built filter (relative values)
    if (
      options?.minYearBuilt !== undefined ||
      options?.maxYearBuilt !== undefined
    ) {
      searchOptions.useYearBuilt = true;
      if (options.minYearBuilt !== undefined)
        searchOptions.minYearBuilt = options.minYearBuilt;
      if (options.maxYearBuilt !== undefined)
        searchOptions.maxYearBuilt = options.maxYearBuilt;
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

    console.log(
      `[BatchData] Using ${useMock ? "MOCK" : "PRODUCTION"} endpoint: ${baseUrl}`,
    );

    batchDataClient = new BatchDataClient({ apiKey, baseUrl });
  }
  return batchDataClient;
}
