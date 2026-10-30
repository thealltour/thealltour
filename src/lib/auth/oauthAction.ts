import type { KakaoOptionalScope } from "@/lib/auth/kakaoScopes";

/**
 * Action-specific OAuth (signed into OAuth state).
 * Implemented: planner_kakao_memo, planner_kakao_calendar.
 * Reserved (scope map only): planner_kakao_calendar_task.
 */
export const OAUTH_ACTION_TYPES = [
  "planner_kakao_memo",
  "planner_kakao_calendar",
  "planner_kakao_calendar_task",
] as const;

export type OAuthActionType = (typeof OAUTH_ACTION_TYPES)[number];

export type OAuthAction = {
  type: OAuthActionType;
  plannerSessionId: string;
};

const ACTION_TYPE_SET = new Set<string>(OAUTH_ACTION_TYPES);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPlannerSessionId(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function parseOAuthAction(raw: unknown): OAuthAction | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const type = typeof obj.type === "string" ? obj.type.trim() : "";
  const plannerSessionId =
    typeof obj.plannerSessionId === "string" ? obj.plannerSessionId.trim() : "";
  if (!ACTION_TYPE_SET.has(type)) return null;
  if (!isPlannerSessionId(plannerSessionId)) return null;
  return { type: type as OAuthActionType, plannerSessionId };
}

/** Optional Kakao scopes required for a given action. */
export function scopesForOAuthAction(action: OAuthAction | null | undefined): KakaoOptionalScope[] {
  if (!action) return [];
  switch (action.type) {
    case "planner_kakao_memo":
      return ["talk_message"];
    case "planner_kakao_calendar":
      return ["talk_calendar"];
    case "planner_kakao_calendar_task":
      return ["talk_calendar_task"];
    default:
      return [];
  }
}

export function buildPlannerKakaoMemoAction(plannerSessionId: string): OAuthAction {
  const id = plannerSessionId.trim();
  if (!isPlannerSessionId(id)) {
    throw new Error("invalid_planner_session_id");
  }
  return { type: "planner_kakao_memo", plannerSessionId: id };
}

export function buildPlannerKakaoCalendarAction(plannerSessionId: string): OAuthAction {
  const id = plannerSessionId.trim();
  if (!isPlannerSessionId(id)) {
    throw new Error("invalid_planner_session_id");
  }
  return { type: "planner_kakao_calendar", plannerSessionId: id };
}
