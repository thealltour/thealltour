import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { affiliateCtaLabel } from "@/lib/affiliate/planner/copy";
import {
  fetchWeGoTripPopularProducts,
  loadWeGoTripCapabilities,
  type WeGoTripClientDeps,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripClient";
import { resolveWeGoTripCity } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripResolver";
import {
  buildWeGoTripProductUrl,
  selectWeGoTripProduct,
} from "@/lib/affiliate/planner/providers/wegotrip/weGoTripSelector";
import { WEGOTRIP_ALLOWED_HOSTS } from "@/lib/affiliate/planner/providers/wegotrip/weGoTripTypes";
import type { AffiliateOfferBuild, AffiliateRoutingContext } from "@/lib/affiliate/planner/types";
import {
  createTravelpayoutsCommerceTarget,
  type CreateTravelpayoutsCommerceTargetInput,
} from "@/lib/affiliate/travelpayouts/commerceService";
import { travelpayoutsSafeLogMeta } from "@/lib/affiliate/travelpayouts/errors";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";

export type WeGoTripAdapterDeps = WeGoTripClientDeps & {
  createCommerceTarget?: (
    input: CreateTravelpayoutsCommerceTargetInput,
  ) => ReturnType<typeof createTravelpayoutsCommerceTarget>;
};

export function isWeGoTripEligible(context: AffiliateRoutingContext): boolean {
  return context.category === "activity" && context.placement === "day_item";
}

export function createWeGoTripAdapter(deps: WeGoTripAdapterDeps = {}): AffiliateProviderAdapter {
  return {
    providerId: "wegotrip",
    isEligible: isWeGoTripEligible,
    buildOffer: async (context) => buildWeGoTripOffer(context, deps),
  };
}

export const weGoTripAdapter = createWeGoTripAdapter();

async function buildWeGoTripOffer(
  context: AffiliateRoutingContext,
  deps: WeGoTripAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  if (!isWeGoTripEligible(context)) return null;

  const destinationText = context.destination.text.trim();
  if ([...destinationText].length < 3) return null;

  const city = await resolveWeGoTripCity({ destinationText, deps });
  if (!city) return null;

  const caps = await loadWeGoTripCapabilities(deps);
  const productsResult = await fetchWeGoTripPopularProducts({
    cityId: city.id,
    lang: caps.preferredLang,
    currency: caps.preferredCurrency,
    deps,
  });
  if (!productsResult.ok || productsResult.data.length === 0) return null;

  const selection = selectWeGoTripProduct({
    products: productsResult.data,
    placeName: context.placeName,
  });
  if (!selection) return null;
  const selected = selection.product;

  const sourceUrl = buildWeGoTripProductUrl(selected);
  if (!sourceUrl) return null;

  const createCommerce = deps.createCommerceTarget ?? createTravelpayoutsCommerceTarget;
  try {
    const commerce = await createCommerce({
      sourceUrl,
      providerId: "wegotrip",
      allowedHosts: [...WEGOTRIP_ALLOWED_HOSTS],
    });

    const destinationLabel = context.destination.text;
    const title = selection.placeMatched
      ? selected.title
      : `${destinationLabel}에서 즐길 수 있는 투어`;

    return {
      providerId: "wegotrip",
      category: "activity",
      placement: "day_item",
      title,
      description: "여행 일정과 함께 예약 가능한 투어를 확인해 보세요.",
      ctaLabel: affiliateCtaLabel("activity"),
      destinationLabel,
      targetUrl: commerce.affiliateUrl,
      dayNumber: context.dayNumber ?? null,
      itemOrder: context.itemOrder ?? null,
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
      "[wegotrip] commerce_failed",
      travelpayoutsSafeLogMeta({
        providerId: "wegotrip",
        hostname: safeHostnameFromUrl(sourceUrl),
        errorCode: code,
      }),
    );
    return null;
  }
}
