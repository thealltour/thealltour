"use client";

import Link from "next/link";
import { ArrowRight, Compass, Flag, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";
import { trackPlannerEntryClick } from "@/lib/analytics/trackPlannerEvents";

type EntryKey = "golf" | "planner";

const entries: ReadonlyArray<{
  key: EntryKey;
  title: string;
  /** Desktop / tablet (≥sm) */
  description: string;
  /** Mobile (&lt;sm) — shorter so stacked rows stay one line */
  mobileDescription: string;
  icon: LucideIcon;
  badgeClassName: string;
}> = [
  {
    key: "golf",
    title: "골프여행 찾기",
    description: "출발 일정과 추천 상품을 확인해보세요",
    mobileDescription: "출발일별 추천 골프상품",
    icon: Flag,
    badgeClassName: "bg-[var(--primary-soft)] text-[var(--primary)]",
  },
  {
    key: "planner",
    title: "자유여행 만들기",
    description: "내 일정과 취향에 맞는 여행을 만들어보세요",
    mobileDescription: "일정·취향 맞춤 여행 설계",
    icon: Compass,
    badgeClassName: "bg-[var(--accent-soft)] text-[var(--accent)]",
  },
];

/**
 * Shared shell: product-card interactive radius/border/shadow language +
 * `glass-on-media` (already used by HomeHeroSearch) for contrast on hero imagery.
 * md–lg: slightly tighter density; lg+: restore desktop spacing.
 */
const entryLinkClassName = cn(
  "group glass-on-media flex min-w-0 flex-row items-center gap-3 p-3",
  "md:gap-2.5 md:p-2.5 lg:gap-3 lg:p-3",
  "min-h-11 sm:min-h-[96px] md:min-h-[84px] lg:min-h-[96px]",
  "rounded-[var(--radius-lg)] text-[var(--foreground)]",
  "transition active:bg-[var(--surface-muted)]",
  /* Card `interactive` hover — pointer devices */
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]",
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
);

/**
 * Equal-weight golf / planner entries under the hero search.
 * Mobile (&lt;sm): single stacked column + short copy.
 * sm+: two columns; md–lg density polish; lg+ desktop spacing.
 */
export function HomeTravelEntries({ golfHref }: { golfHref: string }) {
  return (
    <nav
      aria-label="여행 준비 방법"
      className="relative z-0 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 md:gap-2 lg:gap-3"
    >
      {entries.map(({ key, title, description, mobileDescription, icon: Icon, badgeClassName }) => {
        const href = key === "golf" ? golfHref : "/planner";
        return (
          <Link
            key={key}
            href={href}
            aria-label={title}
            className={entryLinkClassName}
            onClick={() => {
              if (key === "planner") {
                trackPlannerEntryClick({ source: "home_hero", variant: "paired" });
              } else {
                trackClientAnalytics({
                  eventName: "home_travel_entry_click",
                  source: "home_hero",
                  section: "golf",
                  label: title,
                  href,
                  metadata: { variant: "paired" },
                });
              }
            }}
          >
            <span
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
                "md:h-8 md:w-8 lg:h-9 lg:w-9",
                badgeClassName,
              )}
              aria-hidden
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                className="h-[18px] w-[18px] md:h-4 md:w-4 lg:h-[18px] lg:w-[18px]"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug md:text-[0.9375rem] lg:text-base">
                {title}
              </span>
              <span className="mt-0.5 block type-caption leading-snug text-[var(--text-muted)] sm:hidden">
                {mobileDescription}
              </span>
              <span
                className={cn(
                  "mt-0.5 hidden line-clamp-2 text-[var(--text-muted)] sm:block",
                  /* explicit sizes so md/lg density wins over `.type-caption` globals */
                  "text-[0.8125rem] leading-snug md:text-[0.75rem] md:leading-tight lg:text-[0.8125rem] lg:leading-snug",
                )}
              >
                {description}
              </span>
            </span>
            <span
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                "md:h-7 md:w-7 lg:h-8 lg:w-8",
                "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
                "transition-colors group-hover:border-[var(--border-strong)] group-hover:text-[var(--primary)]",
                "group-active:bg-[var(--surface-muted)]",
              )}
              aria-hidden
            >
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="h-3.5 w-3.5 md:h-3 md:w-3 lg:h-3.5 lg:w-3.5"
              />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
