/**
 * 카카오싱크 어드민 기간 필터 — Asia/Seoul 기준.
 */

import type { KakaoSyncAnalyticsRange } from "@/lib/adminLandings/kakaoSyncAnalyticsModels";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function kstYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function toKstYmd(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return kstYmd(date);
}

export function parseKakaoSyncAnalyticsDateParam(v: string | null | undefined): string | null {
  if (!v || !YMD_RE.test(v)) return null;
  const d = new Date(`${v}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return v;
}

export function kstDayBoundsIso(ymd: string): { start: string; end: string } {
  return {
    start: new Date(`${ymd}T00:00:00+09:00`).toISOString(),
    end: new Date(`${ymd}T23:59:59.999+09:00`).toISOString(),
  };
}

function addKstDays(ymd: string, delta: number): string {
  const base = new Date(`${ymd}T12:00:00+09:00`);
  base.setUTCDate(base.getUTCDate() + delta);
  return kstYmd(base);
}

export type KakaoSyncAnalyticsWindow = {
  /** inclusive lower bound ISO, null = no lower bound */
  since: string | null;
  /** exclusive-ish upper bound ISO (end of last day), null = no upper */
  until: string | null;
  /** trend skeleton dates (KST YMD), empty for all */
  trendDates: string[];
};

/**
 * range + optional custom date → query window and trend dates (KST).
 * custom 이면서 date 가 없으면 오늘(KST)로 폴백.
 */
export function resolveKakaoSyncAnalyticsWindow(
  range: KakaoSyncAnalyticsRange,
  customDate?: string | null,
): KakaoSyncAnalyticsWindow {
  if (range === "all") {
    return { since: null, until: null, trendDates: [] };
  }

  if (range === "custom" || range === "1d") {
    const ymd =
      range === "custom"
        ? (parseKakaoSyncAnalyticsDateParam(customDate) ?? kstYmd())
        : kstYmd();
    const { start, end } = kstDayBoundsIso(ymd);
    return { since: start, until: end, trendDates: [ymd] };
  }

  const days = range === "7d" ? 7 : 30;
  const today = kstYmd();
  const startYmd = addKstDays(today, -(days - 1));
  const { start } = kstDayBoundsIso(startYmd);
  const { end } = kstDayBoundsIso(today);
  const trendDates: string[] = [];
  for (let i = 0; i < days; i++) {
    trendDates.push(addKstDays(startYmd, i));
  }
  return { since: start, until: end, trendDates };
}
