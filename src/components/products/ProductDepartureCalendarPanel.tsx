"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DayButton, type DayButtonProps } from "react-day-picker";
import { CalendarDays, MessageCircle, Star } from "lucide-react";
import { TheallDayPicker } from "@/components/ui/TheallDayPicker";
import { cn } from "@/lib/cn";
import {
  collectYearsFromYmdList,
  getKrPublicHolidayName,
} from "@/lib/calendar/krPublicHolidays";
import { dateToYmd, ymdToDate } from "@/lib/datePickerUtils";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { collectProductDepartureDates } from "@/lib/products/productDepartureDates";
import { buildSelectedDepartureFromYmd } from "@/lib/products/matchDepartureScheduleByYmd";
import { productHasPromotionCampaignMeta } from "@/lib/products/resolveProductBookingUx";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { Product, ProductDepartureSchedule } from "@/types/product";

export type ProductDepartureCalendarPanelProps = {
  product: Product;
  schedules?: ProductDepartureSchedule[];
  departures?: string[];
  selectedDepartureKey: string | null;
  onDepartureChange: (departure: SelectedDeparture | null, key: string | null) => void;
  onConsultClick?: () => void;
  className?: string;
  /** sticky 레일·모바일 시트용 1개월 축소 달력 */
  compact?: boolean;
};

function resolveSelectedDateFromKey(
  selectedDepartureKey: string | null,
  departureYmds: string[],
  schedules: ProductDepartureSchedule[] | undefined,
  departures: string[],
): Date | undefined {
  if (!selectedDepartureKey) return undefined;
  for (const ymd of departureYmds) {
    const built = buildSelectedDepartureFromYmd({ ymd, schedules, departures });
    if (built?.key === selectedDepartureKey) {
      return ymdToDate(ymd) ?? undefined;
    }
  }
  return undefined;
}

export function ProductDepartureCalendarPanel({
  product,
  schedules,
  departures = [],
  selectedDepartureKey,
  onDepartureChange,
  onConsultClick,
  className,
  compact = false,
}: ProductDepartureCalendarPanelProps) {
  const isWide = useIsDesktop(1024);
  const departureYmds = useMemo(() => collectProductDepartureDates(product), [product]);
  const isPromotionProduct = productHasPromotionCampaignMeta(product);

  const departureDates = useMemo(
    () =>
      departureYmds
        .map((date) => ymdToDate(date))
        .filter((d): d is Date => d != null),
    [departureYmds],
  );

  const promotionYmdSet = useMemo(() => {
    if (!isPromotionProduct) return new Set<string>();
    return new Set(departureYmds);
  }, [departureYmds, isPromotionProduct]);

  const promotionDepartureDates = useMemo(
    () =>
      Array.from(promotionYmdSet)
        .map((date) => ymdToDate(date))
        .filter((d): d is Date => d != null),
    [promotionYmdSet],
  );

  const initialMonth = departureDates[0] ?? new Date();
  const [month, setMonth] = useState<Date>(initialMonth);

  const pickerSelected = useMemo(
    () => resolveSelectedDateFromKey(selectedDepartureKey, departureYmds, schedules, departures),
    [selectedDepartureKey, departureYmds, schedules, departures],
  );

  useEffect(() => {
    if (pickerSelected) {
      setMonth(pickerSelected);
    }
  }, [pickerSelected]);

  const extraHolidayYears = useMemo(
    () => collectYearsFromYmdList(departureYmds),
    [departureYmds],
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

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      const ymd = dateToYmd(date);
      if (!ymd || !departureYmds.includes(ymd)) {
        onDepartureChange(null, null);
        return;
      }
      const built = buildSelectedDepartureFromYmd({ ymd, schedules, departures });
      if (built) {
        onDepartureChange(built.departure, built.key);
      }
    },
    [departureYmds, schedules, departures, onDepartureChange],
  );

  if (departureYmds.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center",
          className,
        )}
      >
        <CalendarDays className="mx-auto h-8 w-8 text-slate-400" aria-hidden />
        <p className="mt-3 text-sm font-medium text-slate-700">
          등록된 출발 가능일이 없습니다.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          희망 일정을 알려주시면 맞춤 일정을 안내해 드립니다.
        </p>
        {onConsultClick ? (
          <button
            type="button"
            onClick={onConsultClick}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-4 py-2 text-sm font-semibold text-[var(--primary)]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            상담 문의
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)]",
        compact ? "p-2" : "p-3 sm:p-4",
        className,
      )}
    >
      <TheallDayPicker
        mode="single"
        month={month}
        onMonthChange={setMonth}
        numberOfMonths={compact ? 1 : isWide ? 2 : 1}
        navLayout="around"
        selected={pickerSelected}
        onSelect={handleDateSelect}
        extraHolidayYears={extraHolidayYears}
        disabled={(date) => {
          const ymd = dateToYmd(date);
          return !ymd || !departureYmds.includes(ymd);
        }}
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
          "theall-golf-calendar theall-golf-calendar--product-detail w-full",
          compact && "theall-golf-calendar--compact",
        )}
      />
      <div className="mt-3 space-y-1.5 text-xs text-[var(--text-muted)]">
        <p className="flex items-center gap-2">
          <span
            className="inline-flex h-2.5 w-2.5 rounded-full bg-[var(--success)]"
            aria-hidden
          />
          출발 가능일이 있는 날짜
        </p>
        {isPromotionProduct ? (
          <p className="flex items-center gap-2">
            <Star
              className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400"
              aria-hidden
            />
            특가·기획 상품 출발일
          </p>
        ) : null}
      </div>
    </div>
  );
}
