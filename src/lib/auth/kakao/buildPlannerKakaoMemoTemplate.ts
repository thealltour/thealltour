import { formatIsoDateDot } from "@/lib/planner/dates";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { getAppBaseUrl } from "@/lib/auth/redirect";

/** Kakao default text template: text ≤ 200 chars, button_title ≤ 20. */
const TEXT_MAX = 200;
const TITLE_LINE_MAX = 80;
const BUTTON_TITLE = "여행 플랜 보기";

export function buildPlannerOpenAbsoluteUrl(sessionId: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  return `${base}/planner/open/${encodeURIComponent(sessionId.trim())}`;
}

function truncate(value: string, max: number): string {
  const t = value.trim();
  if (t.length <= max) return t;
  if (max <= 1) return "…";
  return `${t.slice(0, max - 1)}…`;
}

function formatShortMd(ymd: string): string {
  // "2025-11-10" → "11.10"
  const parts = ymd.split("-");
  if (parts.length !== 3) return formatIsoDateDot(ymd);
  return `${parts[1]}.${parts[2]}`;
}

export function buildPlannerMemoDateLine(plan: PlannerPlan): string {
  const start = plan.tripOverview.startDate;
  const end = plan.tripOverview.endDate;
  const days = plan.tripOverview.days;
  const nights = plan.tripOverview.nights;
  if (start && end) {
    return `${formatShortMd(start)} ~ ${formatShortMd(end)}`;
  }
  if (days > 0) {
    const nightsLabel = nights > 0 ? `${nights}박 ${days}일` : `${days}일`;
    return `${nightsLabel} · 날짜 미정`;
  }
  return "날짜 미정";
}

/**
 * Builds Kakao Talk Memo default `text` template_object from persisted plan_json.
 * Never trusts client-supplied title/date strings.
 */
export function buildPlannerKakaoMemoTemplateObject(params: {
  plan: PlannerPlan;
  sessionId: string;
}): Record<string, unknown> {
  const openUrl = buildPlannerOpenAbsoluteUrl(params.sessionId);
  const title = truncate(params.plan.title || params.plan.destination.name, TITLE_LINE_MAX);
  const dateLine = buildPlannerMemoDateLine(params.plan);
  const body = [
    title,
    "",
    dateLine,
    "더올투어에서 만든 여행 플랜을 확인해 보세요.",
  ].join("\n");

  return {
    object_type: "text",
    text: truncate(body, TEXT_MAX),
    link: {
      web_url: openUrl,
      mobile_web_url: openUrl,
    },
    button_title: BUTTON_TITLE,
  };
}
