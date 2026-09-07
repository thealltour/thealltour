export {
  getTravelpayoutsConfig,
  hasTravelpayoutsConfig,
  TRAVELPAYOUTS_PARTNER_LINKS_URL,
} from "@/lib/affiliate/travelpayouts/config";
export {
  createTravelpayoutsSubId,
  validateTravelpayoutsSubId,
} from "@/lib/affiliate/travelpayouts/subId";
export { TravelpayoutsError, type TravelpayoutsErrorCode } from "@/lib/affiliate/travelpayouts/errors";
export {
  validateAffiliateSourceUrl,
  validateGeneratedAffiliateUrl,
  hostMatchesAllowlist,
} from "@/lib/affiliate/travelpayouts/urlPolicy";
export { createTravelpayoutsPartnerLink } from "@/lib/affiliate/travelpayouts/partnerLinksClient";
export { createTravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";
export type { TravelpayoutsPartnerLinkResult } from "@/lib/affiliate/travelpayouts/types";
export type { TravelpayoutsCommerceTarget } from "@/lib/affiliate/travelpayouts/commerceService";
