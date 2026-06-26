"use client";

/**
 * 데스크톱 관리자 상단 서브헤더. 모바일 관리자 레이아웃에서는 렌더되지 않습니다.
 * 모바일 리뷰 서브내비는 하단 탭·앱 내 링크로만 연결합니다(SubHeader 축소판 없음).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, ChevronDown, Moon, Sun } from "lucide-react";
import AdminGlobalSearch from "@/components/admin/AdminGlobalSearch";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { useAdminSession, useAdminPermission } from "@/components/admin/AdminRoleContext";
import { hasAdminPermission } from "@/lib/adminPermissions";
import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  PRODUCT_LABEL_TO_VIEW,
  PRODUCT_VIEW_TO_LABEL,
} from "@/components/admin/products/adminProducts.constants";
import { confirmAdminProductUnsavedIfNeeded } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";
import { useAdminNotificationsRealtime } from "@/hooks/useAdminNotificationsRealtime";
import {
  ADMIN_MANAGER_PREFIX,
  ADMIN_MENU_MAP,
  MAIN_MENU_TITLE,
  resolveActiveSubTab,
  type MainMenuKey,
} from "@/lib/adminNav/adminNav.config";

export type { MainMenuKey };
export const menuMap = ADMIN_MENU_MAP;

export type SubHeaderTab = { label: string; href: string };

const MANAGER_PREFIX = ADMIN_MANAGER_PREFIX;
export const REVIEWS_OPS_TABS: SubHeaderTab[] = [
  { label: "리뷰 목록", href: `${MANAGER_PREFIX}/reviews` },
  { label: "리뷰 검토", href: `${MANAGER_PREFIX}/reviews/moderation` },
  { label: "후기 신고", href: `${MANAGER_PREFIX}/review-reports` },
  { label: "후기 리마인더", href: `${MANAGER_PREFIX}/review-reminders` },
];

/** 후기 분석·고급 (드롭다운) */
export const REVIEWS_ANALYTICS_TABS: SubHeaderTab[] = [
  { label: "리뷰 요약", href: `${MANAGER_PREFIX}/review-summaries` },
  { label: "리뷰 분석", href: `${MANAGER_PREFIX}/reviews/analytics` },
  { label: "리뷰 이상 감지", href: `${MANAGER_PREFIX}/reviews/anomalies` },
  { label: "리뷰 운영 알림", href: `${MANAGER_PREFIX}/reviews/notifications` },
  { label: "리뷰 작성자 분석", href: `${MANAGER_PREFIX}/reviews/authors` },
  { label: "리뷰 A/B 실험", href: `${MANAGER_PREFIX}/reviews/experiments` },
  { label: "리뷰 전환 기여도", href: `${MANAGER_PREFIX}/reviews/conversions` },
  { label: "리뷰 인사이트", href: `${MANAGER_PREFIX}/reviews/insights` },
];

function isReviewTabActive(href: string, pathname: string): boolean {
  const normalized = pathname.replace(/^\/admin/, MANAGER_PREFIX);
  const target = href.replace(/^\/admin/, MANAGER_PREFIX);
  if (target === `${MANAGER_PREFIX}/reviews`) {
    return normalized === target;
  }
  return normalized === target || normalized.startsWith(`${target}/`);
}

type SubHeaderProps = {
  activeMenu: MainMenuKey | null;
  onTabChange?: (label: string) => void;
};

