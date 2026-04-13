import type { Product } from "@/types/product";
import type { ProductCardBadge, ProductCardProps, ProductCardStatus } from "@/components/products/ProductCard";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { buildCampaignRepresentativeBadges } from "@/lib/productCampaignBadges";
import { buildCampaignPitchLineFromProduct, resolveCampaignCardKind } from "@/lib/productCampaignPresentation";
import { pickProductCardHighlightTag } from "@/lib/products/productCardHighlightTag";

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

function withCheckFeaturedLine(raw: string): string | undefined {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 2) return undefined;
  const clipped =
    t.length > GUIDE_BRIDGE_SELECTION_MAX
      ? `${t.slice(0, Math.max(2, GUIDE_BRIDGE_SELECTION_MAX - 1))}…`
      : t;
  return clipped.startsWith("✔") ? clipped : `✔ ${clipped}`;
}

/**
 * 지역·테마 랜딩 `CuratedBlock` 대표 상품: 카드 하단 선택 이유 1줄.
 * 우선순위: 기간 → 숙박/구성(meta) → 테마 → 카테고리 → 태그 → 인기 폴백.
 */
export function getFeaturedHighlightLine(product: Product): string | undefined {
  const d = product.overview_duration?.trim() || product.duration?.trim();
  if (d) {
    const w = withCheckFeaturedLine(`${d} 일정`);
    if (w) return w;
  }

  const stay = product.overview_accommodation?.trim();
  if (stay) {
    const line = stay.length <= 28 ? stay : `${stay.slice(0, 26)}…`;
    const w = withCheckFeaturedLine(line);
    if (w) return w;
  }

  const meta = product.meta_info?.trim() ?? "";
  if (meta.length >= 4 && meta.length <= 34) {
    const w = withCheckFeaturedLine(meta);
    if (w) return w;
  }

  const themeRaw = product.theme?.trim();
  if (themeRaw) {
    const first = themeRaw.split(/[,，]/)[0]?.trim();
    if (first && first.length <= 26) {
      const w = withCheckFeaturedLine(`${first} 일정`);
      if (w) return w;
    }
  }

  const cat = product.category?.trim();
  if (cat && cat.length <= 22) {
    const w = withCheckFeaturedLine(`${cat} 코스`);
    if (w) return w;
  }

  const tags = parseMetaTitleAsHashtags(product.meta_title);
  const tag0 = tags[0]?.trim();
  if (tag0 && tag0.length <= 30) {
    const w = withCheckFeaturedLine(tag0.replace(/^#+/, ""));
    if (w) return w;
  }

  if (product.is_popular) return "✔ 인기 일정";
  return undefined;
}

/** @deprecated `getFeaturedHighlightLine`와 동일 — 하위 호환 */
export function buildCuratedFeaturedSelectionLine(product: Product): string | undefined {
  return getFeaturedHighlightLine(product);
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
 * 테마·카테고리 기반 **정보성** 배지 (대표 배지 오버레이에 쓰지 않음).
 */
export function buildProductCardInfoBadges(product: Product): ProductCardBadge[] {
  const themeBadges = getProductBadges(product);
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

/**
 * @deprecated `buildProductCardInfoBadges` 사용 — 이름이 혼동되기 쉬워 분리됨.
 */
export function buildProductCardBadges(product: Product): ProductCardBadge[] {
  return buildProductCardInfoBadges(product);
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
    | "badges"
    | "infoBadges"
    | "campaignPitchLine"
    | "campaignPresentationKind"
    | "highlightTag"
    | "emphasizeLandingHubHover"
  >
> & {
  /** 기본: list/mobile presentation이면 1, 그 외 2 */
  campaignBadgeMax?: number;
  /** 기본: list/mobile presentation이면 true(피치 생략) */
  omitCampaignPitch?: boolean;
};

export type { CampaignCardKind } from "@/lib/productCampaignPresentation";

/** 카드 표현만 다를 뿐 동일 campaign 소스 — 최대 개수 정책 */
export const CAMPAIGN_BADGE_MAX = {
  related: 2,
  grid: 2,
  home: 2,
  list: 1,
  listMobile: 1,
} as const;

function defaultCampaignBadgeMax(overrides: ProductToProductCardOverrides | undefined): number {
  if (overrides?.campaignBadgeMax != null) return Math.max(1, Math.min(2, overrides.campaignBadgeMax));
  const pk = overrides?.campaignPresentationKind;
  if (pk === "list" || pk === "mobile") return 1;
  return 2;
}

function defaultOmitCampaignPitch(overrides: ProductToProductCardOverrides | undefined): boolean {
  if (overrides?.omitCampaignPitch != null) return overrides.omitCampaignPitch;
  const pk = overrides?.campaignPresentationKind;
  return pk === "list" || pk === "mobile";
}

/**
 * Product → ProductCard에 넘길 공통 props.
 * CuratedBlock, SearchResults, RelatedProductsSection, ProductCatalogSection, ProductListCard* , guides 등에서 재사용.
 * CTR: oneLiner / ratingAvg / reviewCount 는 리스트 카드와 그리드 카드 동일 파이프라인.
 */
export function productToProductCardProps(
  product: Product,
  overrides?: ProductToProductCardOverrides,
): Omit<ProductCardProps, "onClickDetail" | "onClickConsult"> &
  Partial<ProductToProductCardOverrides> {
  const { campaignBadgeMax: _maxMeta, omitCampaignPitch: _pitchMeta, ...restOverrides } =
    overrides ?? {};
  void _maxMeta;
  void _pitchMeta;

  const status: ProductCardStatus = (product.status ?? "AVAILABLE") as ProductCardStatus;
  const isRelatedSection = overrides?.analyticsSection === "related_products";
  const layoutBase = overrides?.layout ?? "grid";
  const effectiveLayout = isRelatedSection ? ("related" as const) : layoutBase;
  const campaignKind = resolveCampaignCardKind({
    layout: effectiveLayout,
    analyticsSection: overrides?.analyticsSection ?? null,
    presentationKind: overrides?.campaignPresentationKind,
  });
  const maxBadges = defaultCampaignBadgeMax(overrides);
  const campaignBadges = buildCampaignRepresentativeBadges(product, { max: maxBadges });
  const highlightTag = pickProductCardHighlightTag(product);
  const overlayBadges = highlightTag ? [] : campaignBadges;
  const infoBadges = buildProductCardInfoBadges(product);
  const campaignPitchLine =
    highlightTag || defaultOmitCampaignPitch(overrides)
      ? undefined
      : buildCampaignPitchLineFromProduct(product, campaignKind);
  return {
    title: product.title,
    price: product.price,
    seasonal_price_bands: product.seasonal_price_bands ?? undefined,
    duration: product.duration,
    region: product.theme,
    categories: [product.category].filter(Boolean),
    tags: parseMetaTitleAsHashtags(product.meta_title),
    status,
    badges: overlayBadges,
    infoBadges,
    campaignPitchLine,
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
    highlightTag,
    ...restOverrides,
    ...(isRelatedSection ? { layout: "related" as const } : {}),
  };
}
