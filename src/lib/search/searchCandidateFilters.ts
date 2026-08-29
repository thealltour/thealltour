/**
 * Pure PostgREST filter fragments for Search candidate union + AND filters.
 */

import {
  buildDestinationScopeOrFilter,
  buildGolfOrFilter,
  buildThemeOrFilter,
  quotePostgrestValue,
} from "@/lib/products/productListingQuery";
import type { DestinationScope } from "@/lib/search/resolveDestinationScope";
import type { SearchTaxonomyIntent } from "@/lib/search/resolveSearchTaxonomyIntent";
import type { ParsedSearchIntent } from "@/lib/search/parseSearchIntent";

export { buildDestinationScopeOrFilter };

/** ilike 패턴 내 % _ \ 이스케이프 (Postgres) */
export function escapeForIlike(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function buildProductLineIdsOrFilter(ids: string[]): string | null {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return null;
  return `product_line_id.in.(${unique.map(quotePostgrestValue).join(",")})`;
}

export function buildTextSearchOrFilter(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const escaped = escapeForIlike(t);
  const pattern = `%${escaped}%`;
  return `title.ilike.${pattern},category.ilike.${pattern},theme.ilike.${pattern}`;
}

/**
 * Keyword candidate OR (single-intent mode):
 * text(title|category|theme) UNION taxonomy destination/theme/productLine/golf
 */
export function buildSearchKeywordCandidateOrFilter(
  q: string,
  intent: SearchTaxonomyIntent,
): string {
  const parts: string[] = [];
  const textOr = buildTextSearchOrFilter(q);
  if (textOr) parts.push(textOr);

  if (intent.destination) {
    const destOr = buildDestinationScopeOrFilter(intent.destination);
    if (destOr) parts.push(destOr);
  }
  if (intent.theme?.names?.length) {
    const themeOr = buildThemeOrFilter(intent.theme.names);
    if (themeOr) parts.push(themeOr);
  }
  if (intent.productLine?.ids?.length) {
    const lineOr = buildProductLineIdsOrFilter(intent.productLine.ids);
    if (lineOr) parts.push(lineOr);
  }
  if (intent.golf) {
    const golfOr = buildGolfOrFilter(intent.golf);
    if (golfOr) parts.push(golfOr);
  }

  return parts.join(",");
}

/** Merge same-axis destination scopes into one OR group. */
export function mergeDestinationScopes(
  scopes: DestinationScope[],
): DestinationScope | null {
  if (!scopes.length) return null;
  const ids: string[] = [];
  const names: string[] = [];
  for (const s of scopes) {
    ids.push(...s.ids);
    names.push(...s.names);
  }
  return {
    ids: [...new Set(ids.map((x) => x.trim()).filter(Boolean))],
    names: [...new Set(names.map((x) => x.trim()).filter(Boolean))],
  };
}

/**
 * Structured multi-intent: each axis is one OR-group; caller ANDs via successive .or().
 */
export function buildStructuredSearchAxisFilters(parsed: ParsedSearchIntent): {
  destinationOr: string | null;
  themeOr: string | null;
  productLineOr: string | null;
  golfOr: string | null;
  remainingTextOr: string | null;
  unassignedProductLine: boolean;
} {
  const mergedDest = mergeDestinationScopes(parsed.destinations);
  const themeNames = [...new Set(parsed.themes.flatMap((t) => t.names))];
  const lineIds = [...new Set(parsed.productLines.flatMap((p) => p.ids))];

  return {
    destinationOr: mergedDest ? buildDestinationScopeOrFilter(mergedDest) : null,
    themeOr: themeNames.length ? buildThemeOrFilter(themeNames) : null,
    productLineOr: lineIds.length ? buildProductLineIdsOrFilter(lineIds) : null,
    golfOr: parsed.golf ? buildGolfOrFilter(parsed.golf) : null,
    remainingTextOr: parsed.remainingText
      ? buildTextSearchOrFilter(parsed.remainingText)
      : null,
    unassignedProductLine: parsed.unassignedProductLine === true,
  };
}
