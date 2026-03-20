"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Flag, Gem, LayoutGrid, Leaf, Users } from "lucide-react";
import { HOME_HERO_QUICK_ACTIONS, type HomeHeroQuickActionIconKey } from "@/lib/homeHeroQuickActions";

const ICONS: Record<HomeHeroQuickActionIconKey, LucideIcon> = {
  flag: Flag,
  leaf: Leaf,
  users: Users,
  gem: Gem,
  grid: LayoutGrid,
};

/**
 * 모바일 홈 히어로 검색창 하단 — 아이콘 기반 빠른 선택 허브 (칩/필터 나열 대체).
 * md 이상에서는 부모에서 숨김 처리 권장.
 */
export function HomeQuickKeywords() {
  return (
    <nav
      className="w-full pt-2 md:hidden"
      aria-label="빠른 테마·상품군 선택"
    >
      <ul className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {HOME_HERO_QUICK_ACTIONS.map((item) => {
          const Icon = ICONS[item.iconKey];
          return (
            <li key={item.id} className="min-w-0">
              <Link
                href={item.href}
                className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--hero-badge-border)]/80 bg-[var(--hero-badge-bg)]/90 px-1 py-2 text-center shadow-sm transition hover:border-[var(--hero-accent)]/35 hover:bg-[var(--hero-badge-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hero-bg)] active:scale-[0.98]"
                aria-label={item.ariaLabel ?? item.label}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--theall-page-bg)]/60 text-[var(--hero-accent)] ring-1 ring-[var(--hero-badge-border)]/50"
                  aria-hidden
                >
                  <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} />
                </span>
                <span className="type-caption line-clamp-2 w-full px-0.5 text-[10px] font-semibold leading-tight text-[var(--hero-text-primary)] sm:text-[11px]">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
