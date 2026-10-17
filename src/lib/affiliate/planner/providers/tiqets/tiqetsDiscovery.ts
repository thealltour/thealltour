import "server-only";

import type {
  PlannerActivityIntent,
  TiqetsProductWidgetDescriptor,
  TiqetsProductWidgetItem,
} from "@/lib/affiliate/planner/discovery/types";
import { matchTiqetsCandidate } from "@/lib/affiliate/planner/providers/tiqets/tiqetsCandidateMatcher";
import {
  searchTiqetsSuggest,
  type TiqetsSuggestClientDeps,
} from "@/lib/affiliate/planner/providers/tiqets/tiqetsSuggestClient";
import { lookupTiqetsVerifiedProduct } from "@/lib/affiliate/planner/providers/tiqets/tiqetsVerifiedProducts";
import { TIQETS_WIDGET_MAX_PRODUCTS } from "@/lib/affiliate/planner/discovery/tpWidgetSrc";
import { mapWithConcurrency } from "@/lib/planner/placesClient";

export { TIQETS_WIDGET_MAX_PRODUCTS };
const TIQETS_SUGGEST_CONCURRENCY = 2;

export type TiqetsDiscoveryStats = {
  requestCount: number;
  verifiedHitCount: number;
  suggestCallCount: number;
  suggestMatchCount: number;
  suggestMissCount: number;
  suggestErrorCount: number;
};

export type TiqetsDiscoveryDeps = {
  searchSuggest?: typeof searchTiqetsSuggest;
  suggestDeps?: TiqetsSuggestClientDeps;
};

function emptyStats(requestCount: number): TiqetsDiscoveryStats {
  return {
    requestCount,
    verifiedHitCount: 0,
    suggestCallCount: 0,
    suggestMatchCount: 0,
    suggestMissCount: 0,
    suggestErrorCount: 0,
  };
}

function toItem(
  intent: PlannerActivityIntent,
  product: { productId: string; title: string },
  matchConfidence: TiqetsProductWidgetItem["matchConfidence"],
): TiqetsProductWidgetItem {
  return {
    providerId: "tiqets",
    productId: product.productId,
    title: product.title,
    matchConfidence,
    dayNumber: intent.dayNumber,
    itemOrder: intent.itemOrder,
  };
}

/**
 * Per intent: destination guard → verified catalog → (suggest ON) one suggest call → matcher.
 * Only exact/high results are kept; deduped by productId; exact first, then mustDo order; max 3.
 * Suggest failures only drop that intent's result.
 */
export async function discoverTiqetsProducts(params: {
  intents: readonly PlannerActivityIntent[];
  destination: { countryCode: string | null; cityEnglish: string | null };
  suggestEnabled: boolean;
  deps?: TiqetsDiscoveryDeps;
}): Promise<{ descriptor: TiqetsProductWidgetDescriptor | null; stats: TiqetsDiscoveryStats }> {
  const stats = emptyStats(params.intents.length);
  const countryCode = params.destination.countryCode?.toUpperCase() ?? null;
  if (!countryCode || params.intents.length === 0) return { descriptor: null, stats };

  const destinationScope = `${countryCode}|${params.destination.cityEnglish ?? ""}`;
  const searchSuggest = params.deps?.searchSuggest ?? searchTiqetsSuggest;

  type Found = { item: TiqetsProductWidgetItem; requestIndex: number };
  const found: Found[] = [];
  const suggestQueue: PlannerActivityIntent[] = [];
  for (const intent of params.intents) {
    const verified = lookupTiqetsVerifiedProduct({
      labels: [intent.planItemName, intent.rawLabel],
      destination: { countryCode, cityEnglish: params.destination.cityEnglish },
    });
    if (verified) {
      stats.verifiedHitCount += 1;
      found.push({ item: toItem(intent, verified, "exact"), requestIndex: intent.requestIndex });
    } else if (params.suggestEnabled) {
      suggestQueue.push(intent);
    }
  }

  const suggested = await mapWithConcurrency(
    suggestQueue,
    TIQETS_SUGGEST_CONCURRENCY,
    async (intent) => {
      const query = intent.planItemName ?? intent.rawLabel;
      stats.suggestCallCount += 1;
      const result = await searchSuggest({
        term: query,
        destinationScope,
        deps: params.deps?.suggestDeps,
      }).catch(() => ({ candidates: [], outcome: "error" as const }));
      if (result.outcome === "error") stats.suggestErrorCount += 1;
      const match = matchTiqetsCandidate({ query, candidates: result.candidates });
      if (match) stats.suggestMatchCount += 1;
      else if (result.outcome !== "error") stats.suggestMissCount += 1;
      return match
        ? { item: toItem(intent, match, match.matchConfidence), requestIndex: intent.requestIndex }
        : null;
    },
  );
  for (const entry of suggested) if (entry) found.push(entry);

  const rank = (entry: Found) => (entry.item.matchConfidence === "exact" ? 0 : 1);
  found.sort((a, b) => rank(a) - rank(b) || a.requestIndex - b.requestIndex);

  const seen = new Set<string>();
  const products: TiqetsProductWidgetItem[] = [];
  for (const { item } of found) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    products.push(item);
    if (products.length >= TIQETS_WIDGET_MAX_PRODUCTS) break;
  }

  return {
    descriptor: products.length > 0 ? { providerId: "tiqets", kind: "product_widget", products } : null,
    stats,
  };
}
