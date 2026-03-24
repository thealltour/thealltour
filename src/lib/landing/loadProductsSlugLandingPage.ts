import { buildDestinationFallbackImageMap } from "@/lib/landing/buildDestinationFallbackImageMap";
import { loadProductsListingContext } from "@/lib/products/loadProductsListingContext";
import {
  getSelfAndDescendantIdsAndNames,
  parseThemeTokens,
} from "@/lib/productTaxonomies";
import type { ProductFiltersState } from "@/lib/productFilters";
import type { Product } from "@/types/product";
import type { ProductLandingData } from "@/types/productLanding";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { ProductsListingContext } from "@/lib/products/loadProductsListingContext";

export type ProductsRegionLandingPageBundle = {
  dataWithChildren: ProductLandingData;
  listing: ProductsListingContext;
  initialFiltersFromServer: ProductFiltersState;
  initialRegionDescendants: { ids: string[]; names: string[] };
};

/**
 * `/products/region/[slug]` 본문 — 랜딩 분기에서 `getProductLandingData` 성공 후 하위 데이터 묶음.
 * (redirect / 레거시 쿼리 분기는 page에 유지)
 */
export async function loadProductsRegionLandingPageBundle(
  trimmedSlug: string,
  landingData: ProductLandingData,
): Promise<ProductsRegionLandingPageBundle> {
  let dataWithChildren = landingData;
  const listing = await loadProductsListingContext("product_landing");
  const { products, hubDestinations: allDestinations } = listing;

  const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
  const parent = allDestinations.find(
    (d) =>
      (d.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
      d.name?.trim() === landingData.taxonomyName,
  );
  if (parent) {
    const parentId = parent.id.trim();
    const childDestinations = allDestinations
      .filter((d) => (d.parent_id ?? "").trim() === parentId)
      .sort((a, b) => {
        const sa = a.sort_order ?? 9999;
        const sb = b.sort_order ?? 9999;
        if (sa !== sb) return sa - sb;
        return (a.name ?? "").localeCompare(b.name ?? "", "ko");
      });
    const fallbackMap = buildDestinationFallbackImageMap(childDestinations, products);
    const childDestinationsWithImages = childDestinations.map((d) => {
      const cardImageUrl =
        d.card_image_url?.trim() ||
        fallbackMap.get(d.id) ||
        fallbackMap.get(d.name.trim().toLowerCase()) ||
        undefined;
      return { ...d, card_image_url: cardImageUrl ?? d.card_image_url };
    });
    dataWithChildren = { ...landingData, childDestinations: childDestinationsWithImages };
  }

  const initialFiltersFromServer: ProductFiltersState = {
    region: landingData.taxonomyName,
    theme: null,
    product_line: null,
    q: null,
    sort: "" as const,
    collection: null,
  };
  const initialRegionDescendants = getSelfAndDescendantIdsAndNames(
    allDestinations,
    landingData.taxonomyName,
  );

  return {
    dataWithChildren,
    listing,
    initialFiltersFromServer,
    initialRegionDescendants,
  };
}

function buildThemeFallbackImageMap(
  themes: ProductTaxonomy[],
  products: Product[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of themes) {
    const nameLower = t.name.trim().toLowerCase();
    if (map.has(nameLower)) continue;
    const first = products.find(
      (p) =>
        p.image_url?.trim() &&
        parseThemeTokens(p.theme).map((x) => x.trim().toLowerCase()).includes(nameLower),
    );
    if (first?.image_url?.trim()) map.set(nameLower, first.image_url.trim());
  }
  return map;
}

export type ProductsThemeLandingPageBundle = {
  dataWithChildren: ProductLandingData;
  listing: ProductsListingContext;
  initialFiltersFromServer: ProductFiltersState;
  initialThemeDescendantNames: string[];
};

/**
 * `/products/theme/[slug]` 본문 — 랜딩 분기에서 `getProductLandingData` 성공 후 하위 데이터 묶음.
 */
export async function loadProductsThemeLandingPageBundle(
  trimmedSlug: string,
  landingData: ProductLandingData,
): Promise<ProductsThemeLandingPageBundle> {
  let dataWithChildren = landingData;
  const listing = await loadProductsListingContext("product_landing");
  const { products, hubThemes: allThemes } = listing;

  const normalizedSlug = trimmedSlug.toLowerCase().replace(/\s+/g, "-");
  const parent = allThemes.find(
    (t) =>
      (t.slug?.trim().toLowerCase().replace(/\s+/g, "-") === normalizedSlug) ||
      t.name?.trim() === landingData.taxonomyName,
  );
  if (parent) {
    const parentId = parent.id.trim();
    const childThemes = allThemes
      .filter((t) => (t.parent_id ?? "").trim() === parentId)
      .sort((a, b) => {
        const sa = a.sort_order ?? 9999;
        const sb = b.sort_order ?? 9999;
        if (sa !== sb) return sa - sb;
        return (a.name ?? "").localeCompare(b.name ?? "", "ko");
      });
    const fallbackMap = buildThemeFallbackImageMap(childThemes, products);
    const childThemesWithImages = childThemes.map((t) => {
      const nameKey = t.name.trim().toLowerCase();
      const cardImageUrl =
        t.card_image_url?.trim() ||
        fallbackMap.get(nameKey) ||
        undefined;
      return { ...t, card_image_url: cardImageUrl ?? t.card_image_url };
    });
    dataWithChildren = { ...landingData, childThemes: childThemesWithImages };
  }

  const initialFiltersFromServer: ProductFiltersState = {
    region: null,
    theme: landingData.taxonomyName,
    product_line: null,
    q: null,
    sort: "" as const,
    collection: null,
  };
  const initialThemeDescendantNames = getSelfAndDescendantIdsAndNames(
    allThemes,
    landingData.taxonomyName,
  ).names;

  return {
    dataWithChildren,
    listing,
    initialFiltersFromServer,
    initialThemeDescendantNames,
  };
}