export default function SubHeader({ activeMenu, onTabChange }: SubHeaderProps) {
  const session = useAdminSession();
  const canManageProducts = useAdminPermission("products.manage");
  const canManageMembers = useAdminPermission("members.manage");
  const items = useMemo(() => {
    if (!activeMenu || activeMenu === "reviews") return [] as string[];
    const raw = [...(menuMap[activeMenu] ?? [])] as string[];
    if (activeMenu === "member_rewards" && !canManageMembers) {
      return raw.filter((label) => label !== "회원 목록");
    }
    return raw;
  }, [activeMenu, canManageMembers]);
  const hasReviewTabs = activeMenu === "reviews";
  const hasSubTabs = hasReviewTabs || items.length > 0;
  const [activeLabel, setActiveLabel] = useState<string | null>(items[0] ?? null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { unreadCount: notificationUnreadCount } = useAdminNotificationsRealtime();

  useEffect(() => {
    const initial = resolveActiveSubTab(activeMenu, pathname, {
      view: searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW),
      status: searchParams.get("status"),
      tab: searchParams.get("tab"),
    });
    setActiveLabel(initial);
    if (initial && onTabChange) {
      onTabChange(initial);
    }
  }, [items, onTabChange, activeMenu, searchParams, pathname]);

  useEffect(() => {
    function handleScroll() {
      if (typeof window === "undefined") return;
      setIsScrolled(window.scrollY > 0);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("theall-admin-theme");
    /* 기본값: 라이트 모드. 저장된 값이 "dark"일 때만 다크 적용 */
    const shouldEnable = stored === "dark";
    const root = document.documentElement;
    if (shouldEnable) {
      root.classList.add("dark");
      setIsDarkMode(true);
    } else {
      root.classList.remove("dark");
      setIsDarkMode(false);
    }
  }, []);

  function toggleTheme() {
    if (typeof window === "undefined") return;
    setIsDarkMode((prev) => {
      const next = !prev;
      const root = document.documentElement;
      if (next) {
        root.classList.add("dark");
        window.localStorage.setItem("theall-admin-theme", "dark");
      } else {
        root.classList.remove("dark");
        window.localStorage.setItem("theall-admin-theme", "light");
      }
      return next;
    });
  }

  function mapProductLabelToView(label: string): string | null {
    const view = PRODUCT_LABEL_TO_VIEW[label];
    return view ?? null;
  }

  function mapNoticesLabelToView(label: string): string | null {
    if (label === "회원가입 법률 문서") return "legal";
    if (label === "공지 등록") return "create";
    if (label === "등록된 공지 목록") return "list";
    return null;
  }

  function mapGuidesLabelToView(label: string): string | null {
    if (label === "가이드등록(노션)") return "notion";
    if (label === "가이드등록(일반)") return "general";
    if (label === "가이드 목록") return "list";
    return null;
  }

  const HOME_LABEL_TO_PATH: Record<string, string> = {
    "메인 골프투어 상품": `/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.HOME_GOLF_TOUR_CARDS}`,
    "메인 지역카드": `/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS}`,
    "메인 테마카드": `/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS}`,
    "메인 추천상품": `/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.FEATURED}`,
    "메인배너": "/theall_manager_only/banners",
  };

  function handleTabClick(label: string) {
    if (!confirmAdminProductUnsavedIfNeeded()) return;

    setActiveLabel(label);
    onTabChange?.(label);

    if (activeMenu === "product") {
      if (label === "상품 등록(모두)") {
        router.push("/theall_manager_only/products/new-modetour");
        return;
      }
      if (label === "상품 등록(하나)") {
        router.push("/theall_manager_only/products/new-hanatour");
        return;
      }
      const view = mapProductLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set(ADMIN_PRODUCTS_QUERY_KEYS.VIEW, view);
      } else {
        params.delete(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
      }
      const query = params.toString();
      const basePath = pathname.includes("/products/new-modetour") || pathname.includes("/products/new-hanatour")
        ? "/theall_manager_only/products"
        : pathname;
      const target = query ? `${basePath}?${query}` : basePath;
      router.push(target);
      return;
    }
    if (activeMenu === "notices") {
      const view = mapNoticesLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set("view", view);
      } else {
        params.delete("view");
      }
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.push(target);
      return;
    }
    if (activeMenu === "guides") {
      const view = mapGuidesLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set("view", view);
      } else {
        params.delete("view");
      }
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.push(target);
      return;
    }
    if (activeMenu === "member_rewards") {
      if (label === "회원 목록") {
        router.push(
          hasAdminPermission(session, "members.manage")
            ? "/theall_manager_only/members"
            : "/theall_manager_only/points",
        );
        return;
      }
      if (label === "포인트 지급") {
        router.push("/theall_manager_only/points");
        return;
      }
      if (label === "적립 요청") {
        router.push("/theall_manager_only/points/requests");
        return;
      }
      if (label === "교환 신청") {
        router.push("/theall_manager_only/rewards");
        return;
      }
    }
    if (activeMenu === "home") {
      const target = HOME_LABEL_TO_PATH[label];
      if (target) router.push(target);
      return;
    }
    if (activeMenu === "inquiry") {
      if (label === "운영 대시보드") {
        router.push("/theall_manager_only/inquiries/dashboard");
        return;
      }
      if (label === "미처리 문의") {
        router.push("/theall_manager_only/inquiries?status=pending");
        return;
      }
      router.push("/theall_manager_only/inquiries");
      return;
    }
    if (activeMenu === "bookings") {
      if (label === "예약 생성") {
        router.push("/theall_manager_only/bookings/new");
        return;
      }
      router.push("/theall_manager_only/bookings");
      return;
    }
    if (activeMenu === "landings") {
      if (label === "taxonomy 기반 생성") {
        router.push("/theall_manager_only/landings/generate-from-taxonomy");
        return;
      }
      if (label === "성과·UTM") {
        router.push("/theall_manager_only/landings/analytics");
        return;
      }
      if (label === "골프 리드 (UTM)") {
        router.push("/theall_manager_only/golf-leads");
        return;
      }
      router.push("/theall_manager_only/landings");
      return;
    }
    if (activeMenu === "dashboard") {
      const params = new URLSearchParams(searchParams.toString());
      if (label === "지표·리드") {
        params.set("tab", "metrics");
      } else {
        params.delete("tab");
      }
      const query = params.toString();
      router.push(query ? `/theall_manager_only?${query}` : "/theall_manager_only");
      return;
    }
    if (activeMenu === "notifications") {
      if (label === "OS 푸시 알림") {
        router.push("/theall_manager_only/notifications/push");
        return;
      }
      if (label === "로그인된 기기") {
        router.push("/theall_manager_only/notifications/devices");
        return;
      }
      router.push("/theall_manager_only/notifications");
    }
  }

  if (!activeMenu) {
    return null;
  }

  const title = MAIN_MENU_TITLE[activeMenu];
  const showInlineTabs = !hasReviewTabs && items.length > 0;

  return (
    <div
      className={`sticky top-0 z-30 w-full border-b border-[var(--divider)] bg-[var(--card)] transition-shadow ${
        isScrolled ? "shadow-sm" : ""
      }`}
    >
      <div className="flex h-14 items-center justify-between px-6 md:px-10">
        {/* 왼쪽: 제목 + 탭 (리뷰가 아닐 때만 인라인 탭) */}
        <div className="flex items-center gap-10">
          <h1 className="text-base font-semibold text-[var(--text)]">{title}</h1>

          {showInlineTabs ? (
          <div className="flex items-center gap-6 text-sm">
            {items.map((label) => {
              const isActive = activeLabel === label;
              return (
                <button
                  key={label}
                  onClick={() => handleTabClick(label)}
                  className={`relative pb-1 transition-colors duration-200 ${
                    isActive
                      ? "font-semibold text-[var(--brand)] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:bg-[var(--brand)]"
                      : "text-[var(--text-muted)] hover:text-[var(--brand)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          ) : null}
        </div>

        {/* 오른쪽: 다크 토글 + 검색 + 글로벌 액션 + 알림/로그아웃 */}
        <div className="flex items-center gap-3">
          <AdminGlobalSearch className="hidden lg:block" />
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--card)] sm:flex"
            aria-label={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
          >
            {isDarkMode ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            <span>{isDarkMode ? "Dark" : "Light"}</span>
          </button>

          {canManageProducts ? (
            <button
              type="button"
              onClick={() => {
                if (!confirmAdminProductUnsavedIfNeeded()) return;
                router.push(`/theall_manager_only/products?${ADMIN_PRODUCTS_QUERY_KEYS.VIEW}=${ADMIN_PRODUCTS_VIEW.CREATE}`);
              }}
              className="btn-admin-primary"
            >
              + 상품 추가
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (!confirmAdminProductUnsavedIfNeeded()) return;
              router.push("/theall_manager_only/notifications");
            }}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] transition-colors duration-150 hover:bg-[var(--surface-muted)]"
            aria-label={
              notificationUnreadCount > 0
                ? `알림 ${notificationUnreadCount}건 미읽음`
                : "알림 보기"
            }
          >
            <Bell className="h-4 w-4" />
            {notificationUnreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[9px] font-bold text-white">
                {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
              </span>
            ) : null}
          </button>
          <AdminLogoutButton />
        </div>
      </div>

      {/* 후기 관리: 본문 상단 가로 탭 바 (가로 스크롤) */}
      {hasReviewTabs && (
        <div className="border-t border-[var(--divider)] bg-[var(--card)] px-6 py-3 md:px-10">
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <div className="inline-flex min-w-max items-center gap-1">
              {REVIEWS_OPS_TABS.map((tab) => {
                const active = isReviewTabActive(tab.href, pathname);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                      active
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAnalyticsOpen((o) => !o)}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                    REVIEWS_ANALYTICS_TABS.some((t) => isReviewTabActive(t.href, pathname))
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  분석·고급
                  <ChevronDown className={`h-4 w-4 ${analyticsOpen ? "rotate-180" : ""}`} />
                </button>
                {analyticsOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                    {REVIEWS_ANALYTICS_TABS.map((tab) => (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        onClick={() => setAnalyticsOpen(false)}
                        className={`block px-4 py-2 text-sm hover:bg-[var(--surface-muted)] ${
                          isReviewTabActive(tab.href, pathname)
                            ? "font-semibold text-[var(--primary)]"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

