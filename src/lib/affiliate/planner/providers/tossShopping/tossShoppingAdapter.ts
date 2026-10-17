import "server-only";

import type { AffiliateProviderAdapter } from "@/lib/affiliate/planner/adapters/types";
import { affiliateDefaultTitle } from "@/lib/affiliate/planner/copy";
import { tossCategoryForIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCategories";
import {
  createOrReuseTossSharelink,
  fetchTossCategoryBest,
  fetchTossProductDetails,
  type TossShoppingClientDeps,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingClient";
import {
  buildTossIntentContext,
  selectTossTravelGoodsIntents,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingIntent";
import { selectTossTravelGoodsCandidates } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingSelector";
import { sanitizeTossProductImageUrl } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingImage";
import type { TossTravelGoodsIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import {
  TOSS_DETAIL_CANDIDATE_LIMIT,
  TOSS_INTENT_CONCURRENCY,
  TOSS_SHOPPING_PROVIDER_ID,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type {
  AffiliateOfferBuild,
  AffiliateOfferTravelGoodsMetadata,
  AffiliateRoutingContext,
} from "@/lib/affiliate/planner/types";
import { safeHostnameFromUrl } from "@/lib/affiliate/travelpayouts/urlPolicy";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { mapWithConcurrency } from "@/lib/planner/placesClient";

export const TOSS_TRAVEL_GOODS_CTA = "토스쇼핑에서 보기";
export {
  TOSS_TRAVEL_GOODS_SECTION_DESCRIPTION,
  TOSS_TRAVEL_GOODS_SECTION_TITLE,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCategories";

export type TossShoppingAdapterDeps = TossShoppingClientDeps & {
  /** Override intent selection (tests). */
  selectIntents?: typeof selectTossTravelGoodsIntents;
};

export function isTossShoppingEligible(context: AffiliateRoutingContext): boolean {
  return (
    context.category === "travel_goods" &&
    context.placement === "preparation" &&
    !!context.destination.countryCode
  );
}

export function createTossShoppingAdapter(
  deps: TossShoppingAdapterDeps = {},
): AffiliateProviderAdapter {
  return {
    providerId: TOSS_SHOPPING_PROVIDER_ID,
    isEligible: isTossShoppingEligible,
    buildOffer: (context) => buildSingleTossOffer(context, deps),
  };
}

export const tossShoppingAdapter = createTossShoppingAdapter();

/**
 * Build up to 3 travel_goods offers for a trip (one product per intent).
 * Fail-soft: any Toss failure yields fewer/no cards without throwing.
 */
export async function buildTossTravelGoodsOfferBuilds(params: {
  routing: AffiliateRoutingContext;
  plan: PlannerPlan | null | undefined;
  hasRentalCarOffer: boolean;
  deps?: TossShoppingAdapterDeps;
}): Promise<AffiliateOfferBuild[]> {
  const intents = (params.deps?.selectIntents ?? selectTossTravelGoodsIntents)(
    buildTossIntentContext({
      routing: params.routing,
      plan: params.plan,
      hasRentalCarOffer: params.hasRentalCarOffer,
    }),
  );
  if (intents.length === 0) return [];

  const builds = await mapWithConcurrency(
    intents,
    TOSS_INTENT_CONCURRENCY,
    async (intent) => buildOfferForIntent(intent, params.routing, params.deps ?? {}),
  );

  const seenIntents = new Set<string>();
  const seenTitles = new Set<string>();
  const out: AffiliateOfferBuild[] = [];
  for (const build of builds) {
    if (!build) continue;
    const intent = build.metadata?.travelGoods?.intent;
    if (intent) {
      if (seenIntents.has(intent)) continue;
      seenIntents.add(intent);
    }
    const titleKey = build.title.trim().toLowerCase();
    if (titleKey && seenTitles.has(titleKey)) continue;
    if (titleKey) seenTitles.add(titleKey);
    out.push(build);
  }
  return out.slice(0, 3);
}

async function buildSingleTossOffer(
  context: AffiliateRoutingContext,
  deps: TossShoppingAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  if (!isTossShoppingEligible(context)) return null;
  const builds = await buildTossTravelGoodsOfferBuilds({
    routing: context,
    plan: null,
    hasRentalCarOffer: false,
    deps,
  });
  return builds[0] ?? null;
}

async function buildOfferForIntent(
  intent: TossTravelGoodsIntent,
  routing: AffiliateRoutingContext,
  deps: TossShoppingAdapterDeps,
): Promise<AffiliateOfferBuild | null> {
  try {
    const category = tossCategoryForIntent(intent);
    const products = await fetchTossCategoryBest(category.categoryId, deps);
    if (!products?.length) return null;

    const ranked = selectTossTravelGoodsCandidates(products).slice(0, TOSS_DETAIL_CANDIDATE_LIMIT);
    if (ranked.length === 0) return null;

    const details = await fetchTossProductDetails(
      ranked.map((p) => p.tacaItemId),
      deps,
    );
    if (!details) return null;

    const detailById = new Map(details.map((d) => [d.tacaItemId, d]));
    let chosen: {
      tacaItemId: number;
      displayName: string;
      thumbnailUrl: string | null;
    } | null = null;

    for (const candidate of ranked) {
      const detail = detailById.get(candidate.tacaItemId);
      if (!detail) continue;
      if (detail.tacaItemId !== candidate.tacaItemId) continue;
      if (detail.isSoldOut) continue;
      if (!detail.displayName?.trim()) continue;
      chosen = {
        tacaItemId: detail.tacaItemId,
        displayName: detail.displayName.trim(),
        thumbnailUrl: detail.thumbnailUrl ?? candidate.thumbnailUrl,
      };
      break;
    }
    if (!chosen) return null;

    const sharelink = await createOrReuseTossSharelink(chosen.tacaItemId, deps);
    if (!sharelink?.targetUrl) return null;

    const imageUrl = sanitizeTossProductImageUrl(chosen.thumbnailUrl);
    const description = descriptionForIntent(intent);
    const travelGoods: AffiliateOfferTravelGoodsMetadata = {
      intent,
      ...(imageUrl ? { imageUrl } : {}),
    };

    return {
      providerId: TOSS_SHOPPING_PROVIDER_ID,
      category: "travel_goods",
      placement: "preparation",
      title: chosen.displayName,
      description,
      ctaLabel: TOSS_TRAVEL_GOODS_CTA,
      destinationLabel: routing.destination.text,
      targetUrl: sharelink.targetUrl,
      affiliateNetwork: "toss",
      sourceUrlHost: safeHostnameFromUrl(sharelink.targetUrl),
      metadata: { travelGoods },
    };
  } catch {
    console.info("[toss_shopping] offer_skipped", {
      providerId: "toss_shopping",
      errorCode: "intent_build_failed",
      intent,
    });
    return null;
  }
}

function descriptionForIntent(intent: TossTravelGoodsIntent): string {
  const label = tossCategoryForIntent(intent).labelKo;
  switch (intent) {
    case "car_charger":
      return "렌터카 여행에 필요한 차량용 충전기";
    case "waterproof_pouch":
      return `${label} — 물놀이·해변 일정에 챙겨두면 좋아요.`;
    case "power_bank":
      return `${label} — 해외 일정 중 충전이 필요할 때 확인해 보세요.`;
    case "luggage":
      return `${label} — 긴 일정에 맞춰 준비물을 확인해 보세요.`;
    case "travel_adapter":
      return `${label} — 여행 전에 규격을 확인해 보세요.`;
    default:
      return affiliateDefaultTitle("travel_goods", null);
  }
}
