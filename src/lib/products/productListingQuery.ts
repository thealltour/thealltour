/**
 * POST-UI-01A: Browse용 DB-side offset pagination foundation.
 *
 * - `getProducts()` / Search / UI 미연결. 01B에서 `/products` Browse에 연결.
 * - 지원 filter는 DB에 정확히 pushdown 가능한 것만 (destinationId, productLineId).
 * - theme descendant / collection / Golf composite semantics는 DEFER (01B).
 * - select("*")는 foundation 임시. Listing DTO projection은 01D.
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

/**
 * DB에 정확히 pushdown 가능한 filter만.
 * theme / collection / tourType·Golf composite → 01B (type에 넣지 않음 = silent ignore 방지).
 */
export type ProductListingDbFilters = {
  destinationId?: string;
  productLineId?: string;
};

/** Browse listing sort — ProductSortId alias 중 DB 재현 가능한 것만 */
export type ProductListingSort = "recommended" | "latest" | "price_asc" | "price_desc";

export type GetProductsPageParams = {
  page?: number;
  pageSize?: number;
  sort?: ProductListingSort | null;
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

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
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

export function resolveProductListingSort(
  sort: ProductListingSort | null | undefined,
): ProductListingSort {
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
  const filters = params.filters ?? {};

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("is_active", true);

  const destinationId = filters.destinationId?.trim();
  if (destinationId) {
    query = query.eq("destination_id", destinationId);
  }
  const productLineId = filters.productLineId?.trim();
  if (productLineId) {
    query = query.eq("product_line_id", productLineId);
  }

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
