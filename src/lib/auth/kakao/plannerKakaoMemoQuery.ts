/** Query param written by Kakao memo OAuth callback; consumed once by PlannerSavePanel. */
export const PLANNER_KAKAO_MEMO_QUERY = "plannerKakaoMemo";

export type PlannerKakaoMemoQueryStatus = "sent" | "failed";

export function buildPlannerKakaoMemoRedirectPath(
  sessionId: string,
  status: PlannerKakaoMemoQueryStatus,
): string {
  const id = sessionId.trim();
  const q = new URLSearchParams({ [PLANNER_KAKAO_MEMO_QUERY]: status });
  return `/planner/${encodeURIComponent(id)}?${q.toString()}`;
}

export function parsePlannerKakaoMemoQuery(
  value: string | null | undefined,
): PlannerKakaoMemoQueryStatus | null {
  if (value === "sent" || value === "failed") return value;
  return null;
}
