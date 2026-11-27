"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";
import { trackPlannerEntryClick } from "@/lib/analytics/trackPlannerEvents";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import {
  elementIdFromHashHref,
  scrollToElementId,
} from "@/lib/navigation/inPageAnchor";

export type HomeTravelPathwaysProps = {
  golfHref: string;
  /** 달력 데이터가 있을 때 `#home-golf-dates` 등. 없으면 출발일 칩 숨김 */
  golfDatesHref?: string | null;
  plannerEnabled?: boolean;
  /** 인라인(추천상품 제목 옆) vs 독립 행 */
  variant?: "inline" | "row";
  className?: string;
};

const chipClassName = cn(
  "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-1.5",
  "border border-[var(--border)] bg-[var(--surface)] text-sm font-medium text-[var(--foreground)]",
  "transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
);

/**
 * 골프·출발일·패키지·맞춤견적·플래너 작은 바로가기.
 * 기존 대형 진입 카드를 대체하며 클릭 계측·플래그 계약을 유지한다.
 */
export function HomeTravelPathways({
  golfHref,
  golfDatesHref = null,
  plannerEnabled = ENABLE_FREE_TRAVEL_PLANNER,
  variant = "row",
  className,
}: HomeTravelPathwaysProps) {
  const datesHref = golfDatesHref?.trim() || null;

  const links = (
    <>
      <Link
        href={golfHref}
        className={chipClassName}
        onClick={(e) => {
          const id = elementIdFromHashHref(golfHref);
          if (id) {
            e.preventDefault();
            scrollToElementId(id);
          }
          trackClientAnalytics({
            eventName: "home_travel_entry_click",
            source: "home_pathways",
            section: "golf",
            label: "골프",
            href: golfHref,
            metadata: { variant: "shortcut" },
          });
        }}
      >
        골프
      </Link>
      {datesHref ? (
        <Link
          href={datesHref}
          className={chipClassName}
          onClick={(e) => {
            const id = elementIdFromHashHref(datesHref);
            if (id) {
              e.preventDefault();
              scrollToElementId(id);
            }
            trackClientAnalytics({
              eventName: "home_travel_entry_click",
              source: "home_pathways",
              section: "golf_find_dates",
              label: "출발일로 찾기",
              href: datesHref,
              metadata: { variant: "shortcut" },
            });
          }}
        >
          출발일로 찾기
        </Link>
      ) : null}
      <Link
        href="/products"
        className={chipClassName}
        onClick={() => {
          trackClientAnalytics({
            eventName: "home_travel_entry_click",
            source: "home_pathways",
            section: "package",
            label: "패키지",
            href: "/products",
            metadata: { variant: "shortcut" },
          });
        }}
      >
        패키지
      </Link>
      <Link
        href="/quote"
        className={chipClassName}
        onClick={() => {
          trackClientAnalytics({
            eventName: "home_travel_entry_click",
            source: "home_pathways",
            section: "quote",
            label: "맞춤견적",
            href: "/quote",
            metadata: { variant: "shortcut" },
          });
        }}
      >
        맞춤견적
      </Link>
      {plannerEnabled ? (
        <Link
          href="/planner"
          className={chipClassName}
          onClick={() => {
            trackPlannerEntryClick({ source: "home_pathways", variant: "compact" });
          }}
        >
          여행플래너
        </Link>
      ) : null}
    </>
  );

  if (variant === "inline") {
    return (
      <nav
        aria-label="여행 바로가기"
        className={cn("flex flex-wrap items-center gap-2", className)}
      >
        {links}
      </nav>
    );
  }

  return (
    <nav
      id="home-pathway-golf"
      aria-label="여행 바로가기"
      className={cn("flex flex-wrap items-center gap-2 scroll-mt-48", className)}
    >
      {links}
    </nav>
  );
}
