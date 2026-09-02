"use client";

import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import { HomeGolfCalendarPreview } from "@/components/home/HomeGolfCalendarPreview";

export type HomeGolfCalendarProps = {
  model: HomeGolfCalendarModel;
  className?: string;
};

/**
 * Home Golf schedule — all viewports use read-only teaser preview.
 * Interactive date selection lives on /products?tourType=golf-park only.
 */
export function HomeGolfCalendar({ model, className }: HomeGolfCalendarProps) {
  return <HomeGolfCalendarPreview model={model} className={className} />;
}
