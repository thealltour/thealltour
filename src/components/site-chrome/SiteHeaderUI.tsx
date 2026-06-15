"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderQuickConsultCtas from "@/components/header/HeaderQuickConsultCtas";
import UserMenuDropdown from "@/components/header/UserMenuDropdown";
import GuestAuthHoverMenu from "@/components/header/GuestAuthHoverMenu";
import { HeaderExpandSearch } from "@/components/header/HeaderExpandSearch";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import { PageContainer } from "@/components/layout/PageContainer";
import { HEADER_DESKTOP_PRIMARY_NAV_KEYS, HEADER_PRIMARY_NAV_ITEMS, HEADER_PRIMARY_NAV_DEFAULT_HREF } from "@/components/header/headerNav.constants";
import type { HeaderPrimaryNavKey } from "@/components/header/headerNav.constants";
import type { HeaderNavigationData, HeaderPrimaryNavItem } from "@/components/header/headerNav.types";
import { cn } from "@/lib/cn";

export type SiteHeaderUIProps = {
  /** 서버에서 조회한 헤더 네비 데이터. null이면 직접 링크 fallback */
  headerNavigationData?: HeaderNavigationData | null;
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
  session: { name: string } | null;
  memberPoints: number | null;
};

/** 데이터 없을 때 사용할 최소 1차 메뉴 (직접 링크) */
function getFallbackPrimaryNav(): HeaderPrimaryNavItem[] {
  return HEADER_PRIMARY_NAV_ITEMS.map(({ key, label }) => ({
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
}: SiteHeaderUIProps) {
  const pathname = usePathname();
  /** 모바일/태블릿 헤더 검색행: 홈에서만 숨겨 히어로 검색과 중복 제거 */
  const isHomePath = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const primaryNav = headerNavigationData?.primaryNav?.length
    ? headerNavigationData.primaryNav
    : getFallbackPrimaryNav();

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky z-50 transition-all duration-200 safe-top top-[env(safe-area-inset-top)] lg:z-40",
        scrolled
          ? "border-b border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-sm"
          : "border-b border-[var(--divider)] bg-[var(--surface)]",
      )}
    >
      {/* 데스크톱: 상단 유틸바 + 메인 헤더바 */}
      <PageContainer size="wide" className="hidden flex-col py-0 lg:flex">
        {/* 상단 유틸바: 회사소개 ~ 고객센터 */}
        <div className="flex h-10 items-center justify-center gap-x-8 border-b border-[var(--divider)]">
          <nav className="flex items-center gap-x-8 tracking-tight" aria-label="유틸리티 메뉴">
            <Link className={getNavLinkClass(activeTab === "about")} href="/about">
              회사소개
            </Link>
            <Link className={getNavLinkClass(activeTab === "quote")} href="/quote">
              견적문의
            </Link>
            <Link className={getNavLinkClass(activeTab === "reviews")} href="/reviews">
              여행후기
            </Link>
            <Link className={getNavLinkClass(activeTab === "blog")} href="/blog">
              여행가이드
            </Link>
            <Link className={getNavLinkClass(activeTab === "support")} href="/support">
              고객센터
            </Link>
          </nav>
        </div>

        {/* 메인 헤더바: 높이·로고 비율은 globals --header-* 토큰 (데스크톱 64px / 로고 높이·max는 토큰 참고) */}
        <div className="header-main-bar--desktop flex items-center gap-x-5 lg:gap-x-6 xl:gap-x-7">
          <Link
            href="/"
            className="header-logo-link shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <HeaderBrandLogo variant="desktop" priority />
          </Link>

          <DesktopMegaMenu primaryNav={primaryNav} />

          <div className="flex flex-1 justify-end items-center gap-x-4">
            <HeaderExpandSearch searchQuery={searchQuery} />

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
        </div>
      </PageContainer>

      <MobileHeaderMenu
        primaryNav={primaryNav}
        activeTab={activeTab}
        searchQuery={searchQuery}
        session={session}
        showHeaderSearchRow={!isHomePath}
      />
    </header>
  );
}
