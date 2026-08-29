/**
 * POST-UI-01A/01B-1: Browse용 DB-side offset pagination + filter query contract.
 *
 * - `getProducts()` / Search / UI 미연결. 01B-2에서 `/products` Browse에 연결.
 * - select("*")는 foundation 임시. Listing DTO projection은 01D.
 * - Browse `q`는 production에서 Search Mode로 분기되므로 여기서 미지원.
 * - promotion-first는 campaign_card_meta hydration 기반 → DB sort 재현 불가 (01B-2 결정).
 */

import { supabase } from "@/lib/supabase";
import { normalizeProduct } from "@/lib/products";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import type { Product } from "@/types/product";

/** Browse listing 기본 page size — Search `SEARCH_PAGE_SIZE`와 값은 같으나 Search 모듈에 의존하지 않음 */
export const PRODUCT_LIST_PAGE_SIZE = 24;
export const PRODUCT_LIST_PAGE_SIZE_MIN = 1;
export const PRODUCT_LIST_PAGE_SIZE_MAX = 100;

export type ProductListingCollectionKind = "recommend" | "popular";

/** Shared with Search — destination FK ids + legacy category names */
export type ProductListingDestinationScope = {
  ids: string[];
  names: string[];
};

/**
 * DB에 pushdown 가능한 filter.
 * - destinationId: 01A 호환
 * - destinationIds: 01B-1 호환 ([] → matchNone when no names either)
 * - destinationScope: ids + names (01B-1.1 legacy category OR)
 * - collection "new"는 filter가 아니라 sort alias (adapter에서 latest로 변환)
 */
export type ProductListingDbFilters = {
  /** @deprecated Prefer `destinationScope` / `destinationIds`. Still supported for 01A callers. */
  destinationId?: string;
  destinationIds?: string[];
  /** Preferred: self+descendant ids and names for FK OR legacy category */
  destinationScope?: ProductListingDestinationScope;
  productLineId?: string;
  /** `product_line_id IS NULL` — 「패키지여행」semantics */
  unassignedProductLine?: boolean;
  /** Theme token names (self + descendants already expanded by adapter) */
  themeNames?: string[];
  collection?: {
    kind: ProductListingCollectionKind;
    /** Taxonomy-derived campaign display names for OR with boolean flag */
    campaignNames?: string[];
  };
  golfChannel?: {
    productLineIds: string[];
    legacyCategories: string[];
  };
  /**
   * Explicit empty match (e.g. region resolved to no destination ids/names).
   * Repository returns empty page — never full catalog.
   */
  matchNone?: boolean;
};

/** Browse listing sort — DB columns만. UI alias(popular/new)는 resolve에서 매핑. */
export type ProductListingSort = "recommended" | "latest" | "price_asc" | "price_desc";

/** UI / adapter에서 올 수 있는 sort 입력 (alias 포함) */
export type ProductListingSortInput =
  | ProductListingSort
  | "popular"
  | "new"
  | ""
  | null
  | undefined;

export type GetProductsPageParams = {
  page?: number;
  pageSize?: number;
  sort?: ProductListingSortInput;
  filters?: ProductListingDbFilters;
};

export type ProductListingPageResult = {
  items: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type NormalizedProductPageInput = {
  page: number;
  pageSize: number;
};

export type ProductPageRange = {
  from: number;
  to: number;
};

export type NormalizedProductListingDbFilters = {
  matchNone: boolean;
  destinationScope?: ProductListingDestinationScope;
  productLineId?: string;
  unassignedProductLine: boolean;
  themeNames: string[];
  collection?: {
    kind: ProductListingCollectionKind;
    campaignNames: string[];
  };
  golfChannel?: {
    productLineIds: string[];
    legacyCategories: string[];
  };
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function uniqueNonEmpty(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** page ≥ 1, pageSize ∈ [MIN, MAX], default 24 */
export function normalizeProductPageInput(params: {
  page?: number;
  pageSize?: number;
}): NormalizedProductPageInput {
  const rawPage = params.page;
  const page =
    isFiniteNumber(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSize = params.pageSize;
  let pageSize = PRODUCT_LIST_PAGE_SIZE;
  if (isFiniteNumber(rawSize)) {
    const floored = Math.floor(rawSize);
    if (floored < PRODUCT_LIST_PAGE_SIZE_MIN) {
      pageSize = PRODUCT_LIST_PAGE_SIZE;
    } else {
      pageSize = Math.min(PRODUCT_LIST_PAGE_SIZE_MAX, floored);
    }
  }

  return { page, pageSize };
}

export function buildProductPageRange(page: number, pageSize: number): ProductPageRange {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

export function buildProductPageMeta(input: {
  totalCount: number;
  page: number;
  pageSize: number;
}): Pick<ProductListingPageResult, "totalCount" | "page" | "pageSize" | "totalPages" | "hasNextPage"> {
  const totalCount = Math.max(0, input.totalCount);
  const { page, pageSize } = input;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const hasNextPage = totalPages > 0 && page < totalPages;
  return { totalCount, page, pageSize, totalPages, hasNextPage };
}

/**
 * Sort aliases: popular → recommended, new → latest.
 * Unknown / empty → recommended.
 */
export function resolveProductListingSort(
  sort: ProductListingSortInput,
): ProductListingSort {
  if (sort === "popular") return "recommended";
  if (sort === "new") return "latest";
  if (sort === "latest" || sort === "price_asc" || sort === "price_desc" || sort === "recommended") {
    return sort;
  }
  return "recommended";
}

type OrderedQuery = {
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => OrderedQuery;
};

/**
 * Stable ordering: 모든 sort에 최종 `id ASC` tie-breaker.
 * price null → nullsLast (Browse applyProductFilters: null을 맨 뒤로).
 */
export function applyProductListingSort<T extends OrderedQuery>(query: T, sort: ProductListingSort): T {
  switch (sort) {
    case "latest":
      return query
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true }) as T;
    case "price_asc":
      return query
        .order("price", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true }) as T;
    case "price_desc":
      return query
        .order("price", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true }) as T;
    case "recommended":
    default:
      return query
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true }) as T;
  }
}

