import { describe, expect, it, vi } from "vitest";
import {
  KAKAO_CALENDAR_CREATE_EVENT_URL,
  createKakaoCalendarEvent,
} from "@/lib/auth/kakao/kakaoCalendar";
import type { PlannerKakaoCalendarCreatePayload } from "@/lib/auth/kakao/buildPlannerKakaoCalendarEvent";

const payload: PlannerKakaoCalendarCreatePayload = {
  calendar_id: "primary",
  event: {
    title: "오사카 여행",
    time: {
      start_at: "2026-11-10T00:00:00Z",
      end_at: "2026-11-14T00:00:00Z",
      time_zone: "Asia/Seoul",
      all_day: true,
      lunar: false,
    },
    description: "desc",
  },
};

describe("createKakaoCalendarEvent", () => {
  it("posts form-urlencoded to create/event with Bearer and primary", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ event_id: "evt_123" }), { status: 200 }),
    );
    const result = await createKakaoCalendarEvent({
      accessToken: "ephemeral-token",
      payload,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, eventId: "evt_123" });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(KAKAO_CALENDAR_CREATE_EVENT_URL);
    expect(call[1].method).toBe("POST");
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ephemeral-token");
    const body = String(call[1].body);
    expect(body).toContain("calendar_id=primary");
    expect(body).toContain("event=");
    expect(decodeURIComponent(body)).toContain('"all_day":true');
  });

  it("maps 401/403/429/5xx and timeout", async () => {
    for (const [status, code] of [
      [401, "unauthorized"],
      [403, "calendar_permission_denied"],
      [429, "rate_limited"],
      [500, "server_error"],
    ] as const) {
      const fetchImpl = vi.fn(async () => new Response("err", { status }));
      const result = await createKakaoCalendarEvent({
        accessToken: "t",
        payload,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result).toEqual({ ok: false, code, status });
    }

    const abortFetch = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const timed = await createKakaoCalendarEvent({
      accessToken: "t",
      payload,
      fetchImpl: abortFetch as unknown as typeof fetch,
      timeoutMs: 10,
    });
    expect(timed).toEqual({ ok: false, code: "timeout" });
  });
});
