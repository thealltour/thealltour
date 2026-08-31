import { supabase } from "@/lib/supabase";
import {
  mapProductRowToListItem,
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";import {
  parseThemeTokens,
  getCampaignTaxonomiesForCard,
  getActiveTaxonomiesForHeader,
  getActiveProductLineTaxonomies,
} from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE } from "@/lib/productFilters";
import { buildThemeOrFilter } from "@/lib/products/productListingQuery";
import { DEFAULT_PAGE, SEARCH_PAGE_SIZE } from "@/lib/search/searchQueryParams";
import {
  buildDestinationScopeOrFilter,
  buildSearchKeywordCandidateOrFilter,
  buildStructuredSearchAxisFilters,
  buildTextSearchOrFilter,
  escapeForIlike,
} from "@/lib/search/searchCandidateFilters";
import { parseSearchIntent, type ParsedSearchIntent } from "@/lib/search/parseSearchIntent";
import { resolveDestinationScope, resolveThemeScope } from "@/lib/search/resolveDestinationScope";
import type {
  SearchTaxonomyContext,
} from "@/lib/search/resolveSearchTaxonomyIntent";
import {
  buildSearchCandidateRanges,
  mapRowToSearchRankCandidate,
  rankSearchCandidates,
  SEARCH_RELEVANCE_CANDIDATE_SELECT,
  SEARCH_RELEVANCE_CHUNK_SIZE,
  sliceRankedCandidatePage,
  type SearchRankCandidate,
} from "@/lib/search/searchRelevanceCandidates";
import type { SearchProductsParams, SearchProductsResult, SearchSortOption } from "@/types/search";
import type { SearchFilterOptions } from "@/types/search";

const DEFAULT_SORT: SearchSortOption = "relevance";

export { relevanceScore, SEARCH_RELEVANCE_CHUNK_SIZE } from "@/lib/search/searchRelevanceCandidates";

export type SearchProductsByParamsOptions = SearchProductsParams & {
  page?: number;
  pageSize?: number;
  /** Injected in tests; production loads active taxonomies internally. */
  taxonomyContext?: SearchTaxonomyContext;
};

/**
 * 검색 대상: product title, category(지역명 등), theme.
 * @deprecated 검색 필터/정렬이 필요하면 searchProductsByParams 사용. No external callers.
 */
export async function searchProducts(keyword: string): Promise<ProductListItem[]> {
  const result = await searchProductsByParams({
    q: keyword.trim() || undefined,
    page: 1,
    pageSize: SEARCH_PAGE_SIZE,
  });
  return result.items;
}

export type { SearchProductsParams, SearchProductsResult };

async function loadDefaultTaxonomyContext(): Promise<SearchTaxonomyContext> {
  const [all, productLines] = await Promise.all([
    getActiveTaxonomiesForHeader(),
    getActiveProductLineTaxonomies(),
  ]);
  return {
    destinations: all.filter((t) => t.taxonomy_type === "destination"),
    themes: all.filter((t) => t.taxonomy_type === "theme"),
    productLines,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

function applyKeywordParsedFilters(qb: AnyQuery, parsed: ParsedSearchIntent): AnyQuery {
  let query = qb;

  if (parsed.mode === "text-only") {
    const textOr = buildTextSearchOrFilter(parsed.remainingText || parsed.rawQuery);
    if (textOr) query = query.or(textOr);
    return query;
  }

  if (parsed.mode === "single") {
    if (parsed.unassignedProductLine && !parsed.rankingIntent.destination && !parsed.rankingIntent.theme && !parsed.rankingIntent.productLine && !parsed.rankingIntent.golf) {
      const textOr = buildTextSearchOrFilter(parsed.rawQuery);
      const parts = [textOr, "product_line_id.is.null"].filter(Boolean);
      query = query.or(parts.join(","));
      return query;
    }
    const orFilter = buildSearchKeywordCandidateOrFilter(
      parsed.rawQuery,
      parsed.rankingIntent,
    );
    if (orFilter) query = query.or(orFilter);
    if (parsed.unassignedProductLine) {
      query = query.is("product_line_id", null);
    }
    return query;
  }

  // structured: successive .or() = AND of OR-groups
  const axes = buildStructuredSearchAxisFilters(parsed);
  if (axes.destinationOr) query = query.or(axes.destinationOr);
  if (axes.themeOr) query = query.or(axes.themeOr);
  if (axes.productLineOr) query = query.or(axes.productLineOr);
  if (axes.golfOr) query = query.or(axes.golfOr);
  if (axes.remainingTextOr) query = query.or(axes.remainingTextOr);
  if (axes.unassignedProductLine) {
    query = query.is("product_line_id", null);
  }
  return query;
}

function applySearchAndFilters(
  qb: AnyQuery,
  opts: {
    parsed: ParsedSearchIntent | null;
    regionScope: ReturnType<typeof resolveDestinationScope> | null;
    themeScopeNames: string[] | null;
    productLineId: string | null;
    unassignedProductLine: boolean;
  },
): AnyQuery {
  let query = qb;

  if (opts.parsed) {
    query = applyKeywordParsedFilters(query, opts.parsed);
  }

  if (opts.regionScope) {
    const regionOr = buildDestinationScopeOrFilter(opts.regionScope);
    if (regionOr) {
      query = query.or(regionOr);
    }
  }

  if (opts.themeScopeNames?.length) {
    const themeOr = buildThemeOrFilter(opts.themeScopeNames);
    if (themeOr) {
      query = query.or(themeOr);
    }
  }

  if (opts.unassignedProductLine) {
    query = query.is("product_line_id", null);
  } else if (opts.productLineId) {
    query = query.eq("product_line_id", opts.productLineId);
  }

  return query;
}

function applyRankCandidateChunkOrder(qb: AnyQuery): AnyQuery {
  return qb
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true, nullsFirst: false });
}

