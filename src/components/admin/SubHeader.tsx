"use client";

/**
 * 데스크톱 관리자 상단 서브헤더. 모바일 관리자 레이아웃에서는 렌더되지 않습니다.
 * 모바일 리뷰 서브내비는 하단 탭·앱 내 링크로만 연결합니다(SubHeader 축소판 없음).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Moon, Search, Sun } from "lucide-react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import {
  ADMIN_PRODUCTS_VIEW,
  ADMIN_PRODUCTS_QUERY_KEYS,
  PRODUCT_LABEL_TO_VIEW,
  PRODUCT_VIEW_TO_LABEL,
} from "@/components/admin/products/adminProducts.constants";
import { confirmAdminProductUnsavedIfNeeded } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";

export type SubHeaderTab = { label: string; href: string };

/** 후기 관리 상단 가로 탭 (본문 상단 탭 UI용) */
export const REVIEWS_TABS: SubHeaderTab[] = [
  { label: "리뷰 목록 (검색)", href: "/admin/reviews" },
  { label: "리뷰 검토", href: "/admin/reviews/moderation" },
  { label: "리뷰 운영 알림", href: "/admin/reviews/notifications" },
  { label: "후기 신고", href: "/theall_manager_only/review-reports" },
  { label: "후기 리마인더", href: "/theall_manager_only/review-reminders" },
  { label: "리뷰 요약", href: "/theall_manager_only/review-summaries" },
  { label: "리뷰 분석", href: "/admin/reviews/analytics" },
  { label: "리뷰 이상 감지", href: "/admin/reviews/anomalies" },
  { label: "리뷰 요약 (관리자)", href: "/admin/reviews/summaries" },
  { label: "리뷰 작성자 분석", href: "/admin/reviews/authors" },
  { label: "리뷰 A/B 실험", href: "/admin/reviews/experiments" },
  { label: "리뷰 전환 기여도", href: "/admin/reviews/conversions" },
  { label: "리뷰 인사이트", href: "/admin/reviews/insights" },
];

function isReviewTabActive(href: string, pathname: string): boolean {
  if (href === "/admin/reviews") return pathname === "/admin/reviews";
  if (href === "/theall_manager_only/reviews") return pathname === "/theall_manager_only/reviews";
  return pathname === href || pathname.startsWith(href + "/");
}

export const menuMap = {
  dashboard: ["운영 현황", "통계"],
  product: ["상품 목록", "상품 등록", "상품 등록(모두)", "카테고리/테마 관리", "메인 지역카드", "메인 테마카드", "메인 추천상품 관리"],
  landings: ["랜딩 목록", "taxonomy 기반 생성", "성과 분석"],
  inquiry: ["전체 문의", "미처리 문의", "운영 대시보드"],
  inquiry_dashboard: ["전체 문의", "미처리 문의", "운영 대시보드"],
  member: ["회원 목록"],
  rewards: ["신청", "승인", "발송", "완료", "반려"],
  points: ["포인트 지급"],
  settings: [],
  reviews: [] as string[],
  guides: ["가이드 목록", "가이드등록(노션)", "가이드등록(일반)"],
  banners: ["배너 목록"],
  notices: ["회원가입 법률 문서", "공지 등록", "등록된 공지 목록"],
  notifications: ["알림 목록"],
} as const;

export type MainMenuKey = keyof typeof menuMap;

const MAIN_MENU_TITLE: Record<MainMenuKey, string> = {
  dashboard: "대시보드",
  product: "상품 관리",
  landings: "검색/유입 랜딩 관리",
  inquiry: "문의 관리",
  inquiry_dashboard: "문의 운영",
  member: "회원 관리",
  rewards: "리워드 교환 관리",
  points: "포인트 지급 관리",
  settings: "환경설정",
  reviews: "후기 관리",
  guides: "여행가이드",
  banners: "메인배너",
  notices: "공지사항",
  notifications: "알림",
};

type SubHeaderProps = {
  activeMenu: MainMenuKey | null;
  onTabChange?: (label: string) => void;
};

