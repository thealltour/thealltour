"use client";

import { useCallback, useMemo, useState } from "react";
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
  type GolfDepartureEvent,
} from "@/lib/products/golfDepartureCalendar";

const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/thealltour-home-card/800/600";
const DEFAULT_PROMOTION_LEGEND = "특가·기획 상품 출발일";

export type GolfDepartureCalendarSectionProps = {
  events: GolfDepartureEvent[];
  promotionLegendLabel?: string | null;
  className?: string;
};

export default function GolfDepartureCalendarSection({
  events,
  promotionLegendLabel,
  className,
}: GolfDepartureCalendarSectionProps) {
  const isWide = useIsDesktop(1024);
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

  const initialSelected = departureDates[0] ?? new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(initialSelected);
  const [month, setMonth] = useState<Date>(initialSelected);

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
          {props.children}
          {showStar ? <Star className="rdp-promotion-star" aria-hidden /> : null}
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
        eyebrow="출발일 한눈에"
        title="더올투어 골프 달력"
        description="골프·파크골프 상품의 출발 가능일을 달력에서 확인하고 바로 상품으로 이동할 수 있습니다."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-start">
        <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
          <TheallDayPicker
            mode="single"
            month={month}
            onMonthChange={setMonth}
            numberOfMonths={isWide ? 2 : 1}
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
            className="theall-golf-calendar w-full"
          />
          <div className="mt-3 space-y-1.5 text-xs text-[var(--text-muted)]">
            <p className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--success)]" aria-hidden />
              출발 가능일이 있는 날짜
            </p>
            {showPromotionLegend ? (
              <p className="flex items-center gap-2">
                <Star
                  className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400"
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
                      {event.regionLabel ? (
                        <span className="mb-1.5 inline-flex max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] sm:text-[11px]">
                          {event.regionLabel}
                        </span>
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
