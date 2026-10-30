import { addDaysToIsoDate } from "@/lib/planner/planSchemas";
import { formatIsoDateDot, isIsoDateYmd } from "@/lib/planner/dates";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { buildPlannerOpenAbsoluteUrl } from "@/lib/auth/kakao/buildPlannerKakaoMemoTemplate";

const TITLE_MAX = 50;
const DESCRIPTION_MAX = 5000;

export type KakaoCalendarEventTime = {
  start_at: string;
  end_at: string;
  time_zone: "Asia/Seoul";
  all_day: true;
  lunar: false;
};

export type KakaoCalendarEventCreate = {
  title: string;
  time: KakaoCalendarEventTime;
  description: string;
  location?: { name: string };
};

export type PlannerKakaoCalendarCreatePayload = {
  calendar_id: "primary";
  event: KakaoCalendarEventCreate;
};

/** YYYY-MM-DD → Kakao all-day UTC midnight without local TZ shift. */
export function toKakaoAllDayUtcMidnight(ymd: string): string {
  if (!isIsoDateYmd(ymd)) {
    throw new Error("invalid_iso_date");
  }
  return `${ymd}T00:00:00Z`;
}

/**
 * Kakao all-day end is exclusive (docs sample: Oct 27 → end Oct 28).
 * Trip inclusive end date → end_at = next calendar day at 00:00:00Z.
 */
export function toKakaoAllDayExclusiveEndUtcMidnight(inclusiveEndYmd: string): string {
  return toKakaoAllDayUtcMidnight(addDaysToIsoDate(inclusiveEndYmd, 1));
}

function truncate(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  if (max <= 1) return "…";
  return `${t.slice(0, max - 1)}…`;
}

export function buildPlannerKakaoCalendarTitle(plan: PlannerPlan): string {
  const fromPlan = plan.title?.trim();
  if (fromPlan) return truncate(fromPlan, TITLE_MAX);
  const dest = plan.destination.name?.trim() || "여행";
  return truncate(`${dest} 여행`, TITLE_MAX);
}

export function buildPlannerKakaoCalendarDescription(params: {
  plan: PlannerPlan;
  sessionId: string;
  originText?: string | null;
}): string {
  const openUrl = buildPlannerOpenAbsoluteUrl(params.sessionId);
  const dest = params.plan.destination.name.trim();
  const origin = params.originText?.trim() || "";
  const routeLine = origin ? `${origin} → ${dest}` : dest;

  const start = params.plan.tripOverview.startDate;
  const end = params.plan.tripOverview.endDate;
  const dateLine =
    isIsoDateYmd(start) && isIsoDateYmd(end)
      ? `${formatIsoDateDot(start)} ~ ${formatIsoDateDot(end)}`
      : `${params.plan.tripOverview.days}일 · 날짜 미정`;

  const body = [
    routeLine,
    dateLine,
    "",
    "더올투어에서 만든 여행 플랜입니다.",
    "여행 플랜 보기:",
    openUrl,
  ].join("\n");

  return truncate(body, DESCRIPTION_MAX);
}

/**
 * Builds Kakao USER event create payload from persisted plan_json.
 * Requires fixed start/end dates. Does not trust client-supplied strings.
 */
export function buildPlannerKakaoCalendarEvent(params: {
  plan: PlannerPlan;
  sessionId: string;
  originText?: string | null;
}): PlannerKakaoCalendarCreatePayload {
  const start = params.plan.tripOverview.startDate;
  const end = params.plan.tripOverview.endDate;
  if (!isIsoDateYmd(start) || !isIsoDateYmd(end)) {
    throw new Error("missing_trip_dates");
  }

  const title = buildPlannerKakaoCalendarTitle(params.plan);
  const description = buildPlannerKakaoCalendarDescription(params);
  const destinationName = params.plan.destination.name.trim();

  return {
    calendar_id: "primary",
    event: {
      title,
      time: {
        start_at: toKakaoAllDayUtcMidnight(start),
        end_at: toKakaoAllDayExclusiveEndUtcMidnight(end),
        time_zone: "Asia/Seoul",
        all_day: true,
        lunar: false,
      },
      description,
      ...(destinationName ? { location: { name: truncate(destinationName, 100) } } : {}),
    },
  };
}
