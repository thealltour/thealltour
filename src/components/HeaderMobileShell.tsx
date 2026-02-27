"use client";

import Link from "next/link";
import Image from "next/image";
import HeaderProductSearch from "@/components/HeaderProductSearch";

type HeaderMobileShellProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
};

export default function HeaderMobileShell({
  activeTab: _activeTab,
  searchQuery,
}: HeaderMobileShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 lg:hidden md:px-6">
      {/* 1줄: 좌 심볼, 가운데 브랜드명, 우 햄버거 */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] transition-colors duration-150 hover:bg-white/10"
          aria-label="더올투어 홈"
        >
          <Image
            src="/thealltour-logo.png"
            alt="더올투어 로고"
            width={40}
            height={40}
            sizes="40px"
            className="h-8 w-8 object-contain"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <span className="heading-display-hero text-[15px] font-bold tracking-[0.08em] text-white">
            더올투어
          </span>
          <span className="mt-0.5 text-[10px] font-medium tracking-[0.16em] text-white/60">
            Golf & Premium Travel
          </span>
        </div>

        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("thealltour-mobile-menu-toggle"));
            }
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white transition-colors duration-150 hover:bg-white/12"
        >
          <span className="flex flex-col gap-[3px]">
            <span className="h-[2px] w-4 rounded-full bg-white" />
            <span className="h-[2px] w-4 rounded-full bg-white" />
            <span className="h-[2px] w-4 rounded-full bg-white" />
          </span>
        </button>
      </div>

      {/* 2줄: 검색창 풀폭 */}
      <div className="pt-1">
        <HeaderProductSearch mode="mobile" searchQuery={searchQuery} />
      </div>
    </div>
  );
}

