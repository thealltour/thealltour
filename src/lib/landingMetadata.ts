import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { HomeCuratedSection } from "@/types/homeCurated";

/**
 * [slug] 상세 랜딩 페이지용 메타/히어로 이미지 fallback.
 * 우선순위대로 사용하면 되며, 상세 페이지 미구현 단계에서도 유틸만 준비.
 */

export type MetadataFallback = {
  title: string;
  description: string;
};

/**
 * 지역/테마 taxonomy 메타 fallback.
 * 1. seo_title, seo_description
 * 2. landing_title, landing_description
 * 3. name, card_description
 */
export function getTaxonomyMetadataFallback(item: ProductTaxonomy): MetadataFallback {
  const title =
    item.seo_title?.trim() ||
    item.landing_title?.trim() ||
    item.name.trim() ||
    "상세";
  const description =
    item.seo_description?.trim() ||
    item.landing_description?.trim() ||
    item.card_description?.trim() ||
    "";
  return { title, description };
}

/**
 * 지역/테마 히어로 이미지 fallback.
 * 1. hero_image_url
 * 2. card_image_url
 * 3. null (호출 측에서 공통 fallback URL 사용)
 */
export function getTaxonomyHeroImageFallback(
  item: ProductTaxonomy,
): string | null {
  const url = item.hero_image_url?.trim() || item.card_image_url?.trim();
  return url || null;
}

/** 추천 섹션은 현재 seo/landing 필드 없음. 확장 시 타입에 추가 후 우선순위 반영. */
export function getRecommendedSectionMetadataFallback(
  section: HomeCuratedSection,
): MetadataFallback {
  const title = section.title?.trim() || "추천 상품";
  const description = section.description?.trim() || "";
  return { title, description };
}

/** 상세 랜딩 공통 히어로 이미지 fallback (taxonomy/section에 이미지 없을 때) */
export const LANDING_HERO_FALLBACK_IMAGE =
  "https://picsum.photos/seed/thealltour-landing/1600/900";

/** `/destinations`·`/themes` 허브 히어로 배경 (정적 자산 `public/images/hub/*`) */
export const HUB_HERO_DESTINATIONS_IMAGE = "/images/hub/hub-hero-destinations.png";
export const HUB_HERO_THEMES_IMAGE = "/images/hub/hub-hero-themes.png";

export type HubHeroConfig = {
  imageUrl: string;
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
};

/**
 * 허브별 이미지형 LandingHero에 넣을 기본 설정.
 * 향후 관리자에서 허브별 hero를 관리할 때 이 반환값을 덮어쓰면 됨.
 */
export function getHubHeroConfig(hub: "destinations" | "themes"): HubHeroConfig {
  if (hub === "destinations") {
    return {
      imageUrl: HUB_HERO_DESTINATIONS_IMAGE,
      eyebrow: "지역별 여행",
      title: "지역별 여행",
      description:
        "가고 싶은 지역부터 여행을 찾아볼 수 있도록 안내합니다. 지역을 선택하면 해당 지역의 상품을 바로 둘러보실 수 있습니다.",
      ctaLabel: "전체 상품 보기",
      ctaHref: "/products",
      secondaryCtaLabel: "맞춤 상담 문의",
      secondaryCtaHref: "/quote",
    };
  }
  return {
    imageUrl: HUB_HERO_THEMES_IMAGE,
    eyebrow: "테마별 여행",
    title: "테마별 여행",
    description:
      "원하는 여행 스타일과 목적에 맞춰 테마별 상품을 살펴보실 수 있습니다. 골프, 휴양, 가족여행, 허니문 등 테마로 찾아보세요.",
    ctaLabel: "전체 상품 보기",
    ctaHref: "/products",
    secondaryCtaLabel: "맞춤 상담 문의",
    secondaryCtaHref: "/quote",
  };
}