async function fetchAllRankCandidates(
  rankCandidateQuery: () => AnyQuery,
  total: number,
): Promise<SearchRankCandidate[]> {
  const ranges = buildSearchCandidateRanges(total, SEARCH_RELEVANCE_CHUNK_SIZE);
  const all: SearchRankCandidate[] = [];
  for (const { from, to } of ranges) {
    const { data, error } = await applyRankCandidateChunkOrder(rankCandidateQuery()).range(
      from,
      to,
    );
    if (error) {
      console.error("[search] relevance chunk error:", error.message);
      throw new Error(`[search] relevance chunk fetch failed: ${error.message}`);
    }
    for (const row of data ?? []) {
      all.push(mapRowToSearchRankCandidate(row as Record<string, unknown>));
    }
  }
  return all;
}

async function fetchListingProductsByIds(ids: string[]): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_LISTING_SELECT)
    .eq("is_active", true)
    .in("id", ids);
  if (error) {
    console.error("[search] page products fetch error:", error.message);
    throw new Error(`[search] page products fetch failed: ${error.message}`);
  }
  const byId = new Map<string, ProductListItem>();
  for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
    const item = mapProductRowToListItem(row);
    byId.set(item.id, item);
  }
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`[search] ranked page missing products: ${missing.join(", ")}`);
  }
  return ids.map((id) => byId.get(id)!);
}

