import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { affiliateCtaLabel, affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import {
  buildStay22RoamUrl,
  STAY22_HOST,
  STAY22_PLANNER_HOTEL_CAMPAIGN,
} from "@/lib/affiliate/planner/providers/stay22/stay22Url";
import type { AffiliateOfferBuild, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import type { EnvBag } from "@/lib/envBag";

export const STAY22_HOTEL_DESCRIPTION = "여행 일정과 인원에 맞는 숙소 검색 결과를 확인해 보세요.";

export type Stay22AdapterDeps = {
  /** Test injection; defaults to process.env (reads STAY22_AID only). */
  env?: EnvBag;
};

/** Global trip hotel offer: fixed dates + destination text + at least one adult. */
export function isStay22Eligible(context: AffiliateRoutingContext): boolean {
  return (
    context.category === "hotel" &&
    context.placement === "planner_summary" &&
    context.dates.mode === "fixed" &&
    !!context.dates.startDate &&
    !!context.dates.endDate &&
    context.destination.text.trim().length > 0 &&
    context.travelers.adults >= 1
  );
}

export function createStay22Adapter(deps: Stay22AdapterDeps = {}): AffiliateProviderAdapter {
  return {
    providerId: "stay22",
    isEligible: isStay22Eligible,
    buildOffer: (context) => buildStay22Offer(context, deps),
  };
}

export const stay22Adapter = createStay22Adapter();

function buildStay22Offer(
  context: AffiliateRoutingContext,
  deps: Stay22AdapterDeps,
): AffiliateOfferBuild | null {
  if (!isStay22Eligible(context)) return null;

  const env = deps.env ?? process.env;
  const destinationLabel = context.destination.text.trim();
  const result = buildStay22RoamUrl({
    aid: env.STAY22_AID,
    address: destinationLabel,
    checkin: context.dates.startDate,
    checkout: context.dates.endDate,
    adults: context.travelers.adults,
    children: context.travelers.children,
    campaign: STAY22_PLANNER_HOTEL_CAMPAIGN,
  });
  if (!result.ok) {
    console.info("[stay22] offer_skipped", { providerId: "stay22", errorCode: result.reason });
    return null;
  }

  return {
    providerId: "stay22",
    category: "hotel",
    placement: "planner_summary",
    title: affiliateDefaultTitle("hotel", destinationLabel),
    description: STAY22_HOTEL_DESCRIPTION,
    ctaLabel: affiliateCtaLabel("hotel"),
    destinationLabel,
    targetUrl: result.url,
    dayNumber: null,
    itemOrder: null,
    providerSubId: null,
    affiliateNetwork: null,
    affiliateCampaignId: STAY22_PLANNER_HOTEL_CAMPAIGN,
    sourceUrlHost: STAY22_HOST,
  };
}
