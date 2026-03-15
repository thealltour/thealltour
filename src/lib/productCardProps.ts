import type { Product } from "@/types/product";
import type { ProductCardBadge, ProductCardProps, ProductCardStatus } from "@/components/products/ProductCard";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { getPrimaryImageUrl } from "@/lib/products/images";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

/**
 * Product → ProductCard badges (테마/카테고리 배지).
 * SearchResults, RelatedProductsSection, ProductCatalogSection, CuratedBlock 등에서 공통 사용.
 */
export function buildProductCardBadges(product: Product): ProductCardBadge[] {
  const themeBadges = getProductBadges(product);
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export type ProductToProductCardOverrides = Partial<
  Pick<ProductCardProps, "layout" | "analyticsSource" | "analyticsSection" | "onClickDetail" | "onClickConsult">
>;

/**
 * Product → ProductCard에 넘길 공통 props.
 * CuratedBlock, SearchResults, RelatedProductsSection, ProductCatalogSection, guides 등에서 재사용.
 */
export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> & ProductToProductCardOverrides {
  const status: ProductCardStatus = (product.status ?? "AVAILABLE") as ProductCardStatus;
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category].filter(Boolean),
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: buildProductCardBadges(product),
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta ?? "1인 기준",
    metaInfo: product.meta_info ?? "",
    overviewStay: product.overview_accommodation?.trim() || product.meta_info?.trim() || "",
    overviewRegion: product.overview_region?.trim() || product.theme?.trim() || product.category?.trim() || "",
    overviewDuration: product.overview_duration?.trim() || product.duration?.trim() || "",
    hrefDetail: `/products/${product.id}`,
    productId: product.id,
    layout: "grid",
    ...overrides,
  };
}
