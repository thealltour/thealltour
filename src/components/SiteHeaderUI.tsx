"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, X } from "lucide-react";
import HeaderProductSearch from "@/components/HeaderProductSearch";
import MemberLogoutButton from "@/components/MemberLogoutButton";
import MobileFloatingMenu from "@/components/MobileFloatingMenu";
import HeaderQuickConsultCtas from "@/components/HeaderQuickConsultCtas";
import HeaderMobileShell from "@/components/HeaderMobileShell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type SiteHeaderUIProps = {
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  golfPresetActive?: boolean;
  quickConsultHref?: string;
  kakaoConsultHref?: string;
  session: { name: string } | null;
  memberPoints: number | null;
};

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap type-nav transition-colors duration-150 py-1 px-0.5 rounded";
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

function getSubChipClass(isActive: boolean, isGolf?: boolean) {
  const base =
    "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 type-caption md:type-small transition-colors duration-150";
  if (isActive) {
    return isGolf
      ? cn(base, "bg-[var(--success-bg)] border-[var(--success)]/40 text-[var(--success)]")
      : cn(base, "bg-[var(--primary-soft)] border-[var(--primary)]/40 text-[var(--primary)]");
  }
  return cn(
    base,
    "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]",
    "hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
  );
}

export default function SiteHeaderUI({
  activeTab,
  searchQuery,
  golfPresetActive = false,
  quickConsultHref,
  kakaoConsultHref,
  session,
  memberPoints,
}: SiteHeaderUIProps) {
  const [scrolled, setScrolled] = useState(false);

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
          : "bg-[var(--theall-page-bg)]",
      )}
    >
      {/* 데스크톱: 64px */}
      <div className="mx-auto hidden w-full max-w-6xl flex-col px-6 py-0 lg:flex md:px-10">
        <div className="flex h-16 items-center gap-8">
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

          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 tracking-tight">
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
        </div>

        <div className="flex h-14 items-center gap-3 border-t border-[var(--divider)]">
          <div className="flex shrink-0 items-center gap-2">
            <Link
              className={getSubChipClass(activeTab === "products")}
              href="/products"
            >
              <span className="flex items-center gap-1.5">
                {activeTab === "products" ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                패키지상품
              </span>
            </Link>
            <Link
              className={getSubChipClass(golfPresetActive, true)}
              href="/products?tourType=golf-park"
            >
              <span className="flex items-center gap-1.5">
                {golfPresetActive ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                골프/파크골프
              </span>
            </Link>
          </div>

          <div className="flex flex-1 justify-center px-2">
            <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
          </div>

          <HeaderQuickConsultCtas
            quickConsultHref={quickConsultHref}
            kakaoConsultHref={kakaoConsultHref}
          />
        </div>
      </div>

      <HeaderMobileShell activeTab={activeTab} searchQuery={searchQuery} />
      <MobileFloatingMenu activeTab={activeTab} isLoggedIn={!!session} />
    </header>
  );
}
