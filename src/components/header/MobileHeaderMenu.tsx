"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { MobileHeaderDrawer } from "./MobileHeaderDrawer";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";

export type MobileHeaderMenuProps = {
  primaryNav: HeaderPrimaryNavItem[];
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  session: { name: string } | null;
  /**
   * false면 헤더 직하단 검색행 미렌더 (홈 모바일/태블릿: 히어로 검색만 사용).
   * @default true
   */
  showHeaderSearchRow?: boolean;
};

/**
 * 모바일 2단 헤더: [☰ | 로고 | 문의하기] + (옵션) 고정 검색바
 * 검색 → 탐색(드로어) → 상담(CTA) 동선. CTA는 1개만(오렌지 캡슐).
 */
export function MobileHeaderMenu({
  primaryNav,
  activeTab: _activeTab,
  searchQuery,
  session,
  showHeaderSearchRow = true,
}: MobileHeaderMenuProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { openModal } = useConsultModal();

  useEffect(() => {
    function handleToggle() {
      setIsDrawerOpen((prev) => !prev);
    }
    window.addEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    return () => {
      window.removeEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    };
  }, []);

  function openDrawerWithTrack() {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.mobile_menu_open,
        source: ANALYTICS_SOURCES.header_mobile_drawer,
        label: "hamburger",
        section: "mobile_header",
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    setIsDrawerOpen(true);
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  function handleConsultClick() {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        section: "mobile_header",
        label: "문의하기",
        href: "/quote",
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    openModal({
      productTitle: "패키지/골프 맞춤 상담",
      sourcePath: typeof window !== "undefined" ? `${window.location.pathname}#mobile-header-consult` : "",
    });
  }

  return (
    <>
      <div className="mobile-header-stack lg:hidden">
        <div className="mobile-header-top-bar mx-auto max-w-6xl">
          <button
            type="button"
            aria-label="메뉴 열기"
            onClick={openDrawerWithTrack}
            className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
          >
            <span className="flex flex-col gap-[3px]" aria-hidden>
              <span className="h-[2px] w-4 rounded-full bg-current" />
              <span className="h-[2px] w-4 rounded-full bg-current" />
              <span className="h-[2px] w-4 rounded-full bg-current" />
            </span>
          </button>

          <Link
            href="/"
            className="absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            aria-label="더올투어 홈"
          >
            <HeaderBrandLogo variant="touch" className="mobile-header-top-logo" />
          </Link>

          <button
            type="button"
            onClick={handleConsultClick}
            className="mobile-header-top-bar__cta glass-cta-edge relative z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            문의하기
          </button>
        </div>

        {showHeaderSearchRow ? (
          <div className="mobile-header-search-row mx-auto w-full max-w-6xl border-t border-[var(--divider)]/80">
            <HeaderProductSearch mode="mobile" headerBar searchQuery={searchQuery} />
          </div>
        ) : null}
      </div>

      <MobileHeaderDrawer
        primaryNav={primaryNav}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        session={session}
        searchQuery={searchQuery}
      />
    </>
  );
}
