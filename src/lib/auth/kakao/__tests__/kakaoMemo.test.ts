import { describe, expect, it, vi } from "vitest";
import {
  KAKAO_MEMO_DEFAULT_SEND_URL,
  sendKakaoMemoDefault,
} from "@/lib/auth/kakao/kakaoMemo";
import {
  buildPlannerKakaoMemoTemplateObject,
  buildPlannerOpenAbsoluteUrl,
} from "@/lib/auth/kakao/buildPlannerKakaoMemoTemplate";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

function minimalPlan(over: Partial<PlannerPlan> = {}): PlannerPlan {
  return {
    title: "오사카 3박 4일 여행 플랜",
    destination: { name: "오사카", country: "일본" },
    tripOverview: {
      days: 4,
      nights: 3,
      startDate: "2025-11-10",
      endDate: "2025-11-13",
      travelersSummary: "성인 2",
      styleSummary: "맛집",
    },
    days: [],
    ...over,
  } as PlannerPlan;
}

describe("sendKakaoMemoDefault", () => {
  it("posts to memo endpoint with Bearer token and form body", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const result = await sendKakaoMemoDefault({
      accessToken: "ephemeral-token",
      templateObject: { object_type: "text", text: "hi" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(KAKAO_MEMO_DEFAULT_SEND_URL);
    expect(call[1].method).toBe("POST");
    const headers = call[1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ephemeral-token");
    expect(String(call[1].body)).toContain("template_object=");
  });

  it("maps 401/403/429/5xx and timeout", async () => {
    for (const [status, code] of [
      [401, "unauthorized"],
      [403, "forbidden"],
      [429, "rate_limited"],
      [500, "server_error"],
    ] as const) {
      const fetchImpl = vi.fn(async () => new Response("err", { status }));
      const result = await sendKakaoMemoDefault({
        accessToken: "t",
        templateObject: { object_type: "text", text: "x" },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      expect(result).toEqual({ ok: false, code, status });
    }

    const abortFetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const err = new Error("aborted");
      err.name = "AbortError";
      // trigger abort via signal listener for realism
      void init;
      throw err;
    });
    const timed = await sendKakaoMemoDefault({
      accessToken: "t",
      templateObject: { object_type: "text", text: "x" },
      fetchImpl: abortFetch as unknown as typeof fetch,
      timeoutMs: 10,
    });
    expect(timed).toEqual({ ok: false, code: "timeout" });
  });
});

describe("buildPlannerKakaoMemoTemplateObject", () => {
  it("builds text template with open URL and truncated body", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://thealltour.com";
    const sessionId = "11111111-2222-4333-8444-555555555555";
    const tpl = buildPlannerKakaoMemoTemplateObject({
      plan: minimalPlan(),
      sessionId,
    });
    expect(tpl.object_type).toBe("text");
    expect(tpl.button_title).toBe("여행 플랜 보기");
    expect(String(tpl.text)).toContain("오사카");
    expect(String(tpl.text)).toContain("11.10 ~ 11.13");
    expect(String(tpl.text).length).toBeLessThanOrEqual(200);
    const link = tpl.link as { web_url: string; mobile_web_url: string };
    expect(link.web_url).toBe(buildPlannerOpenAbsoluteUrl(sessionId));
    expect(link.web_url).toContain(`/planner/open/${sessionId}`);
  });
});
