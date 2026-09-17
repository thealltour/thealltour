"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type UsePlannerDayScrollSpyParams = {
  dayNumbers: number[];
  /** When true, observer updates are ignored (e.g. during programmatic scroll). */
  suppressUpdates?: boolean;
  onActiveDayChange: (dayNumber: number) => void;
};

/**
 * Observes `[data-planner-day]` sections and reports the day nearest the sticky band.
 */
export function usePlannerDayScrollSpy({
  dayNumbers,
  suppressUpdates = false,
  onActiveDayChange,
}: UsePlannerDayScrollSpyParams): void {
  const dayKey = useMemo(() => dayNumbers.join(","), [dayNumbers]);
  const suppressRef = useRef(suppressUpdates);
  const onChangeRef = useRef(onActiveDayChange);
  suppressRef.current = suppressUpdates;
  onChangeRef.current = onActiveDayChange;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") return;
    if (dayNumbers.length === 0) return;

    const ratios = new Map<number, number>();
    let frame = 0;

    const flush = () => {
      frame = 0;
      if (suppressRef.current) return;
      let bestDay: number | null = null;
      let bestRatio = 0;
      for (const day of dayNumbers) {
        const ratio = ratios.get(day) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestDay = day;
        }
      }
      if (bestDay != null && bestRatio > 0) {
        onChangeRef.current(bestDay);
      }
    };

    const scheduleFlush = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(flush);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const raw = (entry.target as HTMLElement).dataset.plannerDay;
          const day = raw ? Number(raw) : NaN;
          if (!Number.isFinite(day)) continue;
          ratios.set(day, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        scheduleFlush();
      },
      {
        root: null,
        // ≈ --planner-result-day-spy-top (7rem / 112px): result header without search + day nav
        rootMargin: "-112px 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const day of dayNumbers) {
      const el = document.getElementById(`planner-day-${day}`);
      if (el) observer.observe(el);
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // dayKey captures dayNumbers identity
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional dayKey only
  }, [dayKey]);
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}
