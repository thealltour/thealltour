/**
 * POST-UI-01B-1 / 01B-1.1: URL/Browse filter names → repository-ready getProductsPage params.
 * Pure (no DB). Destination scope via shared resolveDestinationScope (ids + names).
 */

import {
  PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE,
  type ProductCollectionId,
} from "@/lib/productFilters";
import {
  GOLF_PRESET_CATEGORIES,
  GOLF_REGION_PRESET_DESTINATION_ROOTS,
  collectDestinationIdsAndNamesForRoots,
  isGolfProductLineTaxonomy,
  isGolfTourType,
  parseGolfRegionPresetId,
} from "@/lib/products/golfChannel";
import {
  type GetProductsPageParams,
  type ProductListingDbFilters,
  type ProductListingSort,
  type ProductListingSortInput,
  resolveProductListingSort,
} from "@/lib/products/productListingQuery";
import { resolveDestinationScope } from "@/lib/search/resolveDestinationScope";
import { getSelfAndDescendantIdsAndNames } from "@/lib/productTaxonomies";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type ProductListingUrlFilters = {
  region?: string | null;
  theme?: string | null;
  productLine?: string | null;
  /** Alias for product_line URL key */
  product_line?: string | null;
  collection?: string | null;
  tourType?: string | null;
  golfRegion?: string | null;
  sort?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

export type ProductListingTaxonomyContext = {
  destinations: ProductTaxonomy[];
  themes: ProductTaxonomy[];
  productLines: Array<Pick<ProductTaxonomy, "id" | "name" | "slug">>;
  campaignNamesByCollection?: {
    recommend?: string[];
    popular?: string[];
  };
};

export type BuildProductListingQueryParamsInput = {
  filters: ProductListingUrlFilters;
  taxonomy: ProductListingTaxonomyContext;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function resolveProductLineIdByName(
  productLines: Array<Pick<ProductTaxonomy, "id" | "name">>,
  name: string,
): string | null {
  const target = name.trim();
  if (!target) return null;
  const found = productLines.find((p) => (p.name ?? "").trim() === target);
  return found?.id?.trim() || null;
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

function parseCollectionId(raw: string | null): ProductCollectionId | null {
  if (!raw) return null;
  const c = raw.trim();
  if (c === "recommend" || c === "popular" || c === "new") return c;
  return null;
}

/**
 * Map UI sort / collection=new into DB sort.
 * Explicit sort wins over collection=new (matches applyProductFilters order).
 */
export function resolveListingSortFromUrl(input: {
  sort?: string | null;
  collection?: string | null;
}): ProductListingSort {
  const sortRaw = trimOrNull(input.sort) as ProductListingSortInput;
  const collection = parseCollectionId(trimOrNull(input.collection));

  if (
    sortRaw === "recommended" ||
    sortRaw === "latest" ||
    sortRaw === "price_asc" ||
    sortRaw === "price_desc" ||
    sortRaw === "popular" ||
    sortRaw === "new"
  ) {
    return resolveProductListingSort(sortRaw);
  }

  if (collection === "new") {
    return "latest";
  }

  return resolveProductListingSort(sortRaw);
}

/**
 * Build GetProductsPageParams from Browse URL-facing filters + taxonomy context.
 * Does not call the network. Unknown collection values are ignored (Browse memory semantics).
 * Region with empty ids AND names → matchNone (no full-catalog fallback).
 */
export function buildProductListingQueryParams(
  input: BuildProductListingQueryParamsInput,
): GetProductsPageParams {
  const { filters, taxonomy } = input;
  const region = trimOrNull(filters.region);
  const theme = trimOrNull(filters.theme);
  const productLine =
    trimOrNull(filters.productLine) ?? trimOrNull(filters.product_line);
  const collection = parseCollectionId(trimOrNull(filters.collection));
  const tourType = trimOrNull(filters.tourType);
  const golfRegionRaw = trimOrNull(filters.golfRegion);
  const golfMode = isGolfTourType(tourType);

  const dbFilters: ProductListingDbFilters = {};
  let matchNone = false;

  // --- region / golfRegion → destinationScope { ids, names } ---
  if (region) {
    const scope = resolveDestinationScope(region, taxonomy.destinations);
    if (scope.ids.length === 0 && scope.names.length === 0) {
      matchNone = true;
    } else {
      dbFilters.destinationScope = scope;
    }
  } else if (golfMode && golfRegionRaw) {
    const preset = parseGolfRegionPresetId(golfRegionRaw);
    if (preset) {
      const roots = GOLF_REGION_PRESET_DESTINATION_ROOTS[preset];
      const { ids, names } = collectDestinationIdsAndNamesForRoots(
        taxonomy.destinations,
        roots,
      );
      // Memory: empty taxonomy roots → do not apply region filter (all golf products).
      const idList = [...ids];
      const nameList = [...names];
      if (idList.length > 0 || nameList.length > 0) {
        dbFilters.destinationScope = { ids: idList, names: nameList };
      }
    }
  }

  // --- theme → themeNames (self + descendants) ---
  if (theme) {
    const { names } = getSelfAndDescendantIdsAndNames(taxonomy.themes, theme);
    dbFilters.themeNames = names.length > 0 ? names : [theme];
  }

  // --- product_line ---
  if (productLine) {
    if (productLine === PACKAGE_TRAVEL_UNASSIGNED_PRODUCT_LINE) {
      dbFilters.unassignedProductLine = true;
    } else {
      const id = resolveProductLineIdByName(taxonomy.productLines, productLine);
      if (id) {
        dbFilters.productLineId = id;
      } else {
        matchNone = true;
      }
    }
  }

  // --- collection recommend/popular (new → sort only) ---
  if (collection === "recommend" || collection === "popular") {
    const names =
      collection === "recommend"
        ? taxonomy.campaignNamesByCollection?.recommend
        : taxonomy.campaignNamesByCollection?.popular;
    dbFilters.collection = {
      kind: collection,
      campaignNames: (names ?? []).map((n) => n.trim()).filter(Boolean),
    };
  }

  // --- golf channel ---
  if (golfMode) {
    dbFilters.golfChannel = {
      productLineIds: collectGolfProductLineIds(taxonomy.productLines),
      legacyCategories: [...GOLF_PRESET_CATEGORIES],
    };
  }

  if (matchNone) {
    dbFilters.matchNone = true;
  }

  const page =
    typeof filters.page === "number" && Number.isFinite(filters.page)
      ? filters.page
      : undefined;
  const pageSize =
    typeof filters.pageSize === "number" && Number.isFinite(filters.pageSize)
      ? filters.pageSize
      : undefined;

  return {
    page,
    pageSize,
    sort: resolveListingSortFromUrl({
      sort: filters.sort,
      collection: filters.collection,
    }),
    filters: dbFilters,
  };
}
