"use client";

import Link from "next/link";
import { CalendarDays, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";

export type HomeHeroGolfFindCtasProps = {
  /** 추천 골프상품 섹션 앵커. 없으면 해당 CTA 숨김 */
  toursHref?: string | null;
  /** 출발 일정 달력 앵커. 없으면 해당 CTA 숨김 */
  datesHref?: string | null;
};

const ctaClassName = cn(
  "inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2",
  "rounded-[var(--radius-lg)] px-4 py-2.5",
  "text-sm font-semibold tracking-tight",
  "transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
);

/**
 * 히어로 검색 하단 — 골프 탐색 분기 CTA.
 * 본문의 #home-golf-tours / #home-golf-dates 로 스크롤한다 (달력·상품은 아래에 1회만 유지).
 */
export function HomeHeroGolfFindCtas({ toursHref, datesHref }: HomeHeroGolfFindCtasProps) {
  const tours = toursHref?.trim() || null;
  const dates = datesHref?.trim() || null;
  if (!tours && !dates) return null;

  return (
    <nav
      aria-label="골프여행 탐색"
      className="relative z-0 mt-2 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:gap-3"
    >
      {tours ? (
        <Link
          href={tours}
          className={cn(
            ctaClassName,
            "border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)]",
            "hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
            "glass-on-media",
          )}
          onClick={() => {
            trackClientAnalytics({
              eventName: "home_travel_entry_click",
              source: "home_hero",
              section: "golf_find_tours",
              label: "추천상품으로 찾기",
              href: tours,
            });
          }}
        >
          <Sparkles size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          추천상품으로 찾기
        </Link>
      ) : null}
      {dates ? (
        <Link
          href={dates}
          className={cn(
            ctaClassName,
            "border border-transparent bg-[var(--primary)] text-[var(--on-primary)]",
            "hover:opacity-95",
          )}
          onClick={() => {
            trackClientAnalytics({
              eventName: "home_travel_entry_click",
              source: "home_hero",
              section: "golf_find_dates",
              label: "출발 날짜로 찾기",
              href: dates,
            });
          }}
        >
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          출발 날짜로 찾기
        </Link>
      ) : null}
    </nav>
  );
}
