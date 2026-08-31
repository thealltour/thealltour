import { getGuidesByDestinationId, getGuidesByThemeId } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import {
  buildRegionTree,
  buildTaxonomyNameMap,
  buildThemeTree,
  getActiveProductLineTaxonomies,
  getHubDestinations,
  getHubThemes,
  getProductTaxonomyOptions,
} from "@/lib/productTaxonomies";
import type { ProductListItem } from "@/lib/products/productListItem";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { RegionTreeNode } from "@/types/productTaxonomy";

export type ProductTaxonomyOptionsResult = Awaited<ReturnType<typeof getProductTaxonomyOptions>>;

export type ProductsListingTaxonomyContext = {
  hubDestinations: ProductTaxonomy[];
  hubThemes: ProductTaxonomy[];
  productLineTaxonomies: ProductTaxonomy[];
  taxonomyOptions: ProductTaxonomyOptionsResult;
  categories: string[];
  themes: string[];
  productLines: string[];
  regionTree: RegionTreeNode[];
  themeTree: RegionTreeNode[];
  taxonomyNameMap: Record<string, string>;
};

export type ProductsListingContext = ProductsListingTaxonomyContext & {
  /** Hub/landing pages: empty or bounded preview items — never full catalog. */
  products: ProductListItem[];
};

function finalizeTaxonomyContext(
  hubDestinations: ProductTaxonomy[],
  hubThemes: ProductTaxonomy[],
  productLineTaxonomies: ProductTaxonomy[],
  taxonomyOptions: ProductTaxonomyOptionsResult,
): ProductsListingTaxonomyContext {
  const { categories, themes } = taxonomyOptions;
  const productLinesFromTaxonomies = productLineTaxonomies
    .map((item) => item.name.trim())
    .filter(Boolean);
  const productLines =
    productLinesFromTaxonomies.length > 0 ? productLinesFromTaxonomies : taxonomyOptions.productLines;
  return {
    hubDestinations,
    hubThemes,
    productLineTaxonomies,
    taxonomyOptions,
    categories,
    themes,
    productLines,
    regionTree: buildRegionTree(hubDestinations),
    themeTree: buildThemeTree(hubThemes),
    taxonomyNameMap: buildTaxonomyNameMap([
      ...hubDestinations,
      ...hubThemes,
      ...productLineTaxonomies,
    ]),
  };
}

function finalizeListingContext(
  products: ProductListItem[],
  hubDestinations: ProductTaxonomy[],
  hubThemes: ProductTaxonomy[],
  productLineTaxonomies: ProductTaxonomy[],
  taxonomyOptions: ProductTaxonomyOptionsResult,
): ProductsListingContext {
  return {
    products,
    ...finalizeTaxonomyContext(
      hubDestinations,
      hubThemes,
      productLineTaxonomies,
      taxonomyOptions,
    ),
  };
}

/**
 * Browse `/products` index: taxonomy/filter UI only — no `getProducts()` full fetch.
 * Filter options come from hub taxonomies + product_line taxonomies (not product scan).
 */
export async function loadProductsListingTaxonomyContext(): Promise<ProductsListingTaxonomyContext> {
  const [taxonomyOptions, hubDestinations, hubThemes, productLineTaxonomies] = await Promise.all([
    getProductTaxonomyOptions([]),
    getHubDestinations(),
    getHubThemes(),
    getActiveProductLineTaxonomies(),
  ]);
  return finalizeTaxonomyContext(
    hubDestinations,
    hubThemes,
    productLineTaxonomies,
    taxonomyOptions,
  );
}

/**
 * `/products/region|theme/[slug]` listing shell — taxonomy only (01D-2A).
 * Product cards are fetched via bounded getProductListItems at the page/bundle layer.
 */
export async function loadProductsListingContext(
  _variant: "products_index" | "product_landing",
): Promise<ProductsListingContext> {
  const [taxonomyOptions, hubDestinations, hubThemes, productLineTaxonomies] = await Promise.all([
    getProductTaxonomyOptions([]),
    getHubDestinations(),
    getHubThemes(),
    getActiveProductLineTaxonomies(),
  ]);
  return finalizeListingContext(
    [],
    hubDestinations,
    hubThemes,
    productLineTaxonomies,
    taxonomyOptions,
  );
}

export type ProductsDestinationDetailListingBatch = ProductsListingContext & {
  destinationGuides: Awaited<ReturnType<typeof getGuidesByDestinationId>>;
  reviewHighlights: Awaited<ReturnType<typeof getTopRatedPublishedReviews>>;
};

/** `/destinations/[slug]` 두 번째 병렬 묶음 — taxonomy options from hub tables (not product scan). */
export async function loadProductsListingContextForDestinationDetail(
  _products: ProductListItem[],
  allDestinations: ProductTaxonomy[],
  destinationId: string,
): Promise<ProductsDestinationDetailListingBatch> {
  const [taxonomyOptions, hubThemes, destinationGuides, reviewHighlights, productLineTaxonomies] =
    await Promise.all([
      getProductTaxonomyOptions([]),
      getHubThemes(),
      getGuidesByDestinationId(destinationId, 4),
      getTopRatedPublishedReviews(4),
      getActiveProductLineTaxonomies(),
    ]);
  const base = finalizeListingContext(
    [],
    allDestinations,
    hubThemes,
    productLineTaxonomies,
    taxonomyOptions,
  );
  return { ...base, destinationGuides, reviewHighlights };
}

export type ProductsThemeDetailListingBatch = ProductsListingContext & {
  themeGuides: Awaited<ReturnType<typeof getGuidesByThemeId>>;
  reviewHighlights: Awaited<ReturnType<typeof getTopRatedPublishedReviews>>;
};

/** `/themes/[slug]` 두 번째 병렬 묶음 — taxonomy options from hub tables (not product scan). */
export async function loadProductsListingContextForThemeDetail(
  _products: ProductListItem[],
  allThemes: ProductTaxonomy[],
  themeId: string,
): Promise<ProductsThemeDetailListingBatch> {
  const [taxonomyOptions, destinations, themeGuides, reviewHighlights, productLineTaxonomies] =
    await Promise.all([
      getProductTaxonomyOptions([]),
      getHubDestinations(),
      getGuidesByThemeId(themeId, 4),
      getTopRatedPublishedReviews(4),
      getActiveProductLineTaxonomies(),
    ]);
  const base = finalizeListingContext(
    [],
    destinations,
    allThemes,
    productLineTaxonomies,
    taxonomyOptions,
  );
  return { ...base, themeGuides, reviewHighlights };
}
