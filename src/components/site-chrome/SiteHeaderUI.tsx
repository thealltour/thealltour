"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderQuickConsultCtas from "@/components/header/HeaderQuickConsultCtas";
import UserMenuDropdown from "@/components/header/UserMenuDropdown";
import GuestAuthHoverMenu from "@/components/header/GuestAuthHoverMenu";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import { PageContainer } from "@/components/layout/PageContainer";
import { GuestSignupPromoBanner } from "@/components/site-chrome/GuestSignupPromoBanner";
import { HEADER_PRIMARY_NAV_ITEMS, HEADER_PRIMARY_NAV_DEFAULT_HREF, HEADER_UTILITY_GUIDES_ENABLED } from "@/components/header/headerNav.constants";
import { withPlannerNavigation } from "@/lib/planner/entryNavigation";
import type { HeaderPrimaryNavKey } from "@/components/header/headerNav.constants";
import type { HeaderNavigationData, HeaderPrimaryNavItem, HeaderUtilityTab } from "@/components/header/headerNav.types";
import { cn } from "@/lib/cn";

export type SiteHeaderUIProps = {
  /** 서버에서 조회한 헤더 네비 데이터. null이면 직접 링크 fallback */
  headerNavigationData?: HeaderNavigationData | null;
  activeTab?: HeaderUtilityTab;
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
  session: { name: string } | null;
  memberPoints: number | null;
  /** When true, hide mobile header search row (planner write screen). */
  hideMobileSearchRow?: boolean;
};

/** 데이터 없을 때 사용할 최소 1차 메뉴 (직접 링크) */
function getFallbackPrimaryNav(): HeaderPrimaryNavItem[] {
  return HEADER_PRIMARY_NAV_ITEMS.filter((item) =>
    item.key === "recommended" ||
    item.key === "region" ||
    item.key === "theme" ||
    item.key === "inquiry" ||
    item.key === "guides" ||
    item.key === "support",
  ).map(({ key, label }) => ({
    key,
    label,
    href: HEADER_PRIMARY_NAV_DEFAULT_HREF[key as HeaderPrimaryNavKey],
  }));
}

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap text-sm tracking-tight transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(
      base,
      "font-medium text-[var(--foreground)]",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
    );
  }
  return cn(
    base,
    "font-normal text-[var(--text-muted)]",
    "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
  );
}

export default function SiteHeaderUI({
  headerNavigationData,
  activeTab,
  searchQuery,
  golfPresetActive = false,
  quickConsultHref,
  kakaoConsultHref,
  session,
  memberPoints,
  hideMobileSearchRow = false,
}: SiteHeaderUIProps) {
  const pathname = usePathname();
  /** 모바일/태블릿 헤더 검색행: 플래너 작성 화면에서만 숨김. 홈에서는 헤더 검색을 쓰고 배너 검색은 숨김. */
  const showHeaderSearchRow = !hideMobileSearchRow;
  void golfPresetActive;
  void pathname;
  const primaryNavRaw = withPlannerNavigation(headerNavigationData?.primaryNav?.length
    ? headerNavigationData.primaryNav
    : getFallbackPrimaryNav());
  const primaryNav = HEADER_UTILITY_GUIDES_ENABLED
    ? primaryNavRaw
    : primaryNavRaw.filter((item) => item.key !== "guides");

  return (
    <div data-site-header className="sticky top-[env(safe-area-inset-top)] z-50 lg:z-40">
      <GuestSignupPromoBanner isLoggedIn={Boolean(session)} />
      <header className="border-b border-[var(--divider)] bg-[var(--surface)] transition-all duration-200 safe-top">
      {/* 데스크톱: 유틸 → 로고·상시검색·계정·상담 → 독립 메인 메뉴 바 */}
      <div className="hidden lg:block">
        <PageContainer size="wide" className="flex flex-col py-0">
          {/* 상단 유틸바: 회사소개 ~ 고객센터 */}
          <div className="flex h-10 items-center justify-end gap-x-5 border-b border-[var(--divider)] xl:gap-x-6">
            <nav className="flex items-center gap-x-5 tracking-tight xl:gap-x-6" aria-label="유틸리티 메뉴">
              <Link className={getNavLinkClass(activeTab === "about")} href="/about">
                회사소개
              </Link>
              <Link className={getNavLinkClass(activeTab === "quote")} href="/quote">
                견적문의
              </Link>
              <Link className={getNavLinkClass(activeTab === "reviews")} href="/reviews">
                여행후기
              </Link>
              {HEADER_UTILITY_GUIDES_ENABLED ? (
                <Link className={getNavLinkClass(activeTab === "guides")} href="/guides">
                  여행가이드
                </Link>
              ) : null}
              <Link className={getNavLinkClass(activeTab === "blog")} href="/blog">
                블로그
              </Link>
              <Link className={getNavLinkClass(activeTab === "support")} href="/support">
                고객센터
              </Link>
            </nav>
          </div>

          {/* 로고 · 상시 검색 · 계정 · 상담 */}
          <div className="flex min-h-[var(--header-main-height-desktop)] items-center gap-x-5 py-2.5 xl:gap-x-7">
            <Link
              href="/"
              className="header-logo-link shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              aria-label="더올투어 홈"
            >
              <HeaderBrandLogo variant="desktop" priority />
            </Link>

            <div className="min-w-0 flex-1">
              <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {session ? (
                <UserMenuDropdown
                  userName={session.name}
                  points={memberPoints}
                />
              ) : (
                <GuestAuthHoverMenu />
              )}
            </div>

            <HeaderQuickConsultCtas
              quickConsultHref={quickConsultHref}
              kakaoConsultHref={kakaoConsultHref}
            />
          </div>
        </PageContainer>

        {/* 독립 메인 메뉴 바: 배경은 화면 폭 전체, 내용은 wide 기준선 */}
        <div className="border-t border-[var(--primary)]/20 bg-[var(--primary)]">
          <PageContainer size="wide" className="flex min-h-[var(--header-nav-bar-height-desktop)] items-center py-0">
            <DesktopMegaMenu primaryNav={primaryNav} />
          </PageContainer>
        </div>
      </div>

      <MobileHeaderMenu
        primaryNav={primaryNav}
        activeTab={activeTab}
        searchQuery={searchQuery}
        session={session}
        showHeaderSearchRow={showHeaderSearchRow}
      />
    </header>
    </div>
  );
}
