import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { checkStaticEligibility, normalizeDestinationKey } from "@/lib/affiliate/planner/eligibility";
import type { AffiliateDestinationOverride } from "@/lib/affiliate/planner/providerConfig";
import { rankAffiliateProviders } from "@/lib/affiliate/planner/ranking";
import type {
  AffiliateOfferBuild,
  AffiliateProviderDefinition,
  AffiliateRoutingContext,
  AffiliateRoutingDecision,
} from "@/lib/affiliate/planner/types";

export type RouteAffiliateOfferParams = {
  context: AffiliateRoutingContext;
  providers: AffiliateProviderDefinition[];
  adapters: Map<string, AffiliateProviderAdapter>;
  overrides?: AffiliateDestinationOverride[];
};

/**
 * Deterministic Router v0:
 * eligibility → priority rank → adapter build with fallback → single best offer.
 */
export function routeAffiliateOffer(
  params: RouteAffiliateOfferParams,
): { offer: AffiliateOfferBuild | null; decision: AffiliateRoutingDecision } {
  const { context, providers, adapters, overrides = [] } = params;
  const rejectedReasons: AffiliateRoutingDecision["rejectedReasons"] = [];
  const eligible: AffiliateProviderDefinition[] = [];

  for (const def of providers) {
    const staticCheck = checkStaticEligibility({ definition: def, context, overrides });
    if (!staticCheck.ok) {
      rejectedReasons.push({ providerId: def.id, reason: staticCheck.reason });
      continue;
    }
    const adapter = adapters.get(def.id);
    if (!adapter) {
      rejectedReasons.push({ providerId: def.id, reason: "adapter_missing" });
      continue;
    }
    if (!adapter.isEligible(context)) {
      rejectedReasons.push({ providerId: def.id, reason: "adapter_ineligible" });
      continue;
    }
    eligible.push(def);
  }

  const destKey =
    context.destination.countryCode?.toUpperCase() ??
    normalizeDestinationKey(context.destination.text);

  const ranked = rankAffiliateProviders({
    definitions: eligible,
    category: context.category,
    destinationKey: destKey,
    overrides,
  });

  for (const def of ranked) {
    const adapter = adapters.get(def.id)!;
    try {
      const built = adapter.buildOffer(context);
      if (!built || !isSafeHttpsUrl(built.targetUrl)) {
        rejectedReasons.push({ providerId: def.id, reason: "offer_build_failed" });
        continue;
      }
      return {
        offer: built,
        decision: {
          selectedProviderId: def.id,
          category: context.category,
          placement: context.placement,
          eligibleProviderIds: ranked.map((p) => p.id),
          rejectedReasons,
        },
      };
    } catch {
      rejectedReasons.push({ providerId: def.id, reason: "offer_build_threw" });
    }
  }

  return {
    offer: null,
    decision: {
      selectedProviderId: null,
      category: context.category,
      placement: context.placement,
      eligibleProviderIds: ranked.map((p) => p.id),
      rejectedReasons,
    },
  };
}

export function isSafeHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}
