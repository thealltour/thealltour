import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  PLANNER_AFFILIATE_DESTINATION_OVERRIDES,
  PLANNER_AFFILIATE_PROVIDER_CATALOG,
} from "@/lib/affiliate/planner/providerConfig";
import { airaloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { aviasalesAdapter } from "@/lib/affiliate/planner/providers/aviasales/aviasalesAdapter";
import { weGoTripAdapter } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripAdapter";
import type { AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";

/**
 * Production registry — adapters registered for Airalo + WeGoTrip + Aviasales.
 * enabled flags stay false until live verification / origin UI (Aviasales).
 */
export function getProductionAffiliateProviderDefinitions(): AffiliateProviderDefinition[] {
  return PLANNER_AFFILIATE_PROVIDER_CATALOG;
}

export function getProductionAffiliateAdapters(): Map<string, AffiliateProviderAdapter> {
  return new Map<string, AffiliateProviderAdapter>([
    ["airalo", airaloAdapter],
    ["wegotrip", weGoTripAdapter],
    ["aviasales", aviasalesAdapter],
  ]);
}

export function getProductionDestinationOverrides() {
  return PLANNER_AFFILIATE_DESTINATION_OVERRIDES;
}
