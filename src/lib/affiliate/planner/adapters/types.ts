import type {
  AffiliateOfferBuild,
  AffiliateProviderDefinition,
  AffiliateProviderId,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";

export type AffiliateProviderAdapter = {
  providerId: AffiliateProviderId;
  isEligible: (context: AffiliateRoutingContext) => boolean;
  buildOffer: (context: AffiliateRoutingContext) => AffiliateOfferBuild | null;
};

export type AffiliateProviderBundle = {
  definition: AffiliateProviderDefinition;
  adapter: AffiliateProviderAdapter | null;
};
