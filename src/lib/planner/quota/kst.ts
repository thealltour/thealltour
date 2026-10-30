import { addDaysToIsoDate } from "@/lib/planner/planSchemas";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";
import { isIsoDateYmd } from "@/lib/planner/dates";

export { formatKstBusinessDate };

/**
 * KST calendar date YYYY-MM-DD 00:00 → UTC ISO.
 * Uses fixed +09:00 offset (no DST) — Asia/Seoul.
 */
export function kstDateStartToUtcIso(ymd: string): string {
  if (!isIsoDateYmd(ymd)) {
    throw new Error("invalid_kst_date");
  }
  const [y, m, d] = ymd.split("-").map((part) => Number(part));
  return new Date(Date.UTC(y, m - 1, d) - 9 * 60 * 60 * 1000).toISOString();
}

/** Next KST midnight after `now` (start of tomorrow KST). */
export function getNextKstMidnightUtcIso(now = new Date()): string {
  const todayKst = formatKstBusinessDate(now);
  const tomorrowKst = addDaysToIsoDate(todayKst, 1);
  return kstDateStartToUtcIso(tomorrowKst);
}