function buildSearchPageMeta(total: number, page: number, pageSize: number) {
  if (total <= 0) {
    return { totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return { totalCount: total, page: safePage, pageSize, totalPages };
}

/**
 * params 기반 검색 (taxonomy-aware + multi-intent Correctness).
 * - single q: text ilike OR taxonomy scope
 * - multi-intent: Destination AND Theme AND ProductLine AND Golf AND remainingText
 * - URL region/theme/product_line: AND with keyword axes
 * - relevance: full candidate universe via chunked minimal projection + global JS rank
 */
export async function searchProductsByParams(
  params: SearchProductsByParamsOptions,
): Promise<SearchProductsResult> {
  const q = params.q?.trim();
  const destination = params.destination?.trim();
  const theme = params.theme?.trim();
  const productLineParam = params.product_line?.trim();
  const sort = params.sort ?? DEFAULT_SORT;
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? SEARCH_PAGE_SIZE;

  const hasCondition = q || destination || theme || productLineParam;
  if (!hasCondition) {
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }

  const taxonomyContext = params.taxonomyContext ?? (await loadDefaultTaxonomyContext());
  const parsed = q ? parseSearchIntent(q, taxonomyContext) : null;
  const rankingIntent = parsed?.rankingIntent ?? {};

  let regionScope: ReturnType<typeof resolveDestinationScope> | null = null;
  let matchNone = false;
  if (destination) {
    regionScope = resolveDestinationScope(destination, taxonomyContext.destinations);
    if (regionScope.ids.length === 0 && regionScope.names.length === 0) {
      matchNone = true;
    }
  }

  let themeScopeNames: string[] | null = null;
  if (theme) {
    themeScopeNames = resolveThemeScope(theme, taxonomyContext.themes).names;
  }

  let productLineId: string | null = null;
  let unassignedProductLine = false;
  if (productLineParam === PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE) {
    unassignedProductLine = true;
  } else if (productLineParam) {
    const found = taxonomyContext.productLines.find(
      (p) => (p.name ?? "").trim() === productLineParam,
    );
    productLineId = found?.id?.trim() ?? null;
    if (!productLineId) {
      matchNone = true;
    }
  }

  if (matchNone) {
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }

  const campaignTaxonomies = await getCampaignTaxonomiesForCard();

  const filterOpts = {
    parsed,
    regionScope,
    themeScopeNames,
    productLineId,
    unassignedProductLine,
  };

  function listingDataQuery() {
    return applySearchAndFilters(
      supabase.from("products").select(PRODUCT_LISTING_SELECT).eq("is_active", true),
      filterOpts,
    );
  }

  function rankCandidateQuery() {
    return applySearchAndFilters(
      supabase
        .from("products")
        .select(SEARCH_RELEVANCE_CANDIDATE_SELECT)
        .eq("is_active", true),
      filterOpts,
    );
  }

  function countQuery() {
    return applySearchAndFilters(
      supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
      filterOpts,
    );
  }

  const useRelevanceSort = sort === "relevance" && q;

  if (useRelevanceSort && q) {
    const { count: totalCount, error: countError } = await countQuery();
    if (countError) {
      console.error("[search] count error:", countError.message);
      return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
    }
    const total = typeof totalCount === "number" ? totalCount : 0;
    if (total === 0) {
      return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
    }

    const meta = buildSearchPageMeta(total, page, pageSize);
    const rankCandidates = await fetchAllRankCandidates(rankCandidateQuery, total);
    const ranked = rankSearchCandidates(rankCandidates, q, rankingIntent);
    const pageCandidates = sliceRankedCandidatePage(ranked, meta.page, pageSize);
    const pageIds = pageCandidates.map((c) => c.id);

    let items = await fetchListingProductsByIds(pageIds);
    items = hydrateProductsWithCampaignCardMeta(items, campaignTaxonomies);

    return {
      items,
      totalCount: total,
      page: meta.page,
      pageSize,
      totalPages: meta.totalPages,
    };
  }

  const { count: totalCount, error: countError } = await countQuery();
  if (countError) {
    console.error("[search] count error:", countError.message);
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }
  const total = typeof totalCount === "number" ? totalCount : 0;
  const meta = buildSearchPageMeta(total, page, pageSize);
  if (total === 0) {
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }
  const from = (meta.page - 1) * pageSize;
  const to = from + pageSize - 1;

  let dataQuery = listingDataQuery();
  switch (sort) {
    case "latest":
      dataQuery = dataQuery
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("sort_order", { ascending: true, nullsFirst: false });
      break;
    case "price_asc":
      dataQuery = dataQuery
        .order("price", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      break;
    case "price_desc":
      dataQuery = dataQuery
        .order("price", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      break;
    default:
      dataQuery = dataQuery
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
  }
  const { data, error } = await dataQuery.range(from, to);
  if (error) {
    console.error("[search] searchProductsByParams error:", error.message);
    return { items: [], totalCount: total, page: meta.page, pageSize, totalPages: meta.totalPages };
  }
  let products = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapProductRowToListItem(row),
  );
  products = hydrateProductsWithCampaignCardMeta(products, campaignTaxonomies);
  const seen = new Set<string>();
  products = products.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return {
    items: products,
    totalCount: total,
    page: meta.page,
    pageSize,
    totalPages: meta.totalPages,
  };
}

/**
 * 검색 결과 Product[]에서 필터 옵션 파생 (fallback).
 * @deprecated getSearchFilterOptions (taxonomies 기반) 사용 권장.
 */
export function deriveSearchFilterOptions(products: ProductListItem[]): SearchFilterOptions {
  const destinations = Array.from(
    new Set(products.map((p) => p.category?.trim()).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b, "ko"));
  const themeSet = new Set<string>();
  for (const p of products) {
    for (const t of parseThemeTokens(p.theme)) {
      if (t) themeSet.add(t);
    }
  }
  const themes = Array.from(themeSet).sort((a, b) => a.localeCompare(b, "ko"));
  return {
    destinations,
    themes,
    productLines: [],
  };
}

export { escapeForIlike };
