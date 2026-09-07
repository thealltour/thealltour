import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { isValidIataCode, normalizeIataCode } from "@/lib/affiliate/planner/providers/aviasales/aviasalesAutocompleteClient";
import {
  fetchAviasalesPricesForDates,
  type AviasalesDataClientDeps,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesDataClient";
import { resolveAviasalesDestinationIata } from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import {
  selectAviasalesPriceOffer,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesSelector";
import { AVIASALES_ALLOWED_HOSTS } from "@/lib/affiliate/planner/providers/aviasales/aviasalesTypes";
import type { AffiliateOfferBuild, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import {
  createTravelpayoutsCommerceTarget,
  type CreateTravelpayoutsCommerceTargetInput,
} from "@/lib/affiliate/travelpayouts/commerceService";
import { travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

/** Copy-safe labels — no 실시간/현재/최저가; no price/airline on client DTO. */
export const AVIASALES_OFFER_TITLE = "항공권 가격 확인";
export const AVIASALES_OFFER_CTA = "항공권 보기";
export const AVIASALES_OFFER_DESCRIPTION =
  "여행 일정에 맞춰 항공권 검색 결과를 확인해 보세요.";

export type AviasalesAdapterDeps = AviasalesDataClientDeps & {
  createCommerceTarget?: (
    input: CreateTravelpayoutsCommerceTargetInput,
  ) => ReturnType<typeof createTravelpayoutsCommerceTarget>;
};

export function isAviasalesEligible(context: AffiliateRoutingContext): boolean {
  if (context.category !== "flight") return false;
  if (context.placement !== "planner_summary") return false;
  if (context.dates.mode !== "fixed") return false;
  if (!context.dates.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(context.dates.startDate)) {
    return false;
  }
  const origin = context.flightOrigin;
  if (!origin || !isValidIataCode(origin.iata)) return false;
  return true;
}

export function createAviasalesAdapter(deps: AviasalesAdapterDeps = {}): AffiliateProviderAdapter {
  return {
    providerId: "aviasales",
    isEligible: isAviasalesEligible,
    buildOffer: async (context) => buildAviasalesOffer(context, deps),
  };
}

export const aviasalesAdapter = createAviasalesAdapter();

async function buildAviasalesOffer(
  context: AffiliateRoutingContext,
  deps: AviasalesAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  if (!isAviasalesEligible(context)) return null;

  const originIata = normalizeIataCode(context.flightOrigin!.iata);
  const destinationText = context.destination.text.trim();
  if ([...destinationText].length < 2) return null;

  const dest = await resolveAviasalesDestinationIata({
    destinationText,
    countryCode: context.destination.countryCode,
    deps,
  });
  if (!dest) return null;

  const departureAt = context.dates.startDate!;
  const returnAt =
    context.dates.endDate && /^\d{4}-\d{2}-\d{2}$/.test(context.dates.endDate)
      ? context.dates.endDate
      : null;
  const oneWay = !returnAt;

  const prices = await fetchAviasalesPricesForDates({
    origin: originIata,
    destination: dest.iata,
    departureAt,
    returnAt,
    oneWay,
    deps,
  });
  if (!prices.ok || prices.data.length === 0) return null;

  const selection = selectAviasalesPriceOffer({ offers: prices.data });
  if (!selection) {
    console.info(
      "[aviasales] commerce_target_pending",
      travelpayoutsSafeLogMeta({
        providerId: "aviasales",
        errorCode: "no_usable_search_link",
      }),
    );
    return null;
  }

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl: selection.sourceUrl,
      providerId: "aviasales",
      allowedHosts: [...AVIASALES_ALLOWED_HOSTS],
    });

    return {
      providerId: "aviasales",
      category: "flight",
      placement: "planner_summary",
      title: AVIASALES_OFFER_TITLE,
      description: AVIASALES_OFFER_DESCRIPTION,
      ctaLabel: AVIASALES_OFFER_CTA,
      destinationLabel: context.destination.text,
      targetUrl: commerce.affiliateUrl,
      providerSubId: commerce.providerSubId,
      affiliateNetwork: commerce.affiliateNetwork,
      affiliateCampaignId: commerce.campaignId ?? null,
      sourceUrlHost: commerce.sourceUrlHost || safeHostnameFromUrl(selection.sourceUrl),
    };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code: unknown }).code)
        : "commerce_failed";
    console.info(
      "[aviasales] commerce_failed",
      travelpayoutsSafeLogMeta({
        providerId: "aviasales",
        hostname: safeHostnameFromUrl(selection.sourceUrl),
        errorCode: code,
      }),
    );
    return null;
  }
}
