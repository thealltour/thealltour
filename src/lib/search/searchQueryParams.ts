/**
 * /search 페이지 URL 쿼리스트링 파싱 및 생성.
 */

import type { SearchFilterState, SearchSortOption } from "@/types/search";

const SORT_VALID: SearchSortOption[] = ["relevance", "latest", "price_asc", "price_desc"];

export const DEFAULT_PAGE = 1;
export const SEARCH_PAGE_SIZE = 24;

function trimEmpty(s: string | undefined): string | undefined {
  const t = typeof s === "string" ? s.trim() : "";
  return t === "" ? undefined : t;
}

function parseSort(value: string | undefined): SearchSortOption | undefined {
  const v = trimEmpty(value);
  if (!v) return undefined;
  return SORT_VALID.includes(v as SearchSortOption) ? (v as SearchSortOption) : undefined;
}

/**
 * page 쿼리 값을 1 이상의 정수로 정규화. 잘못된 값은 DEFAULT_PAGE.
 */
export function normalizePageParam(value: string | undefined): number {
  if (value === undefined || value === "") return DEFAULT_PAGE;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE;
  return n;
}

/**
 * searchParams 객체를 SearchFilterState로 파싱.
 * 빈 문자열은 제거, sort는 유효값만, page는 항상 양의 정수로 정규화.
 */
export function parseSearchParams(params: Record<string, string | string[] | undefined>): SearchFilterState {
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  const destination = Array.isArray(params.destination) ? params.destination[0] : params.destination;
  const theme = Array.isArray(params.theme) ? params.theme[0] : params.theme;
  const product_line = Array.isArray(params.product_line) ? params.product_line[0] : params.product_line;
  const sort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;

  const normalizedPage = normalizePageParam(page);
  return {
    q: trimEmpty(q),
    destination: trimEmpty(destination),
    theme: trimEmpty(theme),
    product_line: trimEmpty(product_line),
    sort: parseSort(sort),
    page: normalizedPage,
  };
}

/**
 * SearchFilterState를 /search 쿼리스트링으로 변환.
 * undefined/빈 값은 제거. page=1은 생략.
 */
export function buildSearchQueryString(state: SearchFilterState): string {
  const qs = new URLSearchParams();
  if (state.q) qs.set("q", state.q);
  if (state.destination) qs.set("destination", state.destination);
  if (state.theme) qs.set("theme", state.theme);
  if (state.product_line) qs.set("product_line", state.product_line);
  if (state.sort && state.sort !== "relevance") qs.set("sort", state.sort);
  if (state.page != null && state.page > 1) qs.set("page", String(state.page));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * /search 경로 + 쿼리스트링 반환.
 */
export function buildSearchUrl(state: SearchFilterState): string {
  return `/search${buildSearchQueryString(state)}`;
}

/**
 * 현재 state에서 한 필드만 바꾼 새 state로 URL 갱신 시 사용.
 * 빈 문자열로 설정하면 해당 키 제거.
 * 필터/정렬 변경 시 page=1로 리셋하려면 withPageOne() 사용.
 */
export function updateSearchQueryParams(
  current: SearchFilterState,
  updates: Partial<SearchFilterState>,
): SearchFilterState {
  const next = { ...current };
  for (const key of Object.keys(updates) as (keyof SearchFilterState)[]) {
    const v = updates[key];
    if (v === undefined || (typeof v === "string" && v.trim() === "")) {
      delete next[key];
    } else {
      (next as Record<string, unknown>)[key] = v;
    }
  }
  return next;
}

/** 필터/정렬 변경 시 page를 1로 리셋한 state 반환 */
export function withPageOne(state: SearchFilterState): SearchFilterState {
  return { ...state, page: DEFAULT_PAGE };
}

export const DEFAULT_SORT: SearchSortOption = "relevance";
