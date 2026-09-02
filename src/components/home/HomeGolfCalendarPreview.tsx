"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DayButton, type DayButtonProps } from "react-day-picker";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { TheallDayPicker } from "@/components/ui/TheallDayPicker";
import { cn } from "@/lib/cn";
import {
  collectYearsFromYmdList,
  getKrPublicHolidayName,
} from "@/lib/calendar/krPublicHolidays";
import { dateToYmd, ymdToDate } from "@/lib/datePickerUtils";
import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import { HomeGolfCalendarFooter } from "@/components/home/HomeGolfCalendarFooter";
import { trackHomeGolfScheduleClick } from "@/lib/analytics/trackHomeEvents";
import "react-day-picker/style.css";
import "@/components/ui/datePicker.css";

function formatMonthLabel(monthYmd: string): string {
  const date = ymdToDate(monthYmd);
  if (!date) return monthYmd;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

type HomeGolfCalendarPreviewProps = {
  model: HomeGolfCalendarModel;
  className?: string;
};

const PREVIEW_CARD_LINK_LABEL = "골프 출발 일정 미리보기";

/** Decorative month nav — visual parity with Products calendar; no interaction on Home. */
function PreviewMonthCaption({ monthLabel }: { monthLabel: string }) {
  return (
    <div className="theall-golf-calendar-preview-caption mb-1.5 flex items-center justify-between gap-2">
      <span className="theall-golf-calendar-preview-nav" aria-hidden="true">
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="flex-1 text-center text-sm font-medium text-[var(--foreground)]">
        {monthLabel}
      </span>
      <span className="theall-golf-calendar-preview-nav" aria-hidden="true">
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </span>
    </div>
  );
}

/** Vertical ellipsis — signals intentional preview truncation (not a broken calendar). */
function PreviewMoreIndicator() {
  return (
    <div className="theall-golf-calendar-preview-more" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

/**
 * Home — read-only departure calendar teaser (all viewports).
 * One-week clip + ellipsis affordance; card navigates to full Golf Calendar on Products.
 */
export function HomeGolfCalendarPreview({ model, className }: HomeGolfCalendarPreviewProps) {
  const month = useMemo(() => ymdToDate(model.initialMonthYmd) ?? new Date(), [model.initialMonthYmd]);
  const monthLabel = formatMonthLabel(model.initialMonthYmd);

  const departureDates = useMemo(
    () =>
      model.availableYmds
        .map((ymd) => ymdToDate(ymd))
        .filter((d): d is Date => d != null),
    [model.availableYmds],
  );

  const promotionYmdSet = useMemo(() => {
    const set = new Set<string>();
    for (const ymd of Object.keys(model.eventsByDate)) {
      const events = model.eventsByDate[ymd];
      if (events?.some((e) => e.isPromotionDeparture)) set.add(ymd);
    }
    return set;
  }, [model.eventsByDate]);

  const promotionDepartureDates = useMemo(
    () =>
      Array.from(promotionYmdSet)
        .map((ymd) => ymdToDate(ymd))
        .filter((d): d is Date => d != null),
    [promotionYmdSet],
  );

  const extraHolidayYears = useMemo(
    () => collectYearsFromYmdList(model.availableYmds),
    [model.availableYmds],
  );

  function PreviewDayButton(props: DayButtonProps) {
    const ymd = dateToYmd(props.day.date);
    const showStar = ymd ? promotionYmdSet.has(ymd) : false;
    const holidayName = ymd ? getKrPublicHolidayName(ymd) : null;
    return (
      <DayButton {...props} title={holidayName ?? props.title} tabIndex={-1}>
        <span className="rdp-promotion-day">
          {showStar ? <Star className="rdp-promotion-star" aria-hidden /> : null}
          <span className="rdp-promotion-day-label">{props.children}</span>
        </span>
      </DayButton>
    );
  }

  const countLabel = `등록된 출발일 ${model.monthAvailableDayCount}일`;

  return (
    <section
      className={cn("w-full px-4 sm:px-6 md:px-8", className)}
      aria-label="골프 출발 일정 미리보기"
    >
      <div className="relative mx-auto max-w-[1344px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)] sm:p-4">
        <Link
          href={model.href}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          aria-label="전체 골프 일정 보기"
          onClick={() =>
            trackHomeGolfScheduleClick({ href: model.href, label: PREVIEW_CARD_LINK_LABEL })
          }
        />

        <div className="relative z-0 pointer-events-none select-none">
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-[var(--foreground)] sm:text-base">
              골프 출발 일정
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">
              출발 일정이 등록된 날짜를 한눈에 확인하세요
            </p>
          </div>

          <PreviewMonthCaption monthLabel={monthLabel} />

          <div className="theall-golf-calendar-preview-window">
            <div aria-hidden="true">
              <TheallDayPicker
                mode="single"
                month={month}
                numberOfMonths={1}
                disableNavigation
                showOutsideDays
                fixedWeeks
                extraHolidayYears={extraHolidayYears}
                modifiers={{
                  hasDeparture: departureDates,
                  hasPromotion: promotionDepartureDates,
                }}
                modifiersClassNames={{
                  hasDeparture: "rdp-has-departure",
                  hasPromotion: "rdp-has-promotion",
                }}
                components={{ DayButton: PreviewDayButton }}
                className="theall-golf-calendar theall-golf-calendar--compact theall-golf-calendar--preview w-full"
              />
            </div>
          </div>

          <PreviewMoreIndicator />

          <p className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-muted)] sm:text-xs">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--success)]" aria-hidden />
            출발 일정이 있는 날짜
          </p>
        </div>

        <div className="relative z-20 mt-3 border-t border-[var(--border)] pt-3 pointer-events-auto">
          <HomeGolfCalendarFooter href={model.href} countLabel={countLabel} />
        </div>
      </div>
    </section>
  );
}
