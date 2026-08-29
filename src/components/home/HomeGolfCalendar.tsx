"use client";

import { useEffect, useState } from "react";
import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import { HomeGolfCalendarPreview } from "@/components/home/HomeGolfCalendarPreview";
import { HomeGolfCalendarDesktop } from "@/components/home/HomeGolfCalendarDesktop";
import { cn } from "@/lib/cn";

const MD_MIN_PX = 768;

export type HomeGolfCalendarProps = {
  model: HomeGolfCalendarModel;
  className?: string;
};

type ViewportMode = "pending" | "mobile" | "desktop";

/**
 * Home responsive golf calendar — mobile preview vs desktop interactive.
 * Viewport는 mount 후 matchMedia로만 확정하여 desktop에서 mobile preview flash를 막는다.
 * pending 동안에는 양쪽 calendar tree를 mount하지 않는다.
 */
export function HomeGolfCalendar({ model, className }: HomeGolfCalendarProps) {
  const [viewport, setViewport] = useState<ViewportMode>("pending");

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MD_MIN_PX}px)`);
    const sync = () => setViewport(mql.matches ? "desktop" : "mobile");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  if (viewport === "pending") {
    return (
      <section
        className={cn("w-full px-4 sm:px-6 md:px-8", className)}
        aria-label="골프 출발 일정"
        aria-busy="true"
      >
        <div
          className={cn(
            "mx-auto max-w-[1344px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
            "min-h-[14.5rem] p-3 md:min-h-[18rem] md:p-4",
          )}
        >
          <div className="mb-2 h-4 w-28 rounded bg-[var(--surface-muted)] md:mb-4 md:h-5 md:w-36" />
          <div className="h-3 w-48 max-w-full rounded bg-[var(--surface-muted)]/80 md:h-3.5 md:w-64" />
          <div
            className="mt-4 h-[9.5rem] rounded-xl bg-[var(--surface-muted)]/50 md:mt-5 md:h-[12rem]"
            aria-hidden
          />
        </div>
      </section>
    );
  }

  if (viewport === "desktop") {
    return <HomeGolfCalendarDesktop model={model} className={className} />;
  }

  return <HomeGolfCalendarPreview model={model} className={className} />;
}
