/**
 * Shared member-account nav entries used by desktop + mobile header menus.
 * Personal resources only — not primary public navigation.
 */

import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";

export const PLANNER_SAVED_LIST_PATH = "/planner/my";

export type MemberAccountNavItem = {
  label: string;
  href: string;
  /** Guest menu: open auth modal instead of navigating. */
  requiresAuth?: boolean;
};

const BASE_MEMBER_ACCOUNT_NAV: MemberAccountNavItem[] = [
  { label: "대시보드", href: "/mypage/dashboard", requiresAuth: true },
  { label: "예약내역", href: "/mypage/bookings", requiresAuth: true },
  { label: "견적문의 내역", href: "/quote", requiresAuth: true },
  { label: "포인트", href: "/mypage/points", requiresAuth: true },
  { label: "내 정보", href: "/mypage/profile", requiresAuth: true },
];

/** Logged-in header dropdown items (feature-flag aware). */
export function getMemberAccountNavItems(): MemberAccountNavItem[] {
  const items = [...BASE_MEMBER_ACCOUNT_NAV];
  if (ENABLE_FREE_TRAVEL_PLANNER) {
    items.splice(2, 0, {
      label: "내 여행 플랜",
      href: PLANNER_SAVED_LIST_PATH,
      requiresAuth: true,
    });
  }
  return items;
}

/** Guest quick links — subset + planner when enabled. */
export function getGuestAccountQuickLinks(): MemberAccountNavItem[] {
  const links: MemberAccountNavItem[] = [
    { label: "대시보드", href: "/mypage/dashboard", requiresAuth: true },
    { label: "견적문의 내역", href: "/quote", requiresAuth: true },
    { label: "포인트", href: "/mypage/points", requiresAuth: true },
  ];
  if (ENABLE_FREE_TRAVEL_PLANNER) {
    links.splice(1, 0, {
      label: "내 여행 플랜",
      href: PLANNER_SAVED_LIST_PATH,
      requiresAuth: true,
    });
  }
  links.push({ label: "마이페이지", href: "/mypage/dashboard", requiresAuth: true });
  return links;
}
