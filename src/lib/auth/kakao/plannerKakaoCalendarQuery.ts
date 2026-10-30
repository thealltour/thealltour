/** Query param written by Kakao calendar OAuth callback; consumed once by PlannerSavePanel. */
export const PLANNER_KAKAO_CALENDAR_QUERY = "plannerKakaoCalendar";

export type PlannerKakaoCalendarQueryStatus = "added" | "failed";

export function buildPlannerKakaoCalendarRedirectPath(
  sessionId: string,
  status: PlannerKakaoCalendarQueryStatus,
): string {
  const id = sessionId.trim();
  const q = new URLSearchParams({ [PLANNER_KAKAO_CALENDAR_QUERY]: status });
  return `/planner/${encodeURIComponent(id)}?${q.toString()}`;
}

export function parsePlannerKakaoCalendarQuery(
  value: string | null | undefined,
): PlannerKakaoCalendarQueryStatus | null {
  if (value === "added" || value === "failed") return value;
  return null;
}
