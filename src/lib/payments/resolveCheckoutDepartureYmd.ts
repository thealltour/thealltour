import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import { resolveDepartureScheduleYmd } from "@/lib/products/normalizeDepartureSchedules";
import type { SelectedDeparture } from "@/lib/products/buildProductInquiryPrefill";
import type { Product, ProductDepartureSchedule } from "@/types/product";

/**
 * 결제 prepare용 YYYY-MM-DD 복구.
 * 칩 label(`09.23 · 4,499,000원`)·inquiryValue·스케줄 key·상품 스케줄 순으로 시도한다.
 */
export function resolveCheckoutDepartureYmd(params: {
  selectedDeparture?: SelectedDeparture | null;
  selectedDepartureKey?: string | null;
  schedules?: ProductDepartureSchedule[] | null;
  product?: Product | null;
}): string | null {
  const departure = params.selectedDeparture;
  const schedules =
    params.schedules ??
    params.product?.departureSchedules ??
    undefined;

  const direct =
    normalizeProductDepartureDateToYmd(departure?.ymd) ||
    normalizeProductDepartureDateToYmd(departure?.inquiryValue) ||
    normalizeProductDepartureDateToYmd(departure?.label);
  if (direct) return direct;

  const key = params.selectedDepartureKey?.trim() ?? "";
  if (key) {
    const scheduleKey = key.match(/^schedule-(\d+)-(.+)$/);
    if (scheduleKey) {
      const index = Number(scheduleKey[1]);
      const tail = scheduleKey[2];
      const fromTail = normalizeProductDepartureDateToYmd(tail);
      if (fromTail) return fromTail;
      if (schedules?.[index]) {
        const fromSchedule = resolveDepartureScheduleYmd(schedules[index]);
        if (fromSchedule) return fromSchedule;
      }
    }
    const departureKey = key.match(/^departure-(?:\d+-)?(.+)$/);
    if (departureKey) {
      const fromKey = normalizeProductDepartureDateToYmd(departureKey[1]);
      if (fromKey) return fromKey;
    }
  }

  if (schedules?.length && departure) {
    for (const schedule of schedules) {
      const chip = `${schedule.label ?? ""} ${schedule.departureDate}`.trim();
      if (
        departure.label.includes(schedule.label ?? "") ||
        departure.label.includes(schedule.departureDate) ||
        departure.inquiryValue.includes(schedule.departureDate) ||
        (schedule.label && departure.inquiryValue.includes(schedule.label))
      ) {
        const ymd = resolveDepartureScheduleYmd(schedule);
        if (ymd) return ymd;
      }
      // 가격까지 붙은 칩과 비교
      if (schedule.price != null && departure.label.includes(String(schedule.price))) {
        const ymd = resolveDepartureScheduleYmd(schedule);
        if (ymd) return ymd;
      }
      void chip;
    }
  }

  return null;
}
