import { describe, expect, it } from "vitest";
import { memberNeedsProfileCompletion } from "@/lib/auth/memberProfileGate";
import type { MemberRowForAuth } from "@/lib/auth/types";

function baseMember(overrides: Partial<MemberRowForAuth> = {}): MemberRowForAuth {
  return {
    id: "m1",
    username: "kakao_user",
    name: "홍길동",
    email: "a@b.com",
    phone: null,
    password_hash: null,
    password_salt: null,
    agree_terms: false,
    agree_privacy: false,
    signup_method: "social",
    profile_completed_at: null,
    kakao_channel_added: null,
    ...overrides,
  };
}

describe("memberNeedsProfileCompletion", () => {
  it("requires phone and terms when both missing", () => {
    expect(memberNeedsProfileCompletion(baseMember())).toBe(true);
  });

  it("skips phone requirement when Kakao phone is already saved", () => {
    expect(
      memberNeedsProfileCompletion(
        baseMember({ phone: "01012345678", agree_terms: false, agree_privacy: false }),
      ),
    ).toBe(true);
    expect(
      memberNeedsProfileCompletion(
        baseMember({ phone: "01012345678", agree_terms: true, agree_privacy: true }),
      ),
    ).toBe(false);
  });

  it("returns false when profile_completed_at is set", () => {
    expect(
      memberNeedsProfileCompletion(
        baseMember({ profile_completed_at: "2026-07-24T00:00:00Z", phone: null }),
      ),
    ).toBe(false);
  });

  it("skips complete-profile when Kakao Sync already agreed terms and phone exists", () => {
    expect(
      memberNeedsProfileCompletion(
        baseMember({
          phone: "01012345678",
          agree_terms: true,
          agree_privacy: true,
          profile_completed_at: "2026-08-10T00:00:00Z",
        }),
      ),
    ).toBe(false);
  });

  it("skips complete-profile when Kakao Sync completed profile without phone", () => {
    expect(
      memberNeedsProfileCompletion(
        baseMember({
          phone: null,
          agree_terms: true,
          agree_privacy: true,
          profile_completed_at: "2026-08-10T00:00:00Z",
        }),
      ),
    ).toBe(false);
  });
});
