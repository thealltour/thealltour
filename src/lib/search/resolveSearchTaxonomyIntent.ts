/**
 * Keyword q → taxonomy intent (exact name only).
 * Golf channel synonym: GOLF_SEARCH_SYNONYMS (e.g. "골프").
 */

import {
  GOLF_PRESET_CATEGORIES,
  isGolfProductLineTaxonomy,
} from "@/lib/products/golfChannel";
import { GOLF_SEARCH_SYNONYMS } from "@/lib/search/golfSearchSynonyms";
import {
  resolveDestinationScope,
  resolveThemeScope,
  type DestinationScope,
} from "@/lib/search/resolveDestinationScope";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type SearchTaxonomyContext = {
  destinations: ProductTaxonomy[];
  themes: ProductTaxonomy[];
  productLines: Array<Pick<ProductTaxonomy, "id" | "name" | "slug">>;
};

export type SearchTaxonomyIntent = {
  destination?: DestinationScope & { matchedName: string };
  theme?: { matchedName: string; names: string[] };
  productLine?: { matchedName: string; ids: string[] };
  golf?: {
    productLineIds: string[];
    legacyCategories: string[];
  };
};

function findExactByName<T extends { name?: string | null }>(
  items: T[],
  q: string,
): T | undefined {
  const n = q.trim();
  if (!n) return undefined;
  return items.find((item) => (item.name ?? "").trim() === n);
}

function collectGolfProductLineIds(
  productLines: Array<Pick<ProductTaxonomy, "id" | "name" | "slug">>,
): string[] {
  const ids: string[] = [];
  for (const line of productLines) {
    if (!isGolfProductLineTaxonomy(line)) continue;
    const id = line.id?.trim();
    if (id) ids.push(id);
  }
  return ids;
}

function fullGolfChannel(
  productLines: Array<Pick<ProductTaxonomy, "id" | "name" | "slug">>,
): SearchTaxonomyIntent["golf"] {
  return {
    productLineIds: collectGolfProductLineIds(productLines),
    legacyCategories: [...GOLF_PRESET_CATEGORIES],
  };
}

/**
 * Resolve taxonomy intent from an exact keyword.
 * Multiple axes may match the same string; all are unioned into candidates.
 */
export function resolveSearchTaxonomyIntent(
  q: string | null | undefined,
  context: SearchTaxonomyContext,
): SearchTaxonomyIntent {
  const keyword = q?.trim() ?? "";
  if (!keyword) return {};

  const intent: SearchTaxonomyIntent = {};

  const destHit = findExactByName(context.destinations, keyword);
  if (destHit) {
    const scope = resolveDestinationScope(keyword, context.destinations);
    intent.destination = {
      matchedName: keyword,
      ids: scope.ids,
      names: scope.names,
    };
  }

  const themeHit = findExactByName(context.themes, keyword);
  if (themeHit) {
    const scope = resolveThemeScope(keyword, context.themes);
    intent.theme = {
      matchedName: scope.matchedName,
      names: scope.names,
    };
  }

  const lineHit = findExactByName(context.productLines, keyword);
  const isPresetGolfCategory = (GOLF_PRESET_CATEGORIES as readonly string[]).includes(keyword);
  const isGolfSynonym = (GOLF_SEARCH_SYNONYMS as readonly string[]).includes(keyword);
  const isSingleToken = !/\s/.test(keyword);

  if (lineHit && isGolfProductLineTaxonomy(lineHit)) {
    intent.golf = fullGolfChannel(context.productLines);
  } else if (isPresetGolfCategory || isGolfSynonym) {
    intent.golf = fullGolfChannel(context.productLines);
  } else if (lineHit?.id?.trim()) {
    intent.productLine = {
      matchedName: keyword,
      ids: [lineHit.id.trim()],
    };
  } else if (isSingleToken && isGolfProductLineTaxonomy({ name: keyword })) {
    // e.g. exact token "파크골프" — never match mid-phrase ("동남아 골프")
    intent.golf = fullGolfChannel(context.productLines);
  }

  return intent;
}

export function searchTaxonomyIntentIsEmpty(intent: SearchTaxonomyIntent): boolean {
  return !(
    intent.destination ||
    intent.theme ||
    intent.productLine ||
    intent.golf
  );
}
