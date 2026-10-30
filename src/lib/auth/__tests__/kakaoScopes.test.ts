import { describe, expect, it } from "vitest";
import {
  resolveKakaoAuthorizationScopes,
  sanitizeKakaoAdditionalScopes,
} from "@/lib/auth/kakaoScopes";
import { scopesForOAuthAction } from "@/lib/auth/oauthAction";

describe("kakaoScopes", () => {
  it("login scopes unchanged without extras", () => {
    expect(resolveKakaoAuthorizationScopes()).toBe("name,phone_number,plusfriends");
    expect(resolveKakaoAuthorizationScopes(null)).toBe("name,phone_number,plusfriends");
  });

  it("allows talk_message and future calendar scopes", () => {
    expect(sanitizeKakaoAdditionalScopes(["talk_message"])).toEqual(["talk_message"]);
    expect(
      sanitizeKakaoAdditionalScopes(["talk_calendar", "talk_calendar_task"]),
    ).toEqual(["talk_calendar", "talk_calendar_task"]);
  });

  it("rejects arbitrary scopes", () => {
    expect(() => sanitizeKakaoAdditionalScopes(["friends"])).toThrow(/kakao_scope_not_allowed/);
  });

  it("maps planner_kakao_memo to talk_message", () => {
    expect(
      scopesForOAuthAction({
        type: "planner_kakao_memo",
        plannerSessionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual(["talk_message"]);
  });
});
