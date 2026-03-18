import { UnderwritingFormData, PropertyComps } from "@/types/underwriting";
import { CompsProvider, CompsProviderInterface, ProviderConfig } from "./types";

/**
 * RentCast Provider Implementation
 */
class RentCastProvider implements CompsProviderInterface {
  getName(): string {
    return "RentCast";
  }

  isAvailable(): boolean {
    return !!process.env.RENTCAST_API_KEY;
  }

  async getPropertyEstimates(formData: UnderwritingFormData): Promise<PropertyComps> {
    const { getRentCastPropertyEstimates } = await import("@/lib/rentcast/underwriting");
    return getRentCastPropertyEstimates(formData);
  }
}

/**
 * Realie Provider Implementation
 */
class RealieProvider implements CompsProviderInterface {
  getName(): string {
    return "Realie.ai";
  }

  isAvailable(): boolean {
    // Disabled - only use RentCast
    return false;
  }

  async getPropertyEstimates(formData: UnderwritingFormData): Promise<PropertyComps> {
    const { getRealiePropertyEstimates } = await import("@/lib/realie/underwriting");
    return getRealiePropertyEstimates(formData);
  }
}

/**
 * BatchData Provider Implementation (archived but can be re-enabled)
 */
class BatchDataProvider implements CompsProviderInterface {
  getName(): string {
    return "BatchData";
  }

  isAvailable(): boolean {
    // BatchData is currently archived
    return false;
  }

  async getPropertyEstimates(formData: UnderwritingFormData): Promise<PropertyComps> {
    throw new Error("BatchData provider is not currently available");
  }
}

/**
 * Provider Registry
 */
const providers: Record<CompsProvider, CompsProviderInterface> = {
  rentcast: new RentCastProvider(),
  realie: new RealieProvider(),
  batchdata: new BatchDataProvider(),
};

/**
 * Get the current provider configuration from environment
 */
function getProviderConfig(): ProviderConfig {
  // Check environment variable for provider preference
  const primaryProvider = (process.env.COMPS_PROVIDER || "rentcast") as CompsProvider;

  // Default fallback order: rentcast -> realie
  const fallback: CompsProvider[] = ["rentcast", "realie"].filter(
    p => p !== primaryProvider
  ) as CompsProvider[];

  return {
    primary: primaryProvider,
    fallback,
  };
}

/**
 * Get property estimates using the configured provider with fallback support
 */
export async function getPropertyEstimates(
  formData: UnderwritingFormData
): Promise<PropertyComps & { providerUsed: string }> {
  const config = getProviderConfig();
  const providersToTry = [config.primary, ...(config.fallback || [])];

  let lastError: Error | null = null;

  for (const providerName of providersToTry) {
    const provider = providers[providerName];

    if (!provider.isAvailable()) {
      console.log(`[Provider] ${provider.getName()} is not available (missing API key)`);
      continue;
    }

    try {
      console.log(`[Provider] Attempting to use ${provider.getName()}...`);
      const result = await provider.getPropertyEstimates(formData);
      console.log(`[Provider] ✅ Successfully used ${provider.getName()}`);

      return {
        ...result,
        providerUsed: provider.getName(),
      };
    } catch (error: any) {
      console.error(`[Provider] ❌ ${provider.getName()} failed:`, error.message);
      console.error(`[Provider] Error details:`, error);
      lastError = error;

      // If it's a critical error (invalid address, etc.), don't try fallback
      if (error.code === "INVALID_PARAMS" || error.code === "INVALID_ADDRESS") {
        throw error;
      }

      // Continue to next provider
      continue;
    }
  }

  // If we get here, all providers failed
  throw new Error(
    `All data providers failed. Last error: ${lastError?.message || "Unknown error"}`
  );
}

/**
 * Get list of available providers
 */
export function getAvailableProviders(): string[] {
  return Object.values(providers)
    .filter(p => p.isAvailable())
    .map(p => p.getName());
}

/**
 * Check if any provider is available
 */
export function hasAvailableProvider(): boolean {
  return Object.values(providers).some(p => p.isAvailable());
}
