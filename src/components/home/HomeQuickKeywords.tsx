"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { HOME_HERO_QUICK_ACTIONS } from "@/lib/homeHeroQuickActions";

/**
 * 모바일 홈 히어로 검색창 하단 — 보조 빠른 탐색 카드 (1행 5칸).
 * 검색창보다 한 단계 낮은 시각 위계; 아이콘 색은 `var(--hero-accent)` 유지.
 */
export function HomeQuickKeywords() {
  return (
    <nav
      className="w-full min-w-0 max-w-full md:hidden"
      aria-label="테마·상품군 빠른 탐색 (보조)"
    >
      <ul className="grid w-full grid-cols-5 items-stretch gap-3.5">
        {HOME_HERO_QUICK_ACTIONS.map((item) => (
          <li key={item.id} className="flex min-w-0">
            <Link
              href={item.href}
              className="group flex h-full min-h-[72px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/95 bg-white/98 px-1 py-2.5 text-center shadow-[0_1px_4px_rgba(15,23,42,0.05)] transition-colors duration-200 hover:border-slate-300/95 hover:bg-white hover:shadow-[0_3px_12px_rgba(15,23,42,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:bg-slate-50/98 sm:min-h-[76px] sm:px-1.5 sm:py-3"
              aria-label={item.ariaLabel ?? item.label}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[var(--hero-accent)] ring-1 ring-slate-100/95 transition-colors group-hover:bg-slate-100/95 group-hover:ring-slate-200/80 sm:h-11 sm:w-11"
                aria-hidden
              >
                <Icon name={item.iconName} size={32} decorative className="shrink-0" />
              </span>
              <span className="line-clamp-1 w-full max-w-full px-0.5 text-center text-[11px] font-semibold leading-tight tracking-tight text-[var(--hero-text-secondary)]">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
