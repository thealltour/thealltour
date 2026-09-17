import { Compass, Flag, Gem, LayoutGrid, Users, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { buildProductsFilterHref } from "@/lib/productFilters";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";

/**
 * 홈 히어로 모바일 "빠른 선택 허브" 고정 액션.
 * URL은 /products 쿼리 키(region/theme/tourType/q)와 동일하게 유지.
 * Planner는 feature flag로 두 번째 진입축으로 추가(기존 테마 탐색 CTA 유지).
 */
export type HomeHeroQuickActionId =
  | "golf"
  | "planner"
  | "healing"
  | "family"
  | "luxury"
  | "all";

export type HomeHeroQuickAction = {
  id: HomeHeroQuickActionId;
  label: string;
  href: string;
  /** 스크린리더용 보조 설명 (선택) */
  ariaLabel?: string;
};

const BASE_HOME_HERO_QUICK_ACTIONS: readonly HomeHeroQuickAction[] = [
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

const PLANNER_QUICK_ACTION: HomeHeroQuickAction = {
  id: "planner",
  label: "자유여행 만들기",
  href: "/planner",
  ariaLabel: "내 일정에 맞는 자유여행 플랜 만들기",
};

/** Feature flag를 반영한 홈 히어로 Quick Action 목록. */
export function getHomeHeroQuickActions(options?: {
  /** test override; defaults to ENABLE_FREE_TRAVEL_PLANNER */
  enabled?: boolean;
}): HomeHeroQuickAction[] {
  const enabled = options?.enabled ?? ENABLE_FREE_TRAVEL_PLANNER;
  if (!enabled) {
    return [...BASE_HOME_HERO_QUICK_ACTIONS];
  }
  // 골프 다음 두 번째 슬롯에 Planner 삽입 — 기존 테마 CTA는 유지
  const [golf, ...rest] = BASE_HOME_HERO_QUICK_ACTIONS;
  return [golf, PLANNER_QUICK_ACTION, ...rest];
}

/** @deprecated Prefer getHomeHeroQuickActions() for flag-aware list */
export const HOME_HERO_QUICK_ACTIONS = BASE_HOME_HERO_QUICK_ACTIONS;

export const HOME_HERO_QUICK_ACTION_ICONS: Record<HomeHeroQuickActionId, LucideIcon> = {
  golf: Flag,
  planner: Compass,
  healing: Waves,
  family: Users,
  luxury: Gem,
  all: LayoutGrid,
};
