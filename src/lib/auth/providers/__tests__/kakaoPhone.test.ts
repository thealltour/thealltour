import { describe, expect, it } from "vitest";
import { normalizeKakaoPhoneNumber, kakaoProvider } from "@/lib/auth/providers/kakao";

describe("kakaoProvider.getAuthorizationUrl scope", () => {
  it("only requests scopes enabled in Kakao Developers console", () => {
    const url = kakaoProvider.getAuthorizationUrl({
      state: "test-state",
      redirectUri: "https://example.com/callback",
    });
    const scope = new URL(url).searchParams.get("scope") ?? "";
    const requested = scope.split(",").filter(Boolean);

    // account_email·profile_nickname은 콘솔에서 "사용 안함"으로 전환됨.
    // 설정하지 않은 동의항목을 scope에 포함하면 KOE205(invalid_scope)로
    // 카카오 로그인 전체가 실패하므로, 콘솔의 "필수 동의" 항목과 항상 일치해야 한다.
    expect(requested).not.toContain("account_email");
    expect(requested).not.toContain("profile_nickname");
    expect(requested.sort()).toEqual(["name", "phone_number", "plusfriends"].sort());
  });
});

describe("normalizeKakaoPhoneNumber", () => {
  it("converts +82 international format to domestic mobile", () => {
    expect(normalizeKakaoPhoneNumber("+82 10-1234-5678")).toBe("01012345678");
    expect(normalizeKakaoPhoneNumber("+82-10-9876-5432")).toBe("01098765432");
  });

  it("keeps domestic numbers as digits", () => {
    expect(normalizeKakaoPhoneNumber("010-1234-5678")).toBe("01012345678");
    expect(normalizeKakaoPhoneNumber("01012345678")).toBe("01012345678");
  });

  it("returns null for empty or invalid", () => {
    expect(normalizeKakaoPhoneNumber(null)).toBeNull();
    expect(normalizeKakaoPhoneNumber("")).toBeNull();
    expect(normalizeKakaoPhoneNumber("123")).toBeNull();
  });
});
