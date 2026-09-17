"use client";

import { useEffect, useRef } from "react";
import type { PlannerPlanDay } from "@/lib/planner/planSchemas";
import { cn } from "@/lib/cn";

export type PlannerDayNavigationProps = {
  days: PlannerPlanDay[];
  activeDay: number;
  onDaySelect: (dayNumber: number) => void;
  reducedMotion?: boolean;
};

export function PlannerDayNavigation({
  days,
  activeDay,
  onDaySelect,
  reducedMotion = false,
}: PlannerDayNavigationProps) {
  const tabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const btn = tabRefs.current.get(activeDay);
    const strip = stripRef.current;
    if (!btn || !strip) return;

    const btnLeft = btn.offsetLeft;
    const btnWidth = btn.offsetWidth;
    const target =
      btnLeft - strip.clientWidth / 2 + btnWidth / 2;
    const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const next = Math.min(max, Math.max(0, target));

    if (typeof strip.scrollTo === "function") {
      strip.scrollTo({
        left: next,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    } else {
      strip.scrollLeft = next;
    }
  }, [activeDay, reducedMotion, days.length]);

  if (days.length <= 1) return null;

  return (
    <nav
      aria-label="여행 일정 일자 이동"
      data-testid="planner-day-navigation"
      className={cn(
        "sticky z-30 -mx-4 border-b border-[var(--border)] px-4 py-2 sm:-mx-0 sm:px-0",
        // Result: search row hidden — use planner-result offset. lg+: util+main ≈ 108px
        "top-[var(--planner-result-day-nav-top)] lg:top-[108px]",
        "bg-[var(--theall-page-bg)]/95 backdrop-blur-sm supports-[backdrop-filter]:bg-[var(--theall-page-bg)]/90",
      )}
    >
      <div
        ref={stripRef}
        className="scrollbar-hide flex w-full flex-nowrap gap-1.5 overflow-x-auto pb-0.5"
      >
        {days.map((day, index) => {
          const isActive = day.day === activeDay;
          return (
            <button
              key={`planner-day-nav-${day.day}`}
              type="button"
              ref={(el) => {
                if (el) tabRefs.current.set(day.day, el);
                else tabRefs.current.delete(day.day);
              }}
              onClick={() => onDaySelect(day.day)}
              aria-current={isActive ? "true" : undefined}
              data-day-index={index}
              className={cn(
                "relative z-10 min-h-11 shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
                isActive
                  ? "bg-[var(--primary)]/12 text-[var(--primary)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
              )}
            >
              Day {day.day}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
