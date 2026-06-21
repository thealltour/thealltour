import type { IconName } from "@/icons";
import { buildProductsFilterHref } from "@/lib/productFilters";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";

/**
 * 홈 히어로 모바일 "빠른 선택 허브" 고정 액션.
 * URL은 /products 쿼리 키(region/theme/tourType/q)와 동일하게 유지.
 * 골프는 tourType=golf-park 채널(헤더·골프 섹션과 동일).
 */
export type HomeHeroQuickAction = {
  id: string;
  label: string;
  href: string;
  iconName: IconName;
  /** 스크린리더용 보조 설명 (선택) */
  ariaLabel?: string;
};

export const HOME_HERO_QUICK_ACTIONS: readonly HomeHeroQuickAction[] = [
  {
    id: "golf",
    label: "골프 여행",
    href: buildGolfProductsHref(),
    iconName: "golf",
    ariaLabel: "골프 여행 상품 보기",
  },
  {
    id: "healing",
    label: "휴양·힐링",
    href: buildProductsFilterHref({ theme: "healing" }),
    iconName: "healing",
    ariaLabel: "휴양·힐링 테마 상품 보기",
  },
  {
    id: "family",
    label: "가족 여행",
    href: buildProductsFilterHref({ theme: "family" }),
    iconName: "family",
    ariaLabel: "가족 여행 테마 상품 보기",
  },
  {
    id: "luxury",
    label: "럭셔리",
    href: buildProductsFilterHref({ theme: "luxury" }),
    iconName: "luxury",
    ariaLabel: "럭셔리 테마 상품 보기",
  },
  {
    id: "all",
    label: "전체보기",
    href: "/products",
    iconName: "explore",
    ariaLabel: "전체 상품 목록으로 이동",
  },
] as const;
