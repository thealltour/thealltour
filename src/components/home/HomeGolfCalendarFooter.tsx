"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackHomeGolfScheduleClick } from "@/lib/analytics/trackHomeEvents";

type HomeGolfCalendarFooterProps = {
  href: string;
  countLabel: string;
  className?: string;
};

/** Mobile/Desktop 공통 — 전체 골프 일정 CTA */
export function HomeGolfCalendarFooter({ href, countLabel, className }: HomeGolfCalendarFooterProps) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="text-xs text-[var(--text-muted)] sm:text-sm">{countLabel}</p>
      <Link
        href={href}
        className="relative z-20 inline-flex min-h-11 items-center justify-center gap-1 self-start rounded-lg px-3 py-2 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:self-auto"
        onClick={(event) => {
          event.stopPropagation();
          trackHomeGolfScheduleClick({ href, label: "전체 골프 일정 보기" });
        }}
      >
        전체 골프 일정 보기
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
