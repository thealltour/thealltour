"use client";

import { useIsDesktop } from "@/hooks/useIsDesktop";
import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import { HomeGolfCalendarPreview } from "@/components/home/HomeGolfCalendarPreview";
import { HomeGolfCalendarDesktop } from "@/components/home/HomeGolfCalendarDesktop";
import { cn } from "@/lib/cn";

export type HomeGolfCalendarProps = {
  model: HomeGolfCalendarModel;
  className?: string;
};

/**
 * Home responsive golf calendar — mobile preview vs desktop interactive.
 * Only one branch mounts based on viewport (>= md desktop).
 */
export function HomeGolfCalendar({ model, className }: HomeGolfCalendarProps) {
  const isDesktop = useIsDesktop(768);

  if (isDesktop) {
    return <HomeGolfCalendarDesktop model={model} className={className} />;
  }

  return <HomeGolfCalendarPreview model={model} className={className} />;
}
