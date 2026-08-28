"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DayButton, type DayButtonProps } from "react-day-picker";
import { CalendarDays, Star } from "lucide-react";
import { TheallDayPicker } from "@/components/ui/TheallDayPicker";
import { cn } from "@/lib/cn";
import {
  collectYearsFromYmdList,
  getKrPublicHolidayName,
} from "@/lib/calendar/krPublicHolidays";
import { dateToYmd, ymdToDate } from "@/lib/datePickerUtils";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { formatIsoDateKorean } from "@/lib/inquiry/desiredDeparture";
import { formatPriceKR } from "@/lib/pricing/calcQuote";
import type { GolfDepartureEvent, HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";
import { HomeGolfCalendarFooter } from "@/components/home/HomeGolfCalendarFooter";
import "react-day-picker/style.css";
import "@/components/ui/datePicker.css";

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/thealltour-home-card/800/600";
const MAX_EVENTS_PER_DATE = 4;
const DEFAULT_PROMOTION_LEGEND = "특가·기획 상품 출발일";

type HomeGolfCalendarDesktopProps = {
  model: HomeGolfCalendarModel;
  className?: string;
};

/**
 * Tablet/Desktop (>= md) — interactive calendar + selected-date departures.
 */
export function HomeGolfCalendarDesktop({ model, className }: HomeGolfCalendarDesktopProps) {
  const showTwoMonths = useIsDesktop(768);
  const initialDate = useMemo(
    () => ymdToDate(model.initialSelectedYmd) ?? new Date(),
    [model.initialSelectedYmd],
  );
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [month, setMonth] = useState<Date>(
    () => ymdToDate(model.initialMonthYmd) ?? initialDate,
  );

  useEffect(() => {
    setSelectedDate(initialDate);
    setMonth(ymdToDate(model.initialMonthYmd) ?? initialDate);
  }, [initialDate, model.initialMonthYmd]);

  const departureDates = useMemo(
    () =>
      model.availableYmds
        .map((ymd) => ymdToDate(ymd))
        .filter((d): d is Date => d != null),
    [model.availableYmds],
  );

  const promotionYmdSet = useMemo(() => {
    const set = new Set<string>();
    for (const [ymd, events] of Object.entries(model.eventsByDate)) {
      if (events.some((e) => e.isPromotionDeparture)) set.add(ymd);
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

  const GolfCalendarDayButton = useCallback(
    (props: DayButtonProps) => {
      const ymd = dateToYmd(props.day.date);
      const showStar = ymd ? promotionYmdSet.has(ymd) : false;
      const holidayName = ymd ? getKrPublicHolidayName(ymd) : null;
      return (
        <DayButton {...props} title={holidayName ?? props.title}>
          <span className="rdp-promotion-day">
            {showStar ? <Star className="rdp-promotion-star" aria-hidden /> : null}
            <span className="rdp-promotion-day-label">{props.children}</span>
          </span>
        </DayButton>
      );
    },
    [promotionYmdSet],
  );

  const selectedYmd = dateToYmd(selectedDate);
  const selectedEvents: GolfDepartureEvent[] = selectedYmd
    ? (model.eventsByDate[selectedYmd] ?? [])
    : [];
  const visibleEvents = selectedEvents.slice(0, MAX_EVENTS_PER_DATE);
  const hiddenCount = Math.max(0, selectedEvents.length - visibleEvents.length);

  const promotionLegend = model.promotionLegendLabel?.trim() || DEFAULT_PROMOTION_LEGEND;
  const showPromotionLegend = promotionDepartureDates.length > 0;
  const countLabel = `등록된 출발일 ${model.totalAvailableDays}일`;

  return (
    <section
      className={cn("w-full px-4 sm:px-6 md:px-8", className)}
      aria-label="골프 출발 일정"
    >
      <div className="mx-auto max-w-[1344px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-[var(--foreground)] sm:text-lg">
            골프 출발 일정
          </h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            날짜를 선택하면 해당일 출발 상품을 바로 확인할 수 있습니다
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-start lg:gap-6">
          <div className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3 sm:p-4">
            <TheallDayPicker
              mode="single"
              month={month}
              onMonthChange={setMonth}
              numberOfMonths={showTwoMonths ? 2 : 1}
              navLayout="around"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) setSelectedDate(date);
              }}
              extraHolidayYears={extraHolidayYears}
              modifiers={{
                hasDeparture: departureDates,
                hasPromotion: promotionDepartureDates,
              }}
              modifiersClassNames={{
                hasDeparture: "rdp-has-departure",
                hasPromotion: "rdp-has-promotion",
              }}
              components={{ DayButton: GolfCalendarDayButton }}
              className={cn(
                "theall-golf-calendar w-full",
                showTwoMonths && "theall-golf-calendar--two-up",
              )}
            />
            <div className="mt-2 space-y-1 text-xs text-[var(--text-muted)]">
              <p className="flex items-center gap-2">
                <span
                  className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--success)]"
                  aria-hidden
                />
                출발 일정이 있는 날짜
              </p>
              {showPromotionLegend ? (
                <p className="flex items-center gap-2">
                  <Star
                    className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400"
                    aria-hidden
                  />
                  {promotionLegend}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <CalendarDays className="h-4 w-4 text-[var(--primary)]" aria-hidden />
              {selectedYmd ? formatIsoDateKorean(selectedYmd) ?? selectedYmd : "날짜 선택"}
            </div>
            {selectedEvents.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                선택한 날짜에 출발 일정이 없습니다. 표시된 날짜를 선택해 주세요.
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {visibleEvents.map((event) => (
                    <li key={`${event.productId}-${event.date}`}>
                      <Link
                        href={event.href}
                        className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary-soft)]/30 sm:p-3"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)] sm:h-16 sm:w-16">
                          <Image
                            src={event.imageUrl?.trim() || PLACEHOLDER_IMAGE}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          {event.isPromotionDeparture || event.regionLabel ? (
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {event.isPromotionDeparture ? (
                                <span className="inline-flex max-w-full truncate rounded-full border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                                  {promotionLegend}
                                </span>
                              ) : null}
                              {event.regionLabel ? (
                                <span className="inline-flex max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                                  {event.regionLabel}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">
                            {event.title}
                          </p>
                          {typeof event.price === "number" ? (
                            <p className="mt-0.5 text-sm font-medium text-[var(--primary)]">
                              {formatPriceKR(event.price)}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 ? (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    외 {hiddenCount}개 상품 — 전체 일정에서 더 확인하세요
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        <HomeGolfCalendarFooter
          href={model.href}
          countLabel={countLabel}
          className="mt-4 border-t border-[var(--border)] pt-4"
        />
      </div>
    </section>
  );
}
