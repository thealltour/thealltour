"use client";

import Link from "next/link";
import { ArrowRight, Compass, Flag } from "lucide-react";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { HOME_MAIN_SECTION_BLOCK_CLASS } from "@/components/layout/SectionHeader";
import { cn } from "@/lib/cn";
import { trackClientAnalytics } from "@/lib/analytics/trackEvent";
import { trackPlannerEntryClick } from "@/lib/analytics/trackPlannerEvents";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";

export type HomeTravelPathwaysProps = {
  golfHref: string;
  plannerEnabled?: boolean;
};

const pathwayLinkClassName = cn(
  "group flex min-h-[5.5rem] w-full min-w-0 items-center gap-3 rounded-[var(--radius-lg)]",
  "border border-[var(--border)] bg-[var(--surface)] p-4",
  "text-[var(--foreground)] shadow-[var(--shadow-soft)]",
  "transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]",
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
  "sm:min-h-[6.25rem] sm:gap-4 sm:p-5",
);

/**
 * 히어로 바로 아래 — 골프 / 자유여행 독립 진입 섹션.
 * 골프 달력·추천상품 본문은 HomeDeferredSections에 1회만 두고, 여기서는 진입만 담당한다.
 */
export function HomeTravelPathways({
  golfHref,
  plannerEnabled = ENABLE_FREE_TRAVEL_PLANNER,
}: HomeTravelPathwaysProps) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <SectionBlock
        id="home-pathway-golf"
        surface="none"
        padding="md"
        className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, "scroll-mt-48")}
      >
        <h2
          id="home-pathway-golf-title"
          className="mb-3 type-h3 font-semibold tracking-tight text-[var(--foreground)] sm:mb-4"
        >
          골프여행 찾기
        </h2>
        <Link
          href={golfHref}
          aria-label="골프여행 찾기 — 출발 일정과 추천 상품 보기"
          className={pathwayLinkClassName}
          onClick={() => {
            trackClientAnalytics({
              eventName: "home_travel_entry_click",
              source: "home_pathways",
              section: "golf",
              label: "골프여행 찾기",
              href: golfHref,
              metadata: { variant: "pathway" },
            });
          }}
        >
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary-soft)] text-[var(--primary)]"
            aria-hidden
          >
            <Flag size={20} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold leading-snug sm:text-lg">
              출발 일정과 추천 상품
            </span>
            <span className="mt-1 block type-caption leading-snug text-[var(--text-muted)] sm:text-sm">
              추천 골프상품과 출발 가능 날짜를 아래에서 바로 확인하세요
            </span>
          </span>
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
              "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
              "transition-colors group-hover:border-[var(--border-strong)] group-hover:text-[var(--primary)]",
            )}
            aria-hidden
          >
            <ArrowRight size={16} strokeWidth={2} />
          </span>
        </Link>
      </SectionBlock>

      {plannerEnabled ? (
        <SectionBlock
          id="home-pathway-planner"
          surface="none"
          padding="md"
          className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, "scroll-mt-48")}
        >
          <h2
            id="home-pathway-planner-title"
            className="mb-3 type-h3 font-semibold tracking-tight text-[var(--foreground)] sm:mb-4"
          >
            자유여행 만들기
          </h2>
          <Link
            href="/planner"
            aria-label="자유여행 만들기 — 일정 플래너 시작"
            className={pathwayLinkClassName}
            onClick={() => {
              trackPlannerEntryClick({ source: "home_pathways", variant: "card" });
            }}
          >
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]"
              aria-hidden
            >
              <Compass size={20} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug sm:text-lg">
                내 일정에 맞는 여행 설계
              </span>
              <span className="mt-1 block type-caption leading-snug text-[var(--text-muted)] sm:text-sm">
                목적지·기간·취향을 알려주시면 AI가 자유여행 초안을 만들어 드려요
              </span>
            </span>
            <span
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
                "transition-colors group-hover:border-[var(--border-strong)] group-hover:text-[var(--primary)]",
              )}
              aria-hidden
            >
              <ArrowRight size={16} strokeWidth={2} />
            </span>
          </Link>
        </SectionBlock>
      ) : null}
    </div>
  );
}
