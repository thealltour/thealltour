import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  PLANNER_AFFILIATE_DESTINATION_OVERRIDES,
  PLANNER_AFFILIATE_PROVIDER_CATALOG,
} from "@/lib/affiliate/planner/providerConfig";
import type { AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";

/**
 * Production registry — catalog only; adapters empty until PR-9.
 * Fake/test adapters must never be registered here.
 */
export function getProductionAffiliateProviderDefinitions(): AffiliateProviderDefinition[] {
  return PLANNER_AFFILIATE_PROVIDER_CATALOG;
}

export function getProductionAffiliateAdapters(): Map<string, AffiliateProviderAdapter> {
  return new Map();
}

export function getProductionDestinationOverrides() {
  return PLANNER_AFFILIATE_DESTINATION_OVERRIDES;
}
