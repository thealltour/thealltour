"use client";

import { useEffect, useState } from "react";
import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import { HomeGolfCalendarPreview } from "@/components/home/HomeGolfCalendarPreview";
import { HomeGolfCalendarDesktop } from "@/components/home/HomeGolfCalendarDesktop";
import { cn } from "@/lib/cn";

export type HomeGolfCalendarProps = {
  model: HomeGolfCalendarModel;
  className?: string;
};

type ViewportMode = "pending" | "mobile" | "desktop";

/**
 * Home Golf schedule — responsive:
 * - mobile (&lt;768): read-only teaser preview
 * - tablet/desktop (≥768): interactive calendar + selected-date products
 */
export function HomeGolfCalendar({ model, className }: HomeGolfCalendarProps) {
  const [viewport, setViewport] = useState<ViewportMode>("pending");

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const sync = () => setViewport(mql.matches ? "desktop" : "mobile");
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  if (viewport === "pending") {
    return (
      <section
        className={cn("w-full px-4 sm:px-6 md:px-8", className)}
        aria-hidden
        data-testid="home-golf-calendar-pending"
      >
        <div
          className="mx-auto min-h-[12rem] max-w-[1344px] animate-pulse rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)]/60 md:min-h-[16rem]"
        />
      </section>
    );
  }

  if (viewport === "desktop") {
    return <HomeGolfCalendarDesktop model={model} className={className} />;
  }

  return <HomeGolfCalendarPreview model={model} className={className} />;
}
