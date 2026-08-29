import { supabase } from "@/lib/supabase";
import { normalizeProduct } from "@/lib/products";
import {
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
  SearchTaxonomyIntent,
} from "@/lib/search/resolveSearchTaxonomyIntent";
import type { Product } from "@/types/product";
import type { SearchProductsParams, SearchProductsResult, SearchSortOption } from "@/types/search";
import type { SearchFilterOptions } from "@/types/search";

const DEFAULT_SORT: SearchSortOption = "relevance";
/** Relevance path hard caps — Correctness PR must not raise these (01C). */
export const SEARCH_RELEVANCE_FETCH_LIMIT = 200;
export const SEARCH_RELEVANCE_RESULT_CAP = 100;
const RELEVANCE_FETCH_LIMIT = SEARCH_RELEVANCE_FETCH_LIMIT;
const MAX_LIMIT = SEARCH_RELEVANCE_RESULT_CAP;

export type SearchProductsByParamsOptions = SearchProductsParams & {
  page?: number;
  pageSize?: number;
  /** Injected in tests; production loads active taxonomies internally. */
  taxonomyContext?: SearchTaxonomyContext;
};

/**
 * 검색어 relevance 점수: 낮을수록 우선.
 * 1 title exact, 2 title prefix, 3 taxonomy exact (self),
 * 4 title contains, 5 taxonomy descendant, 6 category/theme text, 7 fallback
 */
export function relevanceScore(
  product: Product,
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

function scoreTaxonomyExact(product: Product, intent: SearchTaxonomyIntent): boolean {
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

function scoreTaxonomyDescendant(product: Product, intent: SearchTaxonomyIntent): boolean {
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

/**
 * 검색 대상: product title, category(지역명 등), theme.
 * @deprecated 검색 필터/정렬이 필요하면 searchProductsByParams 사용.
 */
export async function searchProducts(keyword: string): Promise<Product[]> {
  const result = await searchProductsByParams({
    q: keyword.trim() || undefined,
    page: 1,
    pageSize: MAX_LIMIT,
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

/**
 * params 기반 검색 (taxonomy-aware + multi-intent Correctness).
 * - single q: text ilike OR taxonomy scope
 * - multi-intent: Destination AND Theme AND ProductLine AND Golf AND remainingText
 * - URL region/theme/product_line: AND with keyword axes
 * - Relevance still capped at RELEVANCE_FETCH_LIMIT / MAX_LIMIT (01C)
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

  function baseQuery() {
    return applySearchAndFilters(
      supabase.from("products").select("*").eq("is_active", true),
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
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const fetchLimit = Math.min(RELEVANCE_FETCH_LIMIT, total);
    if (fetchLimit === 0) {
      return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
    }
    let dataQuery = baseQuery()
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(fetchLimit);
    const { data, error } = await dataQuery;
    if (error) {
      console.error("[search] searchProductsByParams error:", error.message);
      return { items: [], totalCount: total, page: safePage, pageSize, totalPages };
    }
    let products = ((data ?? []) as Record<string, unknown>[]).map((row) =>
      normalizeProduct(row),
    );
    products = products
      .sort((a, b) => {
        const sa = relevanceScore(a, q, rankingIntent);
        const sb = relevanceScore(b, q, rankingIntent);
        if (sa !== sb) return sa - sb;
        const orderA = a.sort_order ?? 9999;
        const orderB = b.sort_order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      })
      .slice(0, MAX_LIMIT);
    const seen = new Set<string>();
    products = products.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    products = hydrateProductsWithCampaignCardMeta(products, campaignTaxonomies);
    const totalRelevance = products.length;
    const totalPagesRelevance = Math.max(1, Math.ceil(totalRelevance / pageSize));
    const safePageRelevance = Math.min(Math.max(1, page), totalPagesRelevance);
    const from = (safePageRelevance - 1) * pageSize;
    const items = products.slice(from, from + pageSize);
    return {
      items,
      totalCount: totalRelevance,
      page: safePageRelevance,
      pageSize,
      totalPages: totalPagesRelevance,
    };
  }

  const { count: totalCount, error: countError } = await countQuery();
  if (countError) {
    console.error("[search] count error:", countError.message);
    return { items: [], totalCount: 0, page: 1, pageSize, totalPages: 0 };
  }
  const total = typeof totalCount === "number" ? totalCount : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  let dataQuery = baseQuery();
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
    return { items: [], totalCount: total, page: safePage, pageSize, totalPages };
  }
  let products = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    normalizeProduct(row),
  );
  products = hydrateProductsWithCampaignCardMeta(products, campaignTaxonomies);
  const seen = new Set<string>();
  products = products.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return { items: products, totalCount: total, page: safePage, pageSize, totalPages };
}

/**
 * 검색 결과 Product[]에서 필터 옵션 파생 (fallback).
 * @deprecated getSearchFilterOptions (taxonomies 기반) 사용 권장.
 */
export function deriveSearchFilterOptions(products: Product[]): SearchFilterOptions {
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
