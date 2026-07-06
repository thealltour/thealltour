import type { HanatourCalendarDay, HanatourCalendarPayload } from "./types";

export type ParentCalendarProductCodes = {
  saleProdCd?: string | null;
  rprsProdCd?: string | null;
  depDay?: string | null;
};

export function countParentCalendarDays(
  searchCalendar: Record<string, HanatourCalendarDay[]> | null | undefined,
): number {
  if (!searchCalendar) return 0;
  return Object.values(searchCalendar).reduce((sum, rows) => sum + (rows?.length ?? 0), 0);
}

export function normalizeParentCalendarPayload(
  searchCalendar: Record<string, HanatourCalendarDay[]> | null | undefined,
  productCodes?: ParentCalendarProductCodes,
): HanatourCalendarPayload | null {
  if (!searchCalendar || countParentCalendarDays(searchCalendar) === 0) {
    return null;
  }

  return {
    prodCode: productCodes?.rprsProdCd || productCodes?.saleProdCd || undefined,
    saleProdCd: productCodes?.saleProdCd ?? null,
    rprsProdCd: productCodes?.rprsProdCd ?? null,
    depDay: productCodes?.depDay ?? null,
    searchCalendar,
    fetchMeta: [{ source: "parent_tab", ok: true }],
  };
}
