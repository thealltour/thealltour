import type {
  AffiliateOfferBuild,
  AffiliateProviderDefinition,
  AffiliateProviderId,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";

/**
 * Adapter contract (PR-9B):
 * - isEligible stays sync for cheap static/context checks (no network).
 * - buildOffer may be sync or async so Partner Links / provider APIs can run inside.
 * Sync return values remain supported for tests and static adapters.
 *
 * Timeouts: network clients own AbortController/timeouts (e.g. Partner Links).
 * The router does not cancel hanging buildOffer promises.
 */
export type AffiliateProviderAdapter = {
  providerId: AffiliateProviderId;
  isEligible: (context: AffiliateRoutingContext) => boolean;
  buildOffer: (
    context: AffiliateRoutingContext,
  ) => AffiliateOfferBuild | null | Promise<AffiliateOfferBuild | null>;
};

export type AffiliateProviderBundle = {
  definition: AffiliateProviderDefinition;
  adapter: AffiliateProviderAdapter | null;
};
