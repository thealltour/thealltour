"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Flag, Gem, LayoutGrid, Palmtree, Users } from "lucide-react";
import { HOME_HERO_QUICK_ACTIONS } from "@/lib/homeHeroQuickActions";

const QUICK_ACTION_ICONS: Record<string, LucideIcon> = {
  golf: Flag,
  healing: Palmtree,
  family: Users,
  luxury: Gem,
  all: LayoutGrid,
};

/**
 * 모바일 홈 히어로 검색창 하단 — 보조 빠른 탐색 카드 (1행 5칸).
 */
export function HomeQuickKeywords() {
  return (
    <nav
      className="w-full min-w-0 max-w-full md:hidden"
      aria-label="테마·상품군 빠른 탐색 (보조)"
    >
      <ul className="grid w-full grid-cols-5 items-stretch gap-2.5 sm:gap-3">
        {HOME_HERO_QUICK_ACTIONS.map((item) => {
          const IconComponent = QUICK_ACTION_ICONS[item.id] ?? LayoutGrid;
          return (
            <li key={item.id} className="flex min-w-0">
              <Link
                href={item.href}
                className="group flex h-full min-h-[76px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-1 py-3 text-center shadow-[0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--hero-accent)]/25 hover:shadow-[0_6px_16px_rgba(15,23,42,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 active:shadow-[0_2px_6px_rgba(15,23,42,0.06)] sm:min-h-[80px] sm:px-1.5"
                aria-label={item.ariaLabel ?? item.label}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--hero-accent)]/15 to-[var(--hero-accent)]/5 text-[var(--hero-accent)] ring-1 ring-[var(--hero-accent)]/15 transition-all duration-200 group-hover:from-[var(--hero-accent)]/22 group-hover:to-[var(--hero-accent)]/10 group-hover:ring-[var(--hero-accent)]/30 sm:h-12 sm:w-12"
                  aria-hidden
                >
                  <IconComponent className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2} />
                </span>
                <span className="line-clamp-1 w-full max-w-full px-0.5 text-center text-xs font-semibold leading-tight tracking-tight text-[var(--hero-text-secondary)] group-hover:text-[var(--hero-text-primary)]">
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
