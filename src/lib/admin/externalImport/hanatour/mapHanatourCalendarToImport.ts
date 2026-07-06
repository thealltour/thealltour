import { transformCalendarData } from "@/lib/admin/externalImport/hanatour/transformCalendarData";
import type { HanatourCalendarPayload } from "@/lib/admin/externalImport/hanatour/types";
import {
  departureSchedulesToJsonColumn,
  getDepartureSchedulesMinPrice,
} from "@/lib/products/normalizeDepartureSchedules";
import type { ProductDepartureSchedule } from "@/types/product";

export type HanatourCalendarImportResult = {
  departureSchedules: ProductDepartureSchedule[] | null;
  minPrice: number | null;
};

export function mapHanatourCalendarToImport(
  payload: HanatourCalendarPayload | null | undefined,
): HanatourCalendarImportResult {
  if (!payload?.searchCalendar && !payload?.calendarData?.length) {
    return { departureSchedules: null, minPrice: null };
  }

  const schedules = transformCalendarData(payload.searchCalendar, payload.calendarData);
  const departureSchedules = departureSchedulesToJsonColumn(schedules);
  const minPrice = getDepartureSchedulesMinPrice(departureSchedules ?? undefined);

  return { departureSchedules, minPrice };
}
