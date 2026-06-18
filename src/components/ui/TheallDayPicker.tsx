"use client";

import { useCallback, useMemo } from "react";
import {
  DayPicker,
  DayButton,
  type DayButtonProps,
  type DayPickerProps,
} from "react-day-picker";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/cn";
import {
  getKrPublicHolidayDatesForYears,
  getKrPublicHolidayName,
} from "@/lib/calendar/krPublicHolidays";
import { dateToYmd } from "@/lib/datePickerUtils";

const DEFAULT_HOLIDAY_YEARS = [2025, 2026, 2027, 2028];

function HolidayDayButton(props: DayButtonProps) {
  const ymd = dateToYmd(props.day.date);
  const holidayName = ymd ? getKrPublicHolidayName(ymd) : null;
  return <DayButton {...props} title={holidayName ?? props.title} />;
}

export type TheallDayPickerProps = DayPickerProps & {
  /** 공휴일 데이터에 추가할 연도 (골프 달력 이벤트 연도 등) */
  extraHolidayYears?: number[];
};

export function TheallDayPicker({
  className,
  extraHolidayYears = [],
  modifiers,
  modifiersClassNames,
  components,
  ...rest
}: TheallDayPickerProps) {
  const holidayYears = useMemo(() => {
    const years = new Set([...DEFAULT_HOLIDAY_YEARS, ...extraHolidayYears]);
    return Array.from(years).sort((a, b) => a - b);
  }, [extraHolidayYears]);

  const krHolidayDates = useMemo(
    () => getKrPublicHolidayDatesForYears(holidayYears),
    [holidayYears],
  );

  const isSaturday = useCallback((date: Date) => date.getDay() === 6, []);
  const isSunday = useCallback((date: Date) => date.getDay() === 0, []);

  const mergedModifiers = useMemo(
    () => ({
      saturday: isSaturday,
      sunday: isSunday,
      holiday: krHolidayDates,
      ...modifiers,
    }),
    [isSaturday, isSunday, krHolidayDates, modifiers],
  );

  const mergedModifiersClassNames = useMemo(
    () => ({
      saturday: "rdp-saturday",
      sunday: "rdp-sunday",
      holiday: "rdp-holiday",
      ...modifiersClassNames,
    }),
    [modifiersClassNames],
  );

  const mergedComponents = useMemo(
    () => ({
      ...components,
      DayButton: components?.DayButton ?? HolidayDayButton,
    }),
    [components],
  );

  return (
    <DayPicker
      locale={ko}
      showOutsideDays
      className={cn("theall-day-picker theall-calendar-themed", className)}
      modifiers={mergedModifiers}
      modifiersClassNames={mergedModifiersClassNames}
      components={mergedComponents}
      {...rest}
    />
  );
}
