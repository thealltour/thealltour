export type {
  AffiliateCategory,
  AffiliateOffer,
  AffiliatePlacement,
  AffiliateProviderDefinition,
  AffiliateRoutingContext,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";

export { routeAffiliateOffer, isSafeHttpsUrl } from "@/lib/affiliate/planner/router";
export { checkStaticEligibility, itemTypeToAffiliateCategory } from "@/lib/affiliate/planner/eligibility";
export { rankAffiliateProviders } from "@/lib/affiliate/planner/ranking";
export { resolveAffiliateDestination, extractIsoCountryCode } from "@/lib/affiliate/planner/destinationResolver";
export {
  getProductionAffiliateAdapters,
  getProductionAffiliateProviderDefinitions,
} from "@/lib/affiliate/planner/registry";
