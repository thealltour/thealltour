/**
 * 모바일 관리자(MVP) 전용 상수.
 * 데스크톱 sidebarConfig와 분리 유지 — 추후 경로 prefix(/m-admin) 분리 시 이 모듈만 이전하기 쉽게 둠.
 *
 * 리뷰 하위 경로 허용/차단 세부 정책은 `mobile/reviews/mobileReview.constants.ts` 를 참고하세요.
 */

/** useIsMobileAdmin 및 미디어쿼리와 동기화 */
export const MOBILE_ADMIN_MAX_WIDTH_PX = 768;

/** 메뉴/정책 키 (표시·로깅용) */
export const MOBILE_ADMIN_MENU_KEYS = {
  DASHBOARD: "dashboard",
  LANDINGS: "landings",
  INQUIRIES: "inquiries",
  NOTIFICATIONS: "notifications",
  REVIEWS: "reviews",
} as const;

export type MobileAdminMenuKey = (typeof MOBILE_ADMIN_MENU_KEYS)[keyof typeof MOBILE_ADMIN_MENU_KEYS];

/** 정책상 허용되는 메뉴 키 집합 */
export const MOBILE_ADMIN_ALLOWED_MENU_KEYS: readonly MobileAdminMenuKey[] = [
  MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
  MOBILE_ADMIN_MENU_KEYS.LANDINGS,
  MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
  MOBILE_ADMIN_MENU_KEYS.NOTIFICATIONS,
  MOBILE_ADMIN_MENU_KEYS.REVIEWS,
] as const;

/** 알림 하위 상세 등 */
export const MOBILE_ADMIN_ALLOWED_PATH_PREFIXES = ["/landings", "/notifications"] as const;

export type MobileAdminNavItem = {
  key: MobileAdminMenuKey;
  label: string;
  href: string;
  /** lucide icon name 대신 컴포넌트는 BottomNav에서 매핑 */
  icon: "home" | "landing" | "inquiry" | "bell" | "star";
};

/** 하단 탭 — 실제 href. 리뷰는 목록 진입(`/admin/reviews`); 검토는 앱 내 링크로 이동 가능 */
export const MOBILE_ADMIN_PRIMARY_NAV: readonly MobileAdminNavItem[] = [
  {
    key: MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
    label: "홈",
    href: "/theall_manager_only",
    icon: "home",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.LANDINGS,
    label: "랜딩",
    href: "/theall_manager_only/landings",
    icon: "landing",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
    label: "문의",
    href: "/theall_manager_only/inquiries",
    icon: "inquiry",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.NOTIFICATIONS,
    label: "알림",
    href: "/theall_manager_only/notifications",
    icon: "bell",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.REVIEWS,
    label: "리뷰",
    href: "/admin/reviews",
    icon: "star",
  },
] as const;
