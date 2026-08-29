/**
 * Small Search domain vocabulary (not a full alias framework).
 * - GENERIC_TRAVEL_QUERY_TERMS: filler nouns after structured intents
 * - PACKAGE_TRAVEL_SEARCH_SYNONYMS: unassigned product-line channel
 */

import { GOLF_SEARCH_SYNONYMS } from "@/lib/search/golfSearchSynonyms";
import { PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE } from "@/lib/productFilters";

export { GOLF_SEARCH_SYNONYMS };

/** Domain nouns that do not add filter intent when structured axes already exist. */
export const GENERIC_TRAVEL_QUERY_TERMS = ["여행상품", "여행", "상품"] as const;

/**
 * Package-travel channel synonyms → product_line_id IS NULL semantics.
 * Canonical name PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE included.
 */
export const PACKAGE_TRAVEL_SEARCH_SYNONYMS = [
  PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE,
  "패키지",
] as const;

/** Compare taxonomy phrases ignoring internal whitespace. */
export function normalizeSearchPhraseForComparison(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function isGenericTravelQueryTerm(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  const compact = normalizeSearchPhraseForComparison(t);
  return (GENERIC_TRAVEL_QUERY_TERMS as readonly string[]).some(
    (g) => g === t || normalizeSearchPhraseForComparison(g) === compact,
  );
}

export function isPackageTravelSearchSynonym(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  const compact = normalizeSearchPhraseForComparison(t);
  return (PACKAGE_TRAVEL_SEARCH_SYNONYMS as readonly string[]).some(
    (s) => s === t || normalizeSearchPhraseForComparison(s) === compact,
  );
}
