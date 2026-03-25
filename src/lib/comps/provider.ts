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
 * Get property estimates using RentCast (no fallback)
 */
export async function getPropertyEstimates(
  formData: UnderwritingFormData
): Promise<PropertyComps & { providerUsed: string }> {
  const providerName = (process.env.COMPS_PROVIDER || "rentcast") as CompsProvider;
  const provider = providers[providerName];

  if (!provider.isAvailable()) {
    throw new Error(`${provider.getName()} is not available (missing API key)`);
  }

  console.log(`[Provider] Using ${provider.getName()}...`);
  const result = await provider.getPropertyEstimates(formData);
  console.log(`[Provider] ✅ Successfully used ${provider.getName()}`);

  return {
    ...result,
    providerUsed: provider.getName(),
  };
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
