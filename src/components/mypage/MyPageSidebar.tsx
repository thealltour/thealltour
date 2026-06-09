"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const MENU_GROUPS = [
  {
    label: "요약",
    items: [{ href: "/mypage/dashboard", label: "대시보드" }],
  },
  {
    label: "포인트·리워드",
    items: [
      { href: "/mypage/points", label: "포인트" },
      { href: "/mypage/points/request", label: "적립 요청" },
      { href: "/mypage/rewards", label: "리워드 교환" },
      { href: "/mypage/redemptions", label: "교환 내역" },
    ],
  },
  {
    label: "활동",
    items: [
      { href: "/mypage/reviews", label: "리뷰 관리" },
      { href: "/mypage/notifications", label: "알림" },
    ],
  },
  {
    label: "계정",
    items: [{ href: "/mypage/profile", label: "회원정보" }],
  },
] as const;

type MenuItem = (typeof MENU_GROUPS)[number]["items"][number];

const ALL_MENU_ITEMS: MenuItem[] = MENU_GROUPS.flatMap((group) => [...group.items]);

type MyPageSidebarProps = {
  showMobileBack?: boolean;
};

type ScrollHints = {
  left: boolean;
  right: boolean;
  overflow: boolean;
};

function isActive(pathname: string, href: string) {
  if (href === "/mypage/points") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MyPageSidebar({ showMobileBack = false }: MyPageSidebarProps) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollHints, setScrollHints] = useState<ScrollHints>({
    left: false,
    right: false,
    overflow: false,
  });

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth - clientWidth > 8;
    setScrollHints({
      overflow,
      left: overflow && scrollLeft > 8,
      right: overflow && scrollLeft + clientWidth < scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollHints();

    const active = el.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });

    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollHints);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      resizeObserver.disconnect();
    };
  }, [pathname, updateScrollHints]);

  const linkClass = (active: boolean, mobile: boolean) =>
    cn(
      "font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
      mobile
        ? cn(
            "inline-flex min-h-[44px] shrink-0 snap-center items-center whitespace-nowrap rounded-xl border px-4 py-2 text-sm active:bg-[var(--surface-muted)]",
            active
              ? "border-[var(--primary)]/30 bg-[var(--primary-soft)] text-[var(--primary)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
          )
        : cn(
            "flex min-h-[44px] w-full items-center rounded-xl border px-3 py-2.5 text-sm active:bg-[var(--surface-muted)]",
            active
              ? "border-[var(--primary)]/30 bg-[var(--primary-soft)] text-[var(--primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
          ),
    );

  const fadeBase =
    "pointer-events-none absolute inset-y-0 z-10 w-10 from-[var(--surface)] transition-opacity duration-200";

  return (
    <>
      {/* 모바일: sticky 가로 탭 */}
      <nav
        aria-label="마이페이지 메뉴"
        className={cn(
          "lg:hidden sticky z-30 -mx-4 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6",
          showMobileBack ? "top-[var(--mypage-mobile-nav-top)]" : "top-[var(--mypage-mobile-stack-top)]",
        )}
      >
        <p className="sr-only" id="mypage-mobile-nav-hint">
          메뉴가 더 있습니다. 좌우로 스와이프해 나머지 항목을 확인할 수 있습니다.
        </p>

        <div className="relative">
          <div
            aria-hidden
            className={cn(
              fadeBase,
              "left-0 flex items-center bg-gradient-to-r to-transparent pl-0.5",
              scrollHints.left ? "opacity-100" : "opacity-0",
            )}
          >
            <ChevronLeft className="size-4 text-[var(--text-muted)]" strokeWidth={2.5} />
          </div>

          <div
            aria-hidden
            className={cn(
              fadeBase,
              "right-0 flex items-center justify-end bg-gradient-to-l to-transparent pr-0.5",
              scrollHints.right ? "opacity-100" : "opacity-0",
            )}
          >
            <ChevronRight className="size-4 text-[var(--primary)]" strokeWidth={2.5} />
          </div>

          <div
            ref={scrollRef}
            aria-describedby="mypage-mobile-nav-hint"
            className={cn(
              "flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth",
              "[-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              scrollHints.overflow && scrollHints.right && "mypage-mobile-nav-mask-right",
              scrollHints.overflow && scrollHints.left && "mypage-mobile-nav-mask-left",
            )}
          >
            {ALL_MENU_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active ? "true" : undefined}
                  className={linkClass(active, true)}
                >
                  {item.label}
                </Link>
              );
            })}
            {/* 마지막 탭 뒤 여백 — 우측 fade·다음 항목 peek 유도 */}
            <div aria-hidden className="w-6 shrink-0 snap-none sm:w-8" />
          </div>
        </div>

        {scrollHints.overflow && scrollHints.right ? (
          <p className="mt-1.5 text-center type-caption text-[var(--text-muted)]" aria-hidden>
            ← 좌우로 밀어 더 많은 메뉴 보기 →
          </p>
        ) : null}
      </nav>

      {/* 데스크톱: 세로 그룹 네비 */}
      <nav aria-label="마이페이지 메뉴" className="hidden lg:flex lg:flex-col lg:gap-5">
        {MENU_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="type-caption px-1 font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={linkClass(active, false)}>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );
}
