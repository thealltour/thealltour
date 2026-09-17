import { describe, expect, it } from "vitest";
import {
  memberNeedsProfileCompletion,
  shouldWaiveKakaoSiteTerms,
} from "@/lib/auth/memberProfileGate";
import { getMyPageQuickActions } from "@/components/mypage/ui/MyPageNavIcon";
import { PLANNER_SAVED_LIST_PATH } from "@/lib/planner/memberAccountNav";
import type { MemberRowForAuth } from "@/lib/auth/types";

describe("shouldWaiveKakaoSiteTerms", () => {
  it("waives for kakao (all OAuth including non-sync)", () => {
    expect(shouldWaiveKakaoSiteTerms("kakao")).toBe(true);
  });

  it("does not waive for google or naver", () => {
    expect(shouldWaiveKakaoSiteTerms("google")).toBe(false);
    expect(shouldWaiveKakaoSiteTerms("naver")).toBe(false);
  });
});

describe("Kakao waived member profile gate", () => {
  function member(overrides: Partial<MemberRowForAuth> = {}): MemberRowForAuth {
    return {
      id: "m1",
      username: "kakao_user",
      name: "홍길동",
      email: null,
      phone: null,
      password_hash: null,
      password_salt: null,
      agree_terms: true,
      agree_privacy: true,
      signup_method: "social",
      profile_completed_at: "2026-09-17T00:00:00Z",
      kakao_channel_added: null,
      ...overrides,
    };
  }

  it("needsProfile false after Kakao terms waiver even without phone", () => {
    expect(memberNeedsProfileCompletion(member({ phone: null }))).toBe(false);
  });

  it("google-style incomplete member still needs profile", () => {
    expect(
      memberNeedsProfileCompletion(
        member({
          agree_terms: false,
          agree_privacy: false,
          profile_completed_at: null,
          phone: null,
        }),
      ),
    ).toBe(true);
  });
});

describe("getMyPageQuickActions planner entry", () => {
  it("includes 내 여행 플랜 linking to /planner/my when planner flag is on", () => {
    const actions = getMyPageQuickActions();
    const planner = actions.find((a) => a.href === PLANNER_SAVED_LIST_PATH);
    expect(planner).toBeDefined();
    expect(planner?.label).toBe("내 여행 플랜");
    expect(planner?.iconKey).toBe("planner");
  });
});
