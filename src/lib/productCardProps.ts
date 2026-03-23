import type { Product } from "@/types/product";
import type { ProductCardBadge, ProductCardProps, ProductCardStatus } from "@/components/products/ProductCard";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { getPrimaryImageUrl } from "@/lib/products/images";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

const GUIDE_BRIDGE_SELECTION_MAX = 40;

/**
 * 가이드 브리지 related 카드: 가격 아래 1줄 클릭 맥락 (메타·숙소·태그·테마·카테고리·기간 순).
 * 데이터가 없으면 undefined (렌더 생략).
 */
export function buildGuideBridgeSelectionLine(product: Product): string | undefined {
  const withCheck = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 2) return undefined;
    const clipped =
      t.length > GUIDE_BRIDGE_SELECTION_MAX
        ? `${t.slice(0, Math.max(2, GUIDE_BRIDGE_SELECTION_MAX - 1))}…`
        : t;
    return clipped.startsWith("✔") ? clipped : `✔ ${clipped}`;
  };

  const stay = product.overview_accommodation?.trim();
  if (stay) {
    const line = stay.length <= 28 ? stay : `${stay.slice(0, 26)}…`;
    const w = withCheck(line);
    if (w) return w;
  }

  const meta = product.meta_info?.trim() ?? "";
  if (meta.length >= 4 && meta.length <= 34) {
    const w = withCheck(meta);
    if (w) return w;
  }

  const tags = parseMetaTitleAsHashtags(product.meta_title);
  const tag0 = tags[0]?.trim();
  if (tag0 && tag0.length <= 30) {
    const w = withCheck(tag0.replace(/^#+/, ""));
    if (w) return w;
  }

  const themeRaw = product.theme?.trim();
  if (themeRaw) {
    const first = themeRaw.split(/[,，]/)[0]?.trim();
    if (first && first.length <= 26) {
      const w = withCheck(`${first} 일정`);
      if (w) return w;
    }
  }

  const cat = product.category?.trim();
  if (cat && cat.length <= 22) {
    const w = withCheck(`${cat} 코스`);
    if (w) return w;
  }

  const d = product.duration?.trim();
  if (d) {
    const w = withCheck(`${d} 일정`);
    if (w) return w;
  }

  return undefined;
}

/** 가이드 브리지 등: 기간·카테고리·테마로 클릭 맥락 한 줄 */
export function buildProductExperienceSummary(product: Product): string {
  const parts: string[] = [];
  const d = product.duration?.trim();
  if (d) parts.push(d);
  const c = product.category?.trim();
  if (c) parts.push(c);
  const raw = product.theme?.trim();
  if (raw) {
    const first = raw.split(/[,，]/)[0]?.trim();
    if (first) parts.push(first.length > 24 ? `${first.slice(0, 22)}…` : first);
  }
  if (parts.length === 0) return "일정과 구성은 상세에서 확인할 수 있어요";
  return parts.join(" · ");
}

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
  Pick<
    ProductCardProps,
    | "layout"
    | "analyticsSource"
    | "analyticsSection"
    | "onClickDetail"
    | "onClickConsult"
    | "hrefDetail"
    | "oneLiner"
    | "ratingAvg"
    | "reviewCount"
    | "className"
    | "topPickLabel"
    | "experienceSummary"
    | "emphasizeFirstOnMobile"
    | "guideBridgeNarrowCopy"
    | "selectionHighlightLine"
  >
>;

/**
 * Product → ProductCard에 넘길 공통 props.
 * CuratedBlock, SearchResults, RelatedProductsSection, ProductCatalogSection, ProductListCard* , guides 등에서 재사용.
 * CTR: oneLiner / ratingAvg / reviewCount 는 리스트 카드와 그리드 카드 동일 파이프라인.
 */
export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> & ProductToProductCardOverrides {
  const status: ProductCardStatus = (product.status ?? "AVAILABLE") as ProductCardStatus;
  const isRelatedSection = overrides?.analyticsSection === "related_products";
  const baseBadges: ProductCardBadge[] = [
    ...buildProductCardBadges(product),
    ...(product.is_popular ? [{ type: "accent", label: "인기", priority: 10, isActive: true }] : []),
    ...(product.is_recommend ? [{ type: "accent", label: "추천", priority: 9, isActive: true }] : []),
  ];
  return {
    title: product.title,
    price: product.price,
    duration: product.duration,
    region: product.theme,
    categories: [product.category].filter(Boolean),
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: baseBadges,
    thumbnailUrl: getPrimaryImageUrl(product),
    priceMeta: product.price_meta ?? "1인 기준",
    metaInfo: product.meta_info ?? "",
    overviewStay: product.overview_accommodation?.trim() || product.meta_info?.trim() || "",
    overviewRegion: product.overview_region?.trim() || product.theme?.trim() || product.category?.trim() || "",
    overviewDuration: product.overview_duration?.trim() || product.duration?.trim() || "",
    hrefDetail: `/products/${product.id}`,
    productId: product.id,
    layout: "grid",
    oneLiner: product.one_liner?.trim() || undefined,
    ratingAvg: product.trust?.ratingAvg,
    reviewCount: product.trust?.reviewCount,
    ...overrides,
    ...(isRelatedSection ? { layout: "related" as const } : {}),
  };
}
