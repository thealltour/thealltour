/**
 * 모바일 관리자(MVP) 전용 상수.
 * 데스크톱 sidebarConfig와 분리 유지 — 추후 경로 prefix(/m-admin) 분리 시 이 모듈만 이전하기 쉽게 둠.
 *
 * 리뷰 하위 경로 허용/차단 세부 정책은 `mobile/reviews/mobileReview.constants.ts` 를 참고하세요.
 */

import { getMobileNavKeysForSession } from "@/lib/adminRolePolicy";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";

/** useIsMobileAdmin 및 미디어쿼리와 동기화 */
export const MOBILE_ADMIN_MAX_WIDTH_PX = 768;

/** 메뉴/정책 키 (표시·로깅용) */
export const MOBILE_ADMIN_MENU_KEYS = {
  DASHBOARD: "dashboard",
  INQUIRIES: "inquiries",
  MEMBERS: "members",
  REVIEWS: "reviews",
  NOTIFICATIONS: "notifications",
} as const;

export type MobileAdminMenuKey = (typeof MOBILE_ADMIN_MENU_KEYS)[keyof typeof MOBILE_ADMIN_MENU_KEYS];

/** 정책상 허용되는 메뉴 키 집합 */
export const MOBILE_ADMIN_ALLOWED_MENU_KEYS: readonly MobileAdminMenuKey[] = [
  MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
  MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
  MOBILE_ADMIN_MENU_KEYS.MEMBERS,
  MOBILE_ADMIN_MENU_KEYS.REVIEWS,
  MOBILE_ADMIN_MENU_KEYS.NOTIFICATIONS,
] as const;

/** 알림·회원·포인트 등 추가 허용 접두 */
export const MOBILE_ADMIN_ALLOWED_PATH_PREFIXES = [
  "/notifications",
  "/members",
  "/points",
  "/rewards",
] as const;

export type MobileAdminNavItem = {
  key: MobileAdminMenuKey;
  label: string;
  href: string;
  /** lucide icon name 대신 컴포넌트는 BottomNav에서 매핑 */
  icon: "home" | "inquiry" | "users" | "bell" | "star";
};

const MANAGER_PREFIX = "/theall_manager_only";

/** 하단 탭 — 홈·문의·회원·리뷰·알림 (admin 기본) */
export const MOBILE_ADMIN_PRIMARY_NAV: readonly MobileAdminNavItem[] = [
  {
    key: MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
    label: "홈",
    href: MANAGER_PREFIX,
    icon: "home",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
    label: "문의",
    href: `${MANAGER_PREFIX}/inquiries`,
    icon: "inquiry",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.MEMBERS,
    label: "회원",
    href: `${MANAGER_PREFIX}/members`,
    icon: "users",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.REVIEWS,
    label: "리뷰",
    href: `${MANAGER_PREFIX}/reviews`,
    icon: "star",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.NOTIFICATIONS,
    label: "알림",
    href: `${MANAGER_PREFIX}/notifications`,
    icon: "bell",
  },
] as const;

const NAV_BY_KEY = Object.fromEntries(MOBILE_ADMIN_PRIMARY_NAV.map((item) => [item.key, item])) as Record<
  MobileAdminMenuKey,
  MobileAdminNavItem
>;

/** 역할별 하단 탭 */
export function getMobileAdminNavForSession(session: AdminSessionPermissions): MobileAdminNavItem[] {
  return getMobileNavKeysForSession(session)
    .map((key) => NAV_BY_KEY[key])
    .filter((item): item is MobileAdminNavItem => item != null);
}
