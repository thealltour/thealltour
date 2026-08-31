/**
 * Relevance ranking helpers (01C): minimal candidate projection, chunked ranges, global rank.
 */

import { parseThemeTokens } from "@/lib/productTaxonomies";
import type { SearchTaxonomyIntent } from "@/lib/search/resolveSearchTaxonomyIntent";
import type { Product } from "@/types/product";

/** Sequential chunk size for full candidate universe fetch (not a result cap). */
export const SEARCH_RELEVANCE_CHUNK_SIZE = 200;

export const SEARCH_RELEVANCE_CANDIDATE_SELECT =
  "id,title,category,theme,destination_id,product_line_id,sort_order,created_at";

export type SearchRankCandidate = Pick<
  Product,
  | "id"
  | "title"
  | "category"
  | "theme"
  | "destination_id"
  | "product_line_id"
  | "sort_order"
  | "created_at"
>;

export function buildSearchCandidateRanges(
  total: number,
  chunkSize: number,
): Array<{ from: number; to: number }> {
  if (total <= 0 || chunkSize <= 0) return [];
  const ranges: Array<{ from: number; to: number }> = [];
  for (let from = 0; from < total; from += chunkSize) {
    ranges.push({ from, to: Math.min(from + chunkSize - 1, total - 1) });
  }
  return ranges;
}

export function mapRowToSearchRankCandidate(row: Record<string, unknown>): SearchRankCandidate {
  const sortRaw = row.sort_order;
  let sort_order: number | undefined;
  if (typeof sortRaw === "number" && Number.isFinite(sortRaw)) {
    sort_order = sortRaw;
  } else if (sortRaw != null && sortRaw !== "") {
    const n = Number(sortRaw);
    if (Number.isFinite(n)) sort_order = n;
  }

  return {
    id: String(row.id ?? ""),
    title: row.title != null ? String(row.title) : "",
    category: row.category != null ? String(row.category) : "",
    theme: row.theme != null ? String(row.theme) : undefined,
    destination_id: row.destination_id != null ? String(row.destination_id) : undefined,
    product_line_id: row.product_line_id != null ? String(row.product_line_id) : undefined,
    sort_order,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

/**
 * 검색어 relevance 점수: 낮을수록 우선.
 * 1 title exact, 2 title prefix, 3 taxonomy exact (self),
 * 4 title contains, 5 taxonomy descendant, 6 category/theme text, 7 fallback
 */
export function relevanceScore(
  product: SearchRankCandidate,
  keyword: string,
  intent?: SearchTaxonomyIntent | null,
): number {
  const k = keyword.toLowerCase();
  const t = (product.title ?? "").toLowerCase();
  const c = (product.category ?? "").toLowerCase();
  const th = (product.theme ?? "").toLowerCase();
  if (t === k) return 1;
  if (t.startsWith(k)) return 2;

  const taxonomyExact = intent ? scoreTaxonomyExact(product, intent) : false;
  if (taxonomyExact) return 3;

  if (t.includes(k)) return 4;

  const taxonomyDesc = intent ? scoreTaxonomyDescendant(product, intent) : false;
  if (taxonomyDesc) return 5;

  if (c.includes(k) || th.includes(k)) return 6;
  return 7;
}

function scoreTaxonomyExact(
  product: SearchRankCandidate,
  intent: SearchTaxonomyIntent,
): boolean {
  if (intent.destination?.matchedName) {
    const selfId = intent.destination.ids[0];
    if (selfId && product.destination_id?.trim() === selfId) return true;
    const destName = (product.category ?? "").trim();
    if (destName && destName === intent.destination.matchedName) return true;
  }
  if (intent.theme?.matchedName) {
    const tokens = parseThemeTokens(product.theme);
    if (tokens.includes(intent.theme.matchedName)) return true;
  }
  if (intent.productLine?.ids?.length) {
    const pl = product.product_line_id?.trim();
    if (pl && intent.productLine.ids.includes(pl)) return true;
  }
  if (intent.golf) {
    const pl = product.product_line_id?.trim();
    if (pl && intent.golf.productLineIds.includes(pl)) return true;
    const cat = (product.category ?? "").trim();
    if (cat && intent.golf.legacyCategories.includes(cat)) return true;
  }
  return false;
}

function scoreTaxonomyDescendant(
  product: SearchRankCandidate,
  intent: SearchTaxonomyIntent,
): boolean {
  if (intent.destination) {
    const id = product.destination_id?.trim();
    const selfId = intent.destination.ids[0];
    if (id && intent.destination.ids.includes(id) && id !== selfId) return true;
    const cat = (product.category ?? "").trim();
    if (
      cat &&
      intent.destination.names.includes(cat) &&
      cat !== intent.destination.matchedName
    ) {
      return true;
    }
  }
  if (intent.theme?.names?.length) {
    const tokens = parseThemeTokens(product.theme);
    const matched = intent.theme.matchedName;
    if (tokens.some((tok) => intent.theme!.names.includes(tok) && tok !== matched)) {
      return true;
    }
  }
  return false;
}

/** Tie-breaker order for global relevance rank (exported for tests). */
export function compareSearchRankCandidates(
  a: SearchRankCandidate,
  b: SearchRankCandidate,
  keyword: string,
  intent?: SearchTaxonomyIntent | null,
): number {
  const sa = relevanceScore(a, keyword, intent);
  const sb = relevanceScore(b, keyword, intent);
  if (sa !== sb) return sa - sb;
  const orderA = a.sort_order ?? 9999;
  const orderB = b.sort_order ?? 9999;
  if (orderA !== orderB) return orderA - orderB;
  const createdCmp = (b.created_at ?? "").localeCompare(a.created_at ?? "");
  if (createdCmp !== 0) return createdCmp;
  return a.id.localeCompare(b.id);
}

export function rankSearchCandidates(
  candidates: SearchRankCandidate[],
  keyword: string,
  intent?: SearchTaxonomyIntent | null,
): SearchRankCandidate[] {
  const seen = new Set<string>();
  const deduped = candidates.filter((c) => {
    if (!c.id || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  return [...deduped].sort((a, b) => compareSearchRankCandidates(a, b, keyword, intent));
}

export function sliceRankedCandidatePage(
  ranked: SearchRankCandidate[],
  page: number,
  pageSize: number,
): SearchRankCandidate[] {
  const from = (page - 1) * pageSize;
  return ranked.slice(from, from + pageSize);
}
