import {
  formatDepartureScheduleChipLabel,
  formatDepartureScheduleInquiryValue,
  resolveDepartureScheduleYmd,
} from "@/lib/products/normalizeDepartureSchedules";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { ProductDepartureSchedule } from "@/types/product";

export function findDepartureScheduleForYmd(
  schedules: ProductDepartureSchedule[] | undefined,
  ymd: string,
): ProductDepartureSchedule | null {
  if (!schedules?.length || !ymd) return null;
  for (const schedule of schedules) {
    const normalized = resolveDepartureScheduleYmd(schedule);
    if (normalized === ymd) return schedule;
    if (schedule.departureDate.trim() === ymd) return schedule;
  }
  return null;
}

export function buildSelectedDepartureFromYmd(params: {
  ymd: string;
  schedules?: ProductDepartureSchedule[];
  departures?: string[];
}): { departure: SelectedDeparture; key: string } | null {
  const { ymd, schedules, departures } = params;
  if (!ymd) return null;

  const schedule = findDepartureScheduleForYmd(schedules, ymd);
  if (schedule) {
    const key = `schedule-${schedule.departureDate}-${ymd}`;
    return {
      key,
      departure: {
        label: formatDepartureScheduleChipLabel(schedule),
        inquiryValue: formatDepartureScheduleInquiryValue(schedule),
        ymd,
        price: schedule.price ?? null,
      },
    };
  }

  for (const raw of departures ?? []) {
    const normalized = normalizeProductDepartureDateToYmd(raw);
    if (normalized === ymd || raw.trim() === ymd) {
      return {
        key: `departure-${ymd}`,
        departure: {
          label: raw.trim(),
          inquiryValue: raw.trim(),
          ymd,
          price: null,
        },
      };
    }
  }

  return {
    key: `departure-${ymd}`,
    departure: {
      label: ymd,
      inquiryValue: ymd,
      ymd,
      price: null,
    },
  };
}