/** PostgREST `.or()` / filter 값 — 콤마·특수문자 안전용 double-quote */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '""')}"`;
}

/** Postgres regex 특수문자 이스케이프 (theme token boundary match) */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `parseThemeTokens` delimiter (`/`, `,`, newline, `|`) 경계와 동일한 theme token match.
 * PostgREST: `theme.match."(^|[,\\n|])TOKEN($|[,\\n|])"`
 */
export function buildThemeTokenMatchClause(themeName: string): string | null {
  const name = themeName.trim();
  if (!name) return null;
  const pattern = `(^|[,\\n|])${escapeRegexLiteral(name)}($|[,\\n|])`;
  return `theme.match.${quotePostgrestValue(pattern)}`;
}

/** themeNames → OR of token-boundary matches. Empty → null (no filter). */
export function buildThemeOrFilter(themeNames: string[]): string | null {
  const names = uniqueNonEmpty(themeNames);
  if (!names.length) return null;
  const parts = names
    .map((n) => buildThemeTokenMatchClause(n))
    .filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(",") : null;
}

/** is_recommend|is_popular OR campaigns_json contains each campaign name */
export function buildCollectionOrFilter(input: {
  kind: ProductListingCollectionKind;
  campaignNames?: string[];
}): string {
  const flag = input.kind === "recommend" ? "is_recommend" : "is_popular";
  const parts: string[] = [`${flag}.eq.true`];
  for (const name of uniqueNonEmpty(input.campaignNames)) {
    parts.push(`campaigns_json.cs.{${quotePostgrestValue(name)}}`);
  }
  return parts.join(",");
}

/**
 * Golf channel OR:
 * product_line_id IN (...) OR category IN (legacy)
 */
export function buildGolfOrFilter(input: {
  productLineIds?: string[];
  legacyCategories?: string[];
}): string | null {
  const parts: string[] = [];
  const ids = uniqueNonEmpty(input.productLineIds);
  const cats = uniqueNonEmpty(input.legacyCategories);
  if (ids.length) {
    parts.push(`product_line_id.in.(${ids.map(quotePostgrestValue).join(",")})`);
  }
  if (cats.length) {
    parts.push(`category.in.(${cats.map(quotePostgrestValue).join(",")})`);
  }
  return parts.length ? parts.join(",") : null;
}

/**
 * Destination scope OR (01B-1.1):
 * destination_id IN ids OR category IN names (exact; no ilike substring)
 */
export function buildDestinationScopeOrFilter(
  scope: ProductListingDestinationScope | { ids?: string[]; names?: string[] },
): string | null {
  const parts: string[] = [];
  const ids = uniqueNonEmpty(scope.ids);
  const names = uniqueNonEmpty(scope.names);
  if (ids.length) {
    parts.push(`destination_id.in.(${ids.map(quotePostgrestValue).join(",")})`);
  }
  if (names.length) {
    parts.push(`category.in.(${names.map(quotePostgrestValue).join(",")})`);
  }
  return parts.length ? parts.join(",") : null;
}

/**
 * Normalize listing filters:
 * - merge destinationId + destinationIds + destinationScope → destinationScope
 * - empty ids AND empty names → matchNone
 * - unassignedProductLine clears productLineId
 * - golfChannel with no ids/categories → matchNone
 */
