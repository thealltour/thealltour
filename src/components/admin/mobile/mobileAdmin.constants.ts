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
  TREND_INBOX: "trend_inbox",
  MARKETING_REVIEW: "marketing_review",
  INQUIRIES: "inquiries",
  NOTIFICATIONS: "notifications",
} as const;

export type MobileAdminMenuKey = (typeof MOBILE_ADMIN_MENU_KEYS)[keyof typeof MOBILE_ADMIN_MENU_KEYS];

/** 정책상 허용되는 메뉴 키 집합 */
export const MOBILE_ADMIN_ALLOWED_MENU_KEYS: readonly MobileAdminMenuKey[] = [
  MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
  MOBILE_ADMIN_MENU_KEYS.TREND_INBOX,
  MOBILE_ADMIN_MENU_KEYS.MARKETING_REVIEW,
  MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
  MOBILE_ADMIN_MENU_KEYS.NOTIFICATIONS,
] as const;

/** 알림·회원·포인트·트렌드·아젠다 등 추가 허용 접두 */
export const MOBILE_ADMIN_ALLOWED_PATH_PREFIXES = [
  "/notifications",
  "/members",
  "/points",
  "/rewards",
  "/ai-marketing",
  "/ai-runtime",
  "/trend-inbox",
  "/marketing-review",
  "/marketing-operations",
  "/marketing-observability",
] as const;

export type MobileAdminNavItem = {
  key: MobileAdminMenuKey;
  label: string;
  href: string;
  /** lucide icon name 대신 컴포넌트는 BottomNav에서 매핑 */
  icon: "home" | "inquiry" | "trend" | "agenda" | "bell";
};

const MANAGER_PREFIX = "/theall_manager_only";

/** 하단 탭 — 홈·트렌드·아젠다·문의·알림 */
export const MOBILE_ADMIN_PRIMARY_NAV: readonly MobileAdminNavItem[] = [
  {
    key: MOBILE_ADMIN_MENU_KEYS.DASHBOARD,
    label: "홈",
    href: MANAGER_PREFIX,
    icon: "home",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.TREND_INBOX,
    label: "트렌드",
    href: `${MANAGER_PREFIX}/trend-inbox`,
    icon: "trend",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.MARKETING_REVIEW,
    label: "아젠다",
    href: `${MANAGER_PREFIX}/marketing-review`,
    icon: "agenda",
  },
  {
    key: MOBILE_ADMIN_MENU_KEYS.INQUIRIES,
    label: "문의",
    href: `${MANAGER_PREFIX}/inquiries`,
    icon: "inquiry",
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
    items.push({
      key: "kakao-sync",
      label: "카카오싱크 성과",
      description: "랜딩 조회 · CTA · 가입 퍼널",
      href: `${MANAGER_PREFIX}?tab=kakao_sync`,
    });
  }
  if (hasAdminPermission(session, "settings.manage")) {
    items.push({
      key: "ai-marketing",
      label: "AI Marketing · 오늘",
      description: "오늘 할 일 · 팀 허브",
      href: `${MANAGER_PREFIX}/ai-marketing`,
    });
    items.push({
      key: "trend-inbox",
      label: "트렌드 인입",
      description: "Meta TrendSignal 검증 · 스테이징 인입",
      href: `${MANAGER_PREFIX}/trend-inbox`,
    });
    items.push({
      key: "marketing-review",
      label: "제작·검토",
      description: "아젠다 승인 · 후보 검토",
      href: `${MANAGER_PREFIX}/marketing-review`,
    });
    items.push({
      key: "marketing-operations",
      label: "오늘 운영",
      description: "일일 파이프라인 상태",
      href: `${MANAGER_PREFIX}/marketing-operations`,
    });
    items.push({
      key: "marketing-observability",
      label: "조직 관제",
      description: "조직도 · Analytics · Runs",
      href: `${MANAGER_PREFIX}/marketing-observability`,
    });
    items.push({
      key: "ai-runtime",
      label: "모델·쿼터",
      description: "Provider · Adapter · Credential 상태",
      href: `${MANAGER_PREFIX}/ai-runtime`,
    });
  }
  if (hasAdminPermission(session, "inquiries.manage")) {
    items.push({
      key: "inquiries",
      label: "문의·상담",
      description: "문의 목록 · 대시보드 · 처리",
      href: `${MANAGER_PREFIX}/inquiries`,
    });
    items.push({
      key: "inquiry-dashboard",
      label: "문의 대시보드",
      description: "현장 상담용 요약 지표",
      href: `${MANAGER_PREFIX}/inquiries/dashboard`,
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
  items.push({
    key: "team-chat",
    label: "팀 채팅",
    description: "관리자 간 실시간 메시지",
    href: `${MANAGER_PREFIX}/pwa?openChat=1`,
  });
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
