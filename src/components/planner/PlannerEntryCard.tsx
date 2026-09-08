"use client";

import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { trackPlannerEntryClick, type PlannerEntrySource } from "@/lib/analytics/trackPlannerEvents";

export type PlannerEntryCardVariant = "compact" | "card";

const HUB_COPY = {
  eyebrow: "여행플래너",
  title: "내 여행을 직접 만들어보세요",
  description: "출발지와 목적지를 알려주시면 일정부터 여행 준비까지 함께 정리해드려요.",
  /** Mobile compact — shorter so hub hero stays short */
  compactDescription: "출발지와 목적지만 알려주시면 여행 일정을 정리해드려요.",
} as const;

/**
 * Hub Hero editorial service card for planner entry.
 * Shares badge / radius / arrow language with home discovery cards,
 * but uses a solid surface suited to clean (non-photo) hub heroes.
 */
export function PlannerEntryCard({
  source,
  variant,
  className,
}: {
  source: Exclude<PlannerEntrySource, "home_hero">;
  variant: PlannerEntryCardVariant;
  className?: string;
}) {
  if (!ENABLE_FREE_TRAVEL_PLANNER) return null;
  const isCard = variant === "card";

  return (
    <Link
      href="/planner"
      aria-label="여행플래너 시작하기"
      className={cn(
        "group flex min-w-0 min-h-11 text-[var(--foreground)]",
        "rounded-[var(--radius-lg)] sm:rounded-2xl",
        "border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
        "transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]",
        "active:bg-[var(--surface-muted)]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
        isCard
          ? "flex-row items-start gap-4 p-5 lg:p-6"
          : "flex-row items-center gap-2.5 p-2.5 sm:gap-3 sm:p-3",
        className,
      )}
      onClick={() => trackPlannerEntryClick({ source, variant })}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)]",
          "bg-[var(--accent-soft)] text-[var(--accent)]",
          isCard ? "h-11 w-11" : "h-8 w-8 sm:h-9 sm:w-9",
        )}
        aria-hidden
      >
        <Compass size={isCard ? 22 : 16} strokeWidth={1.75} className={isCard ? undefined : "sm:h-[18px] sm:w-[18px]"} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-[var(--accent)] sm:text-sm">{HUB_COPY.eyebrow}</span>
        <span
          className={cn(
            "mt-0.5 block font-semibold leading-snug text-[var(--foreground)]",
            isCard ? "text-lg" : "text-[0.9375rem] sm:text-base",
          )}
        >
          {HUB_COPY.title}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[var(--text-muted)] sm:mt-1",
            isCard
              ? "text-[0.875rem] leading-relaxed"
              : "line-clamp-2 text-[0.75rem] leading-snug sm:text-[0.8125rem]",
          )}
        >
          {isCard ? HUB_COPY.description : HUB_COPY.compactDescription}
        </span>
      </span>

      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full",
          "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
          "transition-colors group-hover:border-[var(--border-strong)] group-hover:text-[var(--primary)]",
          "group-active:bg-[var(--surface-muted)]",
          isCard ? "mt-0.5 h-9 w-9" : "h-7 w-7 sm:h-8 sm:w-8",
        )}
        aria-hidden
      >
        <ArrowRight size={isCard ? 16 : 12} strokeWidth={2} className={isCard ? undefined : "sm:h-3.5 sm:w-3.5"} />
      </span>
    </Link>
  );
}
