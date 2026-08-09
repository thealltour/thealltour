"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DayButton, type DayButtonProps } from "react-day-picker";
import { CalendarDays, Star } from "lucide-react";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
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
import {
  groupGolfDepartureEventsByDate,
  resolveGolfCalendarInitialDate,
  type GolfDepartureEvent,
} from "@/lib/products/golfDepartureCalendar";

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/thealltour-home-card/800/600";
const DEFAULT_PROMOTION_LEGEND = "특가·기획 상품 출발일";
const DEFAULT_EYEBROW = "출발일 한눈에";
const DEFAULT_TITLE = "더올투어 골프 달력";
const DEFAULT_DESCRIPTION =
  "골프·파크골프 상품의 출발 가능일을 달력에서 확인하고 바로 상품으로 이동할 수 있습니다.";

export type GolfDepartureCalendarSectionProps = {
  events: GolfDepartureEvent[];
  promotionLegendLabel?: string | null;
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
};

export default function GolfDepartureCalendarSection({
  events,
  promotionLegendLabel,
  eyebrow = DEFAULT_EYEBROW,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className,
}: GolfDepartureCalendarSectionProps) {
  // 카드가 아직 2열(달력+상품 리스트)로 분리되지 않는 lg(1024px) 미만 구간에서도
  // 달력 카드 자체는 이미 뷰포트 전체 폭을 차지하므로, 태블릿 가로 폭(md, 768px)부터
  // 2개월(이번 달 + 다음 달)을 나란히 보여줄 여유가 있다.
  const showTwoMonths = useIsDesktop(768);
  const eventsByDate = useMemo(() => groupGolfDepartureEventsByDate(events), [events]);
  const departureDates = useMemo(
    () =>
      Array.from(eventsByDate.keys())
        .map((date) => ymdToDate(date))
        .filter((d): d is Date => d != null),
    [eventsByDate],
  );

  const promotionYmdSet = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      if (event.isPromotionDeparture) set.add(event.date);
    }
    return set;
  }, [events]);

  const promotionDepartureDates = useMemo(
    () =>
      Array.from(promotionYmdSet)
        .map((date) => ymdToDate(date))
        .filter((d): d is Date => d != null),
    [promotionYmdSet],
  );

  const initialCalendarDate = useMemo(
    () => resolveGolfCalendarInitialDate(events.map((event) => event.date)),
    [events],
  );
  const [selectedDate, setSelectedDate] = useState<Date>(initialCalendarDate);
  const [month, setMonth] = useState<Date>(initialCalendarDate);

  useEffect(() => {
    setSelectedDate(initialCalendarDate);
    setMonth(initialCalendarDate);
  }, [initialCalendarDate]);

  const extraHolidayYears = useMemo(
    () => collectYearsFromYmdList(events.map((event) => event.date)),
    [events],
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
  const selectedEvents = selectedYmd ? eventsByDate.get(selectedYmd) ?? [] : [];
  const promotionLegend =
    promotionLegendLabel?.trim() || DEFAULT_PROMOTION_LEGEND;
  const showPromotionLegend = promotionDepartureDates.length > 0;

  if (events.length === 0) return null;

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, className)}
    >
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-start">
        <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <TheallDayPicker
            mode="single"
            month={month}
            onMonthChange={setMonth}
            numberOfMonths={showTwoMonths ? 2 : 1}
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
          <div className="mt-3 space-y-1.5 text-xs text-[var(--text-muted)]">
            <p className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--success)]" aria-hidden />
              출발 가능일이 있는 날짜
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

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <CalendarDays className="h-4 w-4 text-[var(--primary)]" aria-hidden />
            {selectedYmd ? formatIsoDateKorean(selectedYmd) ?? selectedYmd : "날짜 선택"}
          </div>
          {selectedEvents.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              선택한 날짜에 출발하는 골프 상품이 없습니다. 달력에서 표시된 날짜를 선택해 주세요.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {selectedEvents.map((event) => (
                <li key={`${event.productId}-${event.date}`}>
                  <Link
                    href={event.href}
                    className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary-soft)]/30 sm:p-4"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)]">
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
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          {event.isPromotionDeparture ? (
                            <>
                              <Star
                                className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                                aria-hidden
                              />
                              <span className="inline-flex max-w-full truncate rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 sm:text-[11px]">
                                {promotionLegend}
                              </span>
                            </>
                          ) : null}
                          {event.regionLabel ? (
                            <span className="inline-flex max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] sm:text-[11px]">
                              {event.regionLabel}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="line-clamp-2 font-semibold text-[var(--text-primary)]">
                        {event.title}
                      </p>
                      {typeof event.price === "number" ? (
                        <p className="mt-1 text-sm font-medium text-[var(--primary)]">
                          {formatPriceKR(event.price)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionBlock>
  );
}
