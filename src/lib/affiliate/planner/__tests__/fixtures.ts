import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  affiliateCtaLabel,
  affiliateDefaultTitle,
} from "@/lib/affiliate/planner/copy";
import type {
  AffiliateProviderDefinition,
  AffiliateProviderId,
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
  targetUrl?: string;
}): AffiliateProviderAdapter {
  return {
    providerId: params.providerId,
    isEligible: () => params.eligible !== false,
    buildOffer: (context) => {
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
    },
  };
}
