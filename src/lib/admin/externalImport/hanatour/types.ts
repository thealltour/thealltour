export type HanatourCalendarDay = {
  depDay: string;
  depDayNm?: string;
  adtAmt?: string;
  minAmtYn?: string;
  selected?: string;
};

export type HanatourCalendarDataRow = {
  saleProdCd?: string;
  rprsProdCd?: string;
  saleProdNm?: string;
  nrmlAmt?: number;
  adtAmt?: number;
  reserveStatus?: string;
  arrDay?: string;
  depDay?: string;
};

export type HanatourCalendarPayload = {
  prodCode?: string;
  saleProdCd?: string | null;
  rprsProdCd?: string | null;
  depDay?: string | null;
  searchCalendar?: Record<string, HanatourCalendarDay[]>;
  calendarData?: HanatourCalendarDataRow[];
  fetchMeta?: Array<{ yearMonth?: string; ok: boolean; error?: string; source?: string; reason?: string }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCalendarDay(raw: unknown): HanatourCalendarDay | null {
  if (!isRecord(raw)) return null;
  const depDay = typeof raw.depDay === "string" ? raw.depDay.trim() : "";
  if (!depDay) return null;
  return {
    depDay,
    depDayNm: typeof raw.depDayNm === "string" ? raw.depDayNm : undefined,
    adtAmt: typeof raw.adtAmt === "string" ? raw.adtAmt : undefined,
    minAmtYn: typeof raw.minAmtYn === "string" ? raw.minAmtYn : undefined,
    selected: typeof raw.selected === "string" ? raw.selected : undefined,
  };
}

function normalizeCalendarDataRow(raw: unknown): HanatourCalendarDataRow | null {
  if (!isRecord(raw)) return null;
  const depDay = typeof raw.depDay === "string" ? raw.depDay.trim() : undefined;
  const row: HanatourCalendarDataRow = {
    saleProdCd: typeof raw.saleProdCd === "string" ? raw.saleProdCd : undefined,
    rprsProdCd: typeof raw.rprsProdCd === "string" ? raw.rprsProdCd : undefined,
    saleProdNm: typeof raw.saleProdNm === "string" ? raw.saleProdNm : undefined,
    nrmlAmt: typeof raw.nrmlAmt === "number" ? raw.nrmlAmt : undefined,
    adtAmt: typeof raw.adtAmt === "number" ? raw.adtAmt : undefined,
    reserveStatus: typeof raw.reserveStatus === "string" ? raw.reserveStatus : undefined,
    depDay,
    arrDay: typeof raw.arrDay === "string" ? raw.arrDay : undefined,
  };
  if (!depDay && row.adtAmt == null) return null;
  return row;
}

export function normalizeHanatourCalendarPayload(raw: unknown): HanatourCalendarPayload | null {
  if (!isRecord(raw)) return null;

  const searchCalendar: Record<string, HanatourCalendarDay[]> = {};
  const rawSearch = raw.searchCalendar;
  if (isRecord(rawSearch)) {
    for (const [key, rows] of Object.entries(rawSearch)) {
      if (!Array.isArray(rows)) continue;
      const normalized = rows
        .map((row) => normalizeCalendarDay(row))
        .filter((row): row is HanatourCalendarDay => row !== null);
      if (normalized.length > 0) {
        searchCalendar[key] = normalized;
      }
    }
  }

  const calendarData = Array.isArray(raw.calendarData)
    ? raw.calendarData
        .map((row) => normalizeCalendarDataRow(row))
        .filter((row): row is HanatourCalendarDataRow => row !== null)
    : undefined;

  const hasSearch = Object.keys(searchCalendar).length > 0;
  const hasData = Boolean(calendarData?.length);
  if (!hasSearch && !hasData) return null;

  return {
    prodCode: typeof raw.prodCode === "string" ? raw.prodCode : undefined,
    saleProdCd: typeof raw.saleProdCd === "string" ? raw.saleProdCd : null,
    rprsProdCd: typeof raw.rprsProdCd === "string" ? raw.rprsProdCd : null,
    depDay: typeof raw.depDay === "string" ? raw.depDay : null,
    searchCalendar: hasSearch ? searchCalendar : undefined,
    calendarData,
  };
}
