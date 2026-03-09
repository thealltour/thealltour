/**
 * 랜딩 페이지용 타입 (region/theme).
 * 후속 PR에서 실제 랜딩 UI가 이 shape를 소비.
 */

import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type ProductLandingType = "region" | "theme";

export type ProductLandingHero = {
  eyebrow: string;
  title: string;
  description: string;
  /** 카테고리/테마 관리에서 저장한 히어로 배경 이미지. 없으면 카드 스타일만 표시 */
  imageUrl?: string | null;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export type ProductLandingFeaturedLink = {
  key: string;
  label: string;
  href: string;
};

export type ProductLandingProductSummary = {
  id: string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
  price?: string | number | null;
  href: string;
  categories?: string[];
  themes?: string[];
};

export type ProductLandingData = {
  type: ProductLandingType;
  slug: string;
  taxonomyName: string;
  taxonomySlug: string | null;
  hero: ProductLandingHero;
  featuredLinks: ProductLandingFeaturedLink[];
  recommendedProducts: ProductLandingProductSummary[];
  relatedTaxonomies: ProductLandingFeaturedLink[];
  productCount: number;
  /** region 랜딩일 때만: 현재 지역의 소분류(도시·지역) 카드용. card_image_url은 서버에서 fallback 적용 후 전달 */
  childDestinations?: ProductTaxonomy[];
  /** theme 랜딩일 때만: 현재 테마의 하위 테마 카드용. card_image_url은 서버에서 fallback 적용 후 전달 */
  childThemes?: ProductTaxonomy[];
};
