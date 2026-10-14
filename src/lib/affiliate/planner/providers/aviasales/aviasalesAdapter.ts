import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import {
  isValidIataCode,
  normalizeIataCode,
  type AviasalesAutocompleteClientDeps,
} from "@/lib/affiliate/planner/providers/aviasales/aviasalesAutocompleteClient";
import { resolveAviasalesDestinationIata } from "@/lib/affiliate/planner/providers/aviasales/aviasalesDestinationResolver";
import {
  aviasalesPassengerSuffix,
  buildAviasalesCanonicalSearchUrl,
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

/**
 * The CTA path never calls the Data API (prices_for_dates): its rows are sparse single-passenger
 * fares and the lookup only added latency. The data client stays for smoke/diagnostics.
 */
export type AviasalesAdapterDeps = AviasalesAutocompleteClientDeps & {
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

  if (!aviasalesPassengerSuffix(context.travelers)) {
    console.info(
      "[aviasales] offer_skipped",
      travelpayoutsSafeLogMeta({ providerId: "aviasales", errorCode: "unsupported_travelers" }),
    );
    return null;
  }

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

  const search = buildAviasalesCanonicalSearchUrl({
    originIata,
    destinationIata: dest.iata,
    departureDate: departureAt,
    returnDate: returnAt,
    adults: context.travelers.adults,
    children: context.travelers.children,
  });
  if (!search.ok) {
    console.info(
      "[aviasales] offer_skipped",
      travelpayoutsSafeLogMeta({ providerId: "aviasales", errorCode: search.reason }),
    );
    return null;
  }
  const sourceUrl = search.url;

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl,
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
      sourceUrlHost: commerce.sourceUrlHost || safeHostnameFromUrl(sourceUrl),
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
        hostname: safeHostnameFromUrl(sourceUrl),
        errorCode: code,
      }),
    );
    return null;
  }
}