export default function SubHeader({ activeMenu, onTabChange }: SubHeaderProps) {
  const items = useMemo(
    () => (activeMenu && activeMenu !== "reviews" ? menuMap[activeMenu] ?? [] : []) as string[],
    [activeMenu],
  );
  const hasReviewTabs = activeMenu === "reviews";
  const hasSubTabs = hasReviewTabs || items.length > 0;
  const [activeLabel, setActiveLabel] = useState<string | null>(items[0] ?? null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    let initial: string | null = items[0] ?? null;

    if (activeMenu === "product") {
      const view = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
      if (pathname.includes("/products/new-modetour")) {
        initial = "상품 등록(모두)";
      } else if (view === ADMIN_PRODUCTS_VIEW.TAXONOMY) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.TAXONOMY];
      } else if (view === ADMIN_PRODUCTS_VIEW.FEATURED) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.FEATURED];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS];
      } else if (view === ADMIN_PRODUCTS_VIEW.CREATE) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.CREATE];
      } else if (view === ADMIN_PRODUCTS_VIEW.LIST) {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      } else {
        initial = PRODUCT_VIEW_TO_LABEL[ADMIN_PRODUCTS_VIEW.LIST];
      }
    }
    if (activeMenu === "notices") {
      const view = searchParams.get("view");
      if (view === "legal") {
        initial = "회원가입 법률 문서";
      } else if (view === "create") {
        initial = "공지 등록";
      } else if (view === "list") {
        initial = "등록된 공지 목록";
      } else {
        initial = "등록된 공지 목록";
      }
    }
    if (activeMenu === "guides") {
      const view = searchParams.get("view");
      if (view === "notion") {
        initial = "가이드등록(노션)";
      } else if (view === "general") {
        initial = "가이드등록(일반)";
      } else {
        initial = "가이드 목록";
      }
    }
    if (activeMenu === "rewards") {
      const status = searchParams.get("status");
      const tabByStatus: Record<string, string> = {
        REQUESTED: "신청",
        APPROVED: "승인",
        SHIPPED: "발송",
        COMPLETED: "완료",
        REJECTED: "반려",
      };
      initial = (status && tabByStatus[status]) || "신청";
    }
    if (activeMenu === "inquiry" || activeMenu === "inquiry_dashboard") {
      if (pathname.includes("/inquiries/dashboard")) {
        initial = "운영 대시보드";
      } else if (searchParams.get("status") === "pending") {
        initial = "미처리 문의";
      } else {
        initial = "전체 문의";
      }
    }
    if (activeMenu === "landings") {
      if (pathname.includes("/landings/analytics")) {
        initial = "성과 분석";
      } else if (pathname.includes("/landings/generate-from-taxonomy")) {
        initial = "taxonomy 기반 생성";
      } else {
        initial = "랜딩 목록";
      }
    }

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tagName = target.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || target.isContentEditable) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
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

  const REWARDS_LABEL_TO_STATUS: Record<string, string> = {
    신청: "REQUESTED",
    승인: "APPROVED",
    발송: "SHIPPED",
    완료: "COMPLETED",
    반려: "REJECTED",
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
      const view = mapProductLabelToView(label);
      const params = new URLSearchParams(searchParams.toString());
      if (view) {
        params.set(ADMIN_PRODUCTS_QUERY_KEYS.VIEW, view);
      } else {
        params.delete(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
      }
      const query = params.toString();
      const basePath = pathname.includes("/products/new-modetour")
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
    if (activeMenu === "rewards") {
      const status = searchParams.get("status");
      const params = new URLSearchParams(searchParams.toString());
      if (status) {
        params.set("status", status);
      } else {
        params.delete("status");
      }
      params.delete("id");
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.push(target);
      return;
    }
    if (activeMenu === "inquiry" || activeMenu === "inquiry_dashboard") {
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
    if (activeMenu === "landings") {
      if (label === "taxonomy 기반 생성") {
        router.push("/theall_manager_only/landings/generate-from-taxonomy");
        return;
      }
      if (label === "성과 분석") {
        router.push("/theall_manager_only/landings/analytics");
        return;
      }
      router.push("/theall_manager_only/landings");
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

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-subtle)]" />
            <input
              type="text"
              value={globalSearch}
              onChange={(event) => {
                const value = event.target.value;
                setGlobalSearch(value);
                // TODO: wire up admin global search API
              }}
              ref={searchInputRef}
              placeholder="Admin search..."
              className="w-[240px] rounded-md border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
          </div>
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
          <button
            type="button"
            onClick={() => {
              if (!confirmAdminProductUnsavedIfNeeded()) return;
              router.push("/theall_manager_only/notifications");
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] transition-colors duration-150 hover:bg-[var(--surface-muted)]"
            aria-label="알림 보기"
          >
            <Bell className="h-4 w-4" />
          </button>
          <AdminLogoutButton />
        </div>
      </div>

      {/* 후기 관리: 본문 상단 가로 탭 바 (가로 스크롤) */}
      {hasReviewTabs && (
        <div className="border-t border-[var(--divider)] bg-[var(--card)] px-6 py-3 md:px-10">
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <div className="inline-flex min-w-max items-center gap-1">
              {REVIEWS_TABS.map((tab) => {
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

