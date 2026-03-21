"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { HOME_HERO_QUICK_ACTIONS } from "@/lib/homeHeroQuickActions";

/**
 * 모바일 홈 히어로 검색창 하단 — 빠른 선택 허브 (1행 5칸 고정, 스크롤 없음).
 * 아이콘: 브랜드 시스템 `@/components/ui/Icon` + `@/icons` 레지스트리.
 */
export function HomeQuickKeywords() {
  return (
    <nav
      className="mt-2.5 w-full min-w-0 max-w-full sm:mt-3 md:hidden"
      aria-label="빠른 테마·상품군 선택"
    >
      <ul className="grid w-full grid-cols-5 gap-1 sm:gap-2">
        {HOME_HERO_QUICK_ACTIONS.map((item) => (
          <li key={item.id} className="min-w-0">
            <Link
              href={item.href}
              className="group flex min-h-[3.125rem] w-full flex-col items-center justify-center gap-1 rounded-xl border border-slate-200/70 bg-white/90 px-0.5 py-1.5 text-center shadow-none transition-colors duration-200 hover:border-slate-200 hover:bg-slate-50/95 hover:shadow-[0_2px_12px_rgba(15,23,42,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--hero-bg)] active:bg-slate-100/80 sm:min-h-[3.625rem] sm:gap-1.5 sm:px-1 sm:py-2.5"
              aria-label={item.ariaLabel ?? item.label}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50/95 text-[var(--hero-accent)] ring-1 ring-slate-100 transition-colors group-hover:bg-slate-100/90 group-hover:ring-slate-200/70 sm:h-8 sm:w-8"
                aria-hidden
              >
                <Icon
                  name={item.iconName}
                  size={16}
                  decorative
                  className="shrink-0 sm:h-[18px] sm:w-[18px]"
                />
              </span>
              <span className="line-clamp-2 w-full px-0.5 text-center text-[10px] font-semibold leading-tight tracking-tight text-[var(--hero-text-primary)]/90 sm:text-[11px] sm:leading-normal">
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
