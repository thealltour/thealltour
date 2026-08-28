import { buildProductsFilterHref } from "@/lib/productFilters";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";

/**
 * 홈 히어로 모바일 "빠른 선택 허브" 고정 액션 (5개 동일 그룹).
 * URL은 /products 쿼리 키(region/theme/tourType/q)와 동일하게 유지.
 */
export type HomeHeroQuickAction = {
  id: "golf" | "healing" | "family" | "luxury" | "all";
  label: string;
  href: string;
  /** 스크린리더용 보조 설명 (선택) */
  ariaLabel?: string;
};

export const HOME_HERO_QUICK_ACTIONS: readonly HomeHeroQuickAction[] = [
  {
    id: "golf",
    label: "골프 여행",
    href: buildGolfProductsHref(),
    ariaLabel: "골프 여행 상품 보기",
  },
  {
    id: "healing",
    label: "휴양·힐링",
    href: buildProductsFilterHref({ theme: "healing" }),
    ariaLabel: "휴양·힐링 테마 상품 보기",
  },
  {
    id: "family",
    label: "가족 여행",
    href: buildProductsFilterHref({ theme: "family" }),
    ariaLabel: "가족 여행 테마 상품 보기",
  },
  {
    id: "luxury",
    label: "럭셔리",
    href: buildProductsFilterHref({ theme: "luxury" }),
    ariaLabel: "럭셔리 테마 상품 보기",
  },
  {
    id: "all",
    label: "전체 상품",
    href: "/products",
    ariaLabel: "전체 상품 목록으로 이동",
  },
] as const;
