import { UnderwritingFormData, PropertyComps } from "@/types/underwriting";

/**
 * Supported data providers for comparables
 */
export type CompsProvider = "rentcast" | "realie" | "batchdata";

/**
 * Provider configuration
 */
export interface ProviderConfig {
  primary: CompsProvider;
  fallback?: CompsProvider[];
}

/**
 * Common interface that all providers must implement
 */
export interface CompsProviderInterface {
  getPropertyEstimates(formData: UnderwritingFormData): Promise<PropertyComps>;
  isAvailable(): boolean;
  getName(): string;
}
