/**
 * 모바일 관리자(MVP) 전용 상수.
 * 데스크톱 sidebarConfig와 분리 유지 — 추후 경로 prefix(/m-admin) 분리 시 이 모듈만 이전하기 쉽게 둠.
 */

import { getMobileNavKeysForSession } from "@/lib/adminRolePolicy";
import { hasAdminPermission, type AdminSessionPermissions } from "@/lib/adminPermissions";

/** useIsMobileAdmin 및 미디어쿼리와 동기화 (폰 세로 기준) */
export const MOBILE_ADMIN_MAX_WIDTH_PX = 768;

/** 태블릿·소형 랩탑까지 컴팩트 셸 사용 (이보다 넓고 standalone이 아니면 데스크톱) */
export const TABLET_ADMIN_MAX_WIDTH_PX = 1280;

/** PWA 설치·태블릿 메뉴 허브 (manifest start_url) */
export const ADMIN_PWA_HUB_HREF = "/theall_manager_only/pwa";
export const ADMIN_PWA_HUB_REL = "/pwa";

/** 메뉴/정책 키 (표시·로깅용) */
export const MOBILE_ADMIN_MENU_KEYS = {
  DASHBOARD: "dashboard",
  INQUIRIES: "inquiries",
  MEMBERS: "members",
  SMS: "sms",
  NOTIFICATIONS: "notifications",
} as const;

export type MobileAdminMenuKey = (typeof MOBILE_ADMIN_MENU_KEYS)[keyof typeof MOBILE_ADMIN_MENU_KEYS];

/** 정책상 허용되는 메뉴 키 집합 */
export const MOBILE_ADMIN_ALLOWED_MENU_KEYS: readonly MobileAdminMenuKey[] = [
  MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
  MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
  MOBILE_ADMIN_MENU_KEYS.MEMBERS,
  MOBILE_ADMIN_MENU_KEYS.SMS,
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
  icon: "home" | "inquiry" | "users" | "bell" | "sms";
};

const MANAGER_PREFIX = "/theall_manager_only";

/** 하단 탭 — 홈·문의·회원·SMS·알림 (admin 기본) */
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
    key: MOBILE_ADMIN_MENU_KEYS.SMS,
    label: "SMS",
    href: `${MANAGER_PREFIX}/sms`,
    icon: "sms",
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

export type TabletAdminHubMenuItem = {
  key: string;
  label: string;
  description: string;
  href: string;
};

/** 태블릿/PWA 허브에만 노출하는 허용 메뉴 (PC 전용 제외) */
export function getTabletAdminHubMenus(session: AdminSessionPermissions): TabletAdminHubMenuItem[] {
  const items: TabletAdminHubMenuItem[] = [];

  if (hasAdminPermission(session, "dashboard.view")) {
    items.push({
      key: "dashboard",
      label: "홈 · 대시보드",
      description: "오늘 할 일, 지표, kakao_sync",
      href: MANAGER_PREFIX,
    });
  }
  if (hasAdminPermission(session, "inquiries.manage")) {
    items.push({
      key: "inquiries",
      label: "문의·상담",
      description: "문의 목록 · 처리",
      href: `${MANAGER_PREFIX}/inquiries`,
    });
    items.push({
      key: "bookings",
      label: "예약 관리",
      description: "예약 목록 · 상세",
      href: `${MANAGER_PREFIX}/bookings`,
    });
    items.push({
      key: "sms",
      label: "SMS 센터",
      description: "문자 발송 · 스레드",
      href: `${MANAGER_PREFIX}/sms`,
    });
  }
  if (hasAdminPermission(session, "members.manage")) {
    items.push({
      key: "members",
      label: "회원",
      description: "회원 목록 · 상세",
      href: `${MANAGER_PREFIX}/members`,
    });
  }
  if (hasAdminPermission(session, "notifications.view")) {
    items.push({
      key: "notifications",
      label: "알림",
      description: "알림 · 푸시 · 로그인 기기",
      href: `${MANAGER_PREFIX}/notifications`,
    });
  }
  if (hasAdminPermission(session, "reviews.ops") || hasAdminPermission(session, "reviews.analytics")) {
    items.push({
      key: "reviews",
      label: "리뷰",
      description: "목록 · 검토 · 운영 알림",
      href: `${MANAGER_PREFIX}/reviews`,
    });
  }

  return items;
}
