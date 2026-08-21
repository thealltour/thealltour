import { parseHanatourCalendarPrice } from "@/lib/admin/externalImport/hanatour/parseHanatourWonAmount";
import type {
  HanatourCalendarDataRow,
  HanatourCalendarDay,
} from "@/lib/admin/externalImport/hanatour/types";
import type { ProductDepartureSchedule } from "@/types/product";

export function depDayToYmd(depDay: string): string | null {
  const match = depDay.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function mapHanatourReserveStatus(
  reserveStatus: string | undefined,
): ProductDepartureSchedule["status"] {
  if (!reserveStatus) return null;
  if (/마감|품절|취소|불가|매진/i.test(reserveStatus)) return "SOLD_OUT";
  if (/대기|여유|제한/i.test(reserveStatus)) return "LIMITED";
  if (/가능|예약/i.test(reserveStatus)) return "AVAILABLE";
  return null;
}

export function transformCalendarData(
  searchCalendar: Record<string, HanatourCalendarDay[]> | undefined,
  calendarData?: HanatourCalendarDataRow[],
  basePrice?: number | null,
): ProductDepartureSchedule[] {
  const dataByDepDay = new Map<string, HanatourCalendarDataRow>();
  for (const row of calendarData ?? []) {
    if (row.depDay) dataByDepDay.set(row.depDay, row);
  }

  const byDepDay = new Map<string, ProductDepartureSchedule>();

  if (searchCalendar) {
    for (const rows of Object.values(searchCalendar)) {
      if (!Array.isArray(rows)) continue;
      for (const day of rows) {
        const depDay = day.depDay?.trim();
        if (!depDay) continue;

        const departureDate = depDayToYmd(depDay);
        if (!departureDate) continue;

        const enrich = dataByDepDay.get(depDay);
        const price =
          (enrich?.adtAmt != null ? parseHanatourCalendarPrice(enrich.adtAmt, basePrice) : null) ??
          parseHanatourCalendarPrice(day.adtAmt, basePrice);

        const returnDate = enrich?.arrDay ? depDayToYmd(enrich.arrDay) : null;

        byDepDay.set(depDay, {
          departureDate,
          returnDate,
          price,
          label: day.depDayNm?.trim() || null,
          status: mapHanatourReserveStatus(enrich?.reserveStatus),
        });
      }
    }
  }

  for (const row of calendarData ?? []) {
    const depDay = row.depDay?.trim();
    if (!depDay || byDepDay.has(depDay)) continue;

    const departureDate = depDayToYmd(depDay);
    if (!departureDate) continue;

    byDepDay.set(depDay, {
      departureDate,
      returnDate: row.arrDay ? depDayToYmd(row.arrDay) : null,
      price: parseHanatourCalendarPrice(row.adtAmt, basePrice),
      label: null,
      status: mapHanatourReserveStatus(row.reserveStatus),
    });
  }

  return [...byDepDay.values()].sort((a, b) => a.departureDate.localeCompare(b.departureDate));
}
