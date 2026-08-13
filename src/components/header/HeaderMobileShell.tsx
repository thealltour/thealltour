"use client";

import Link from "next/link";
import { HeaderBrandLogo } from "@/components/header/HeaderBrandLogo";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";
import type { HeaderUtilityTab } from "@/components/header/headerNav.types";

type HeaderMobileShellProps = {
  activeTab?: HeaderUtilityTab;
  searchQuery?: string;
};

/**
 * 레거시/보조용 모바일 헤더 셸 — SiteHeaderUI와 동일한 2단 구조 유지
 */
export default function HeaderMobileShell({
  activeTab: _activeTab,
  searchQuery,
}: HeaderMobileShellProps) {
  return (
    <div className="mobile-header-stack lg:hidden">
      <div className="mobile-header-top-bar mx-auto max-w-6xl">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("thealltour-mobile-menu-toggle"));
            }
          }}
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

        {/* 우측은 메인 헤더 CTA 폭과 유사하게 비워 두어 로고 시각 중심 유지 */}
        <div className="relative z-10 h-10 min-w-[4.5rem] shrink-0" aria-hidden />
      </div>

      <div className="mobile-header-search-row mx-auto w-full max-w-6xl border-t border-[var(--divider)]/80">
        <HeaderProductSearch mode="mobile" headerBar searchQuery={searchQuery} />
      </div>
    </div>
  );
}
