"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import { HeaderExpandSearch } from "@/components/HeaderExpandSearch";
import { DesktopMegaMenu } from "@/components/header/DesktopMegaMenu";
import { MobileHeaderMenu } from "@/components/header/MobileHeaderMenu";
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
    "relative shrink-0 whitespace-nowrap type-nav font-medium transition-colors duration-150 py-1 px-0.5 rounded";
  if (isActive) {
    return cn(
      base,
      "text-[var(--foreground)] font-semibold",
      "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
    );
  }
  return cn(
    base,
    "text-[var(--text-muted)]",
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
        "sticky z-40 transition-all duration-200 safe-top top-[env(safe-area-inset-top)]",
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

        {/* 메인 헤더바: 로고 | 메가메뉴 | 검색(비홈) | 마이페이지/CTA */}
        <div className="flex h-[72px] min-h-[72px] items-center gap-x-10 md:h-[76px] md:min-h-[76px]">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <Image
              src="/thealltour-logo.png"
              alt=""
              width={64}
              height={64}
              sizes="64px"
              className="h-10 w-10 object-contain md:h-11 md:w-11"
            />
            <div className="flex flex-col justify-center leading-tight">
              <span className="heading-display-hero text-[15px] font-bold tracking-tight text-[var(--secondary)] md:text-[17px]">
                더올투어
              </span>
              <span className="mt-0.5 type-caption font-medium tracking-wide text-[var(--text-muted)]">
                Golf & Premium Travel
              </span>
            </div>
          </Link>

          <DesktopMegaMenu primaryNav={primaryNav} />

          <div className="flex flex-1 justify-end items-center gap-x-4">
            <HeaderExpandSearch searchQuery={searchQuery} />

            <div className="flex shrink-0 items-center gap-3">
              {session ? (
                <>
                  <Link
                    href="/mypage"
                    aria-label="마이페이지로 이동"
                    className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    마이페이지
                  </Link>
                  {memberPoints !== null ? (
                    <Link
                      href="/mypage/points"
                      aria-label="포인트 내역으로 이동"
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2 py-1 type-caption font-semibold text-[var(--primary)] transition hover:bg-[var(--primary-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      포인트
                      <span className="tabular-nums">{memberPoints.toLocaleString("ko-KR")}P</span>
                    </Link>
                  ) : null}
                  <span className="hidden xl:inline type-small text-[var(--text-muted)]">{session.name}님</span>
                  <span className="text-[var(--divider)]" aria-hidden>|</span>
                  <MemberLogoutButton />
                </>
              ) : (
                <>
                  <Link
                    className="type-small text-[var(--text-muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded"
                    href="/login"
                  >
                    로그인
                  </Link>
                  <span className="text-[var(--divider)]" aria-hidden>|</span>
                  <Link
                    className={cn(
                      "type-small transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:rounded",
                      activeTab === "signup"
                        ? "font-semibold text-[var(--primary)]"
                        : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                    )}
                    href="/signup"
                  >
                    회원가입
                  </Link>
                </>
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
      />
    </header>
  );
}
