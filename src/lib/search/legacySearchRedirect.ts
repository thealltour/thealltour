/**
 * Legacy `/search` → canonical `/products` query migration.
 *
 * destination → region: 양쪽 모두 category/destination **이름 문자열** 기준이었음.
 * taxonomy id 변환 없이 name preserve (안전한 동등 매핑).
 * sort: search relevance/latest/price_* 유지; 알 수 없으면 생략.
 */

import type { SearchSortOption } from "@/types/search";

const SEARCH_SORTS: SearchSortOption[] = ["relevance", "latest", "price_asc", "price_desc"];

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function trimEmpty(s: string | undefined): string | undefined {
  const t = typeof s === "string" ? s.trim() : "";
  return t === "" ? undefined : t;
}

/**
 * `/search` searchParams → `/products` 경로 + 쿼리.
 */
export function buildLegacySearchRedirectHref(
  params: Record<string, string | string[] | undefined>,
): string {
  const q = trimEmpty(firstString(params.q));
  const destination = trimEmpty(firstString(params.destination));
  const theme = trimEmpty(firstString(params.theme));
  const productLine = trimEmpty(firstString(params.product_line));
  const sortRaw = trimEmpty(firstString(params.sort));
  const pageRaw = trimEmpty(firstString(params.page));

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  // destination(name) → region(name). id 매핑 없이 문자열 보존.
  if (destination) qs.set("region", destination);
  if (theme) qs.set("theme", theme);
  if (productLine) qs.set("product_line", productLine);
  if (sortRaw && SEARCH_SORTS.includes(sortRaw as SearchSortOption)) {
    qs.set("sort", sortRaw);
  }
  if (pageRaw) {
    const n = parseInt(pageRaw, 10);
    if (Number.isFinite(n) && n > 1) qs.set("page", String(n));
  }

  const s = qs.toString();
  return s ? `/products?${s}` : "/products";
}
