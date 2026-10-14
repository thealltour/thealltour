import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  applyAffiliateProviderEnvOverrides,
  PLANNER_AFFILIATE_DESTINATION_OVERRIDES,
  PLANNER_AFFILIATE_PROVIDER_CATALOG,
} from "@/lib/affiliate/planner/providerConfig";
import type { EnvBag } from "@/lib/envBag";
import { airaloAdapter } from "@/lib/affiliate/planner/providers/airalo/airaloAdapter";
import { aviasalesAdapter } from "@/lib/affiliate/planner/providers/aviasales/aviasalesAdapter";
import { stay22Adapter } from "@/lib/affiliate/planner/providers/stay22/stay22Adapter";
import { weGoTripAdapter } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripAdapter";
import type { AffiliateProviderDefinition } from "@/lib/affiliate/planner/types";

/**
 * Production registry — adapters registered for Airalo + WeGoTrip + Aviasales + Stay22.
 * enabled = catalog default + per-provider env override; map order carries no priority.
 */
export function getProductionAffiliateProviderDefinitions(
  env: EnvBag = process.env,
): AffiliateProviderDefinition[] {
  return applyAffiliateProviderEnvOverrides(PLANNER_AFFILIATE_PROVIDER_CATALOG, env);
}

export function getProductionAffiliateAdapters(): Map<string, AffiliateProviderAdapter> {
  return new Map<string, AffiliateProviderAdapter>([
    ["airalo", airaloAdapter],
    ["wegotrip", weGoTripAdapter],
    ["aviasales", aviasalesAdapter],
    ["stay22", stay22Adapter],
  ]);
}

export function getProductionDestinationOverrides() {
  return PLANNER_AFFILIATE_DESTINATION_OVERRIDES;
}
