import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  affiliateCtaLabel,
  affiliateDefaultTitle,
} from "@/lib/affiliate/planner/copy";
import type {
  AffiliateOfferBuild,
  AffiliateProviderDefinition,
  AffiliateProviderId,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";

/** Test-only fixtures — never register in production registry. */
export function createFakeAffiliateDefinition(
  overrides: Partial<AffiliateProviderDefinition> & { id: AffiliateProviderId },
): AffiliateProviderDefinition {
  return {
    displayName: overrides.displayName ?? overrides.id,
    categories: overrides.categories ?? ["activity"],
    enabled: overrides.enabled ?? true,
    supportedDateModes: overrides.supportedDateModes ?? ["fixed", "flexible"],
    supportedPlacements: overrides.supportedPlacements ?? [
      "planner_summary",
      "day_item",
      "preparation",
      "transport",
    ],
    priority: overrides.priority ?? 50,
    network: overrides.network,
    capabilities: overrides.capabilities ?? {
      deepLink: true,
      search: false,
      api: false,
      widget: false,
    },
    supportedCountries: overrides.supportedCountries,
    excludedCountries: overrides.excludedCountries,
    id: overrides.id,
  };
}

export function createFakeAffiliateAdapter(params: {
  providerId: AffiliateProviderId;
  eligible?: boolean;
  failBuild?: boolean;
  throwBuild?: boolean;
  async?: boolean;
  targetUrl?: string;
  onBuild?: () => void;
}): AffiliateProviderAdapter {
  const buildSync = (context: AffiliateRoutingContext): AffiliateOfferBuild | null => {
    params.onBuild?.();
    if (params.throwBuild) throw new Error("build boom");
    if (params.failBuild) return null;
    const title = affiliateDefaultTitle(context.category, context.destination.text);
    return {
      providerId: params.providerId,
      category: context.category,
      placement: context.placement,
      title,
      description: null,
      ctaLabel: affiliateCtaLabel(context.category),
      destinationLabel: context.destination.text,
      targetUrl: params.targetUrl ?? "https://example.com/offer",
      dayNumber: context.dayNumber ?? null,
      itemOrder: context.itemOrder ?? null,
    };
  };

  return {
    providerId: params.providerId,
    isEligible: () => params.eligible !== false,
    buildOffer: (context) => {
      if (params.async) {
        return Promise.resolve().then(() => buildSync(context));
      }
      return buildSync(context);
    },
  };
}
