"use client";

import Link from "next/link";
import Image from "next/image";

type HeaderMobileShellProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
};

export default function HeaderMobileShell({
  activeTab: _activeTab,
  searchQuery: _searchQuery,
}: HeaderMobileShellProps) {
  return (
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 lg:hidden md:px-6">
      <Link
        href="/"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
        <span className="heading-display-hero type-small font-bold tracking-tight text-[var(--secondary)]">
          더올투어
        </span>
        <span className="mt-0.5 type-caption font-medium tracking-wide text-[var(--text-muted)]">
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
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-transparent text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="flex flex-col gap-[3px]" aria-hidden>
          <span className="h-[2px] w-4 rounded-full bg-current" />
          <span className="h-[2px] w-4 rounded-full bg-current" />
          <span className="h-[2px] w-4 rounded-full bg-current" />
        </span>
      </button>
    </div>
  );
}

