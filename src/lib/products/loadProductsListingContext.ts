import { getGuidesByDestinationId, getGuidesByThemeId } from "@/lib/guides";
import { getProducts } from "@/lib/products";
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
import type { Product } from "@/types/product";
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
  products: Product[];
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
  products: Product[],
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

export async function loadProductsListingContext(
  variant: "products_index",
): Promise<ProductsListingContext>;
/** `/products/region|theme/[slug]` 랜딩 하단 목록: 기존과 동일하게 허브·상품 4-way 병렬 후 taxonomy 옵션 순차 */
export async function loadProductsListingContext(
  variant: "product_landing",
): Promise<ProductsListingContext>;
export async function loadProductsListingContext(
  variant: "products_index" | "product_landing",
): Promise<ProductsListingContext> {
  if (variant === "products_index") {
    const products = await getProducts();
    const [taxonomyOptions, hubDestinations, hubThemes, productLineTaxonomies] = await Promise.all([
      getProductTaxonomyOptions(products),
      getHubDestinations(),
      getHubThemes(),
      getActiveProductLineTaxonomies(),
    ]);
    return finalizeListingContext(
      products,
      hubDestinations,
      hubThemes,
      productLineTaxonomies,
      taxonomyOptions,
    );
  }

  const [hubDestinations, products, hubThemes, productLineTaxonomies] = await Promise.all([
    getHubDestinations(),
    getProducts(),
    getHubThemes(),
    getActiveProductLineTaxonomies(),
  ]);
  const taxonomyOptions = await getProductTaxonomyOptions(products);
  return finalizeListingContext(
    products,
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

/** `/destinations/[slug]` 두 번째 병렬 묶음 — 호출 순서·병렬 구성 유지 */
export async function loadProductsListingContextForDestinationDetail(
  products: Product[],
  allDestinations: ProductTaxonomy[],
  destinationId: string,
): Promise<ProductsDestinationDetailListingBatch> {
  const [taxonomyOptions, hubThemes, destinationGuides, reviewHighlights, productLineTaxonomies] =
    await Promise.all([
      getProductTaxonomyOptions(products),
      getHubThemes(),
      getGuidesByDestinationId(destinationId, 4),
      getTopRatedPublishedReviews(4),
      getActiveProductLineTaxonomies(),
    ]);
  const base = finalizeListingContext(
    products,
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

/** `/themes/[slug]` 두 번째 병렬 묶음 — 호출 순서·병렬 구성 유지 */
export async function loadProductsListingContextForThemeDetail(
  products: Product[],
  allThemes: ProductTaxonomy[],
  themeId: string,
): Promise<ProductsThemeDetailListingBatch> {
  const [taxonomyOptions, destinations, themeGuides, reviewHighlights, productLineTaxonomies] =
    await Promise.all([
      getProductTaxonomyOptions(products),
      getHubDestinations(),
      getGuidesByThemeId(themeId, 4),
      getTopRatedPublishedReviews(4),
      getActiveProductLineTaxonomies(),
    ]);
  const base = finalizeListingContext(
    products,
    destinations,
    allThemes,
    productLineTaxonomies,
    taxonomyOptions,
  );
  return { ...base, themeGuides, reviewHighlights };
}
