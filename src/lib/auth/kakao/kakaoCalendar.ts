/**
 * Server-only Kakao Talk Calendar USER event create.
 * Access token must be ephemeral — never persist or log.
 */

import type { PlannerKakaoCalendarCreatePayload } from "@/lib/auth/kakao/buildPlannerKakaoCalendarEvent";

export const KAKAO_CALENDAR_CREATE_EVENT_URL =
  "https://kapi.kakao.com/v2/api/calendar/create/event";

export const KAKAO_CALENDAR_TIMEOUT_MS = 7000;

export type KakaoCalendarFailureCode =
  | "timeout"
  | "network"
  | "unauthorized"
  | "forbidden"
  | "calendar_permission_denied"
  | "rate_limited"
  | "server_error"
  | "invalid_response"
  | "unknown";

export type KakaoCalendarCreateResult =
  | { ok: true; eventId: string }
  | { ok: false; code: KakaoCalendarFailureCode; status?: number };

function classifyHttpStatus(status: number, bodyText: string): KakaoCalendarFailureCode {
  if (status === 401) return "unauthorized";
  if (status === 403) return "calendar_permission_denied";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  // Kakao sometimes returns 400 with permission-ish codes in JSON
  const lower = bodyText.toLowerCase();
  if (
    lower.includes("permission") ||
    lower.includes("not allowed") ||
    lower.includes("권한") ||
    lower.includes("-501") ||
    lower.includes("-402")
  ) {
    return "calendar_permission_denied";
  }
  if (status === 400 || status === 404) return "invalid_response";
  return "unknown";
}

/**
 * Creates a USER event on the member's primary Talk Calendar.
 * Body: application/x-www-form-urlencoded with calendar_id + event JSON.
 */
export async function createKakaoCalendarEvent(params: {
  accessToken: string;
  payload: PlannerKakaoCalendarCreatePayload;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<KakaoCalendarCreateResult> {
  const accessToken = params.accessToken?.trim();
  if (!accessToken) {
    return { ok: false, code: "unauthorized" };
  }

  const timeoutMs = params.timeoutMs ?? KAKAO_CALENDAR_TIMEOUT_MS;
  const fetchFn = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({
      calendar_id: params.payload.calendar_id,
      event: JSON.stringify(params.payload.event),
    });

    let response: Response;
    try {
      response = await fetchFn(KAKAO_CALENDAR_CREATE_EVENT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { ok: false, code: "timeout" };
      }
      return { ok: false, code: "network" };
    }

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        ok: false,
        code: classifyHttpStatus(response.status, text),
        status: response.status,
      };
    }

    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return { ok: false, code: "invalid_response", status: response.status };
    }

    const eventId =
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as { event_id?: unknown }).event_id === "string"
        ? String((parsed as { event_id: string }).event_id).trim()
        : "";

    if (!eventId) {
      return { ok: false, code: "invalid_response", status: response.status };
    }

    return { ok: true, eventId };
  } finally {
    clearTimeout(timer);
  }
}