export function normalizeProductListingDbFilters(
  filters: ProductListingDbFilters | undefined,
): NormalizedProductListingDbFilters {
  const raw = filters ?? {};
  let matchNone = raw.matchNone === true;

  const hasDestinationIdsKey = Object.prototype.hasOwnProperty.call(raw, "destinationIds");
  const hasDestinationScopeKey = Object.prototype.hasOwnProperty.call(raw, "destinationScope");
  const fromSingle = raw.destinationId?.trim() ? [raw.destinationId.trim()] : [];
  const fromArray = hasDestinationIdsKey ? uniqueNonEmpty(raw.destinationIds) : [];
  const fromScopeIds = hasDestinationScopeKey
    ? uniqueNonEmpty(raw.destinationScope?.ids)
    : [];
  const fromScopeNames = hasDestinationScopeKey
    ? uniqueNonEmpty(raw.destinationScope?.names)
    : [];

  const hasAnyDestinationInput =
    Boolean(fromSingle.length) || hasDestinationIdsKey || hasDestinationScopeKey;

  let destinationScope: ProductListingDestinationScope | undefined;
  if (hasAnyDestinationInput) {
    const ids = uniqueNonEmpty([...fromScopeIds, ...fromArray, ...fromSingle]);
    const names = fromScopeNames;
    if (ids.length === 0 && names.length === 0) {
      matchNone = true;
      destinationScope = undefined;
    } else {
      destinationScope = { ids, names };
    }
  }

  let unassignedProductLine = raw.unassignedProductLine === true;
  let productLineId = raw.productLineId?.trim() || undefined;
  if (unassignedProductLine) {
    productLineId = undefined;
  }

  const themeNames = uniqueNonEmpty(raw.themeNames);

  let collection: NormalizedProductListingDbFilters["collection"];
  if (raw.collection?.kind === "recommend" || raw.collection?.kind === "popular") {
    collection = {
      kind: raw.collection.kind,
      campaignNames: uniqueNonEmpty(raw.collection.campaignNames),
    };
  }

  let golfChannel: NormalizedProductListingDbFilters["golfChannel"];
  if (raw.golfChannel) {
    const productLineIds = uniqueNonEmpty(raw.golfChannel.productLineIds);
    const legacyCategories = uniqueNonEmpty(raw.golfChannel.legacyCategories);
    if (productLineIds.length === 0 && legacyCategories.length === 0) {
      matchNone = true;
    } else {
      golfChannel = { productLineIds, legacyCategories };
    }
  }

  return {
    matchNone,
    destinationScope,
    productLineId,
    unassignedProductLine,
    themeNames,
    collection,
    golfChannel,
  };
}

export type ListingFilterQuery = {
  eq: (column: string, value: unknown) => ListingFilterQuery;
  in: (column: string, values: string[]) => ListingFilterQuery;
  is: (column: string, value: null) => ListingFilterQuery;
  or: (filters: string) => ListingFilterQuery;
};

/**
 * Apply normalized filters as AND of groups:
 * destinationScope OR AND productLine AND theme OR AND collection OR AND golf OR
 */
export function applyProductListingDbFilters<T extends ListingFilterQuery>(
  query: T,
  filters: NormalizedProductListingDbFilters,
): T {
  let q: ListingFilterQuery = query;

  if (filters.destinationScope) {
    const destOr = buildDestinationScopeOrFilter(filters.destinationScope);
    if (destOr) {
      q = q.or(destOr);
    }
  }

  if (filters.unassignedProductLine) {
    q = q.is("product_line_id", null);
  } else if (filters.productLineId) {
    q = q.eq("product_line_id", filters.productLineId);
  }

  const themeOr = buildThemeOrFilter(filters.themeNames);
  if (themeOr) {
    q = q.or(themeOr);
  }

  if (filters.collection) {
    q = q.or(buildCollectionOrFilter(filters.collection));
  }

  if (filters.golfChannel) {
    const golfOr = buildGolfOrFilter(filters.golfChannel);
    if (golfOr) {
      q = q.or(golfOr);
    }
  }

  return q as T;
}

function emptyPageResult(
  page: number,
  pageSize: number,
): ProductListingPageResult {
  return {
    items: [],
    ...buildProductPageMeta({ totalCount: 0, page, pageSize }),
  };
}

/**
 * DB-side offset pagination for Browse foundation.
 * Does not replace `getProducts()`. Not used by Search.
 */
export async function getProductsPage(
  params: GetProductsPageParams = {},
): Promise<ProductListingPageResult> {
  const { page, pageSize } = normalizeProductPageInput(params);
  const { from, to } = buildProductPageRange(page, pageSize);
  const sort = resolveProductListingSort(params.sort);
  const filters = normalizeProductListingDbFilters(params.filters);

  if (filters.matchNone) {
    return emptyPageResult(page, pageSize);
  }

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("is_active", true);

  query = applyProductListingDbFilters(query, filters);
  query = applyProductListingSort(query, sort);

  const { data, error, count } = await query.range(from, to);
  if (error) {
    console.error("[products] getProductsPage error:", error.message);
    throw new Error(`[products] getProductsPage failed: ${error.message}`);
  }

  const totalCount = typeof count === "number" ? count : 0;
  const meta = buildProductPageMeta({ totalCount, page, pageSize });

  const campaignTaxonomies = await getCampaignTaxonomiesForCard();
  const normalized = (data ?? []).map((row) =>
    normalizeProduct(row as Record<string, unknown>),
  );
  const items = hydrateProductsWithCampaignCardMeta(normalized, campaignTaxonomies);

  return {
    items,
    ...meta,
  };
}
