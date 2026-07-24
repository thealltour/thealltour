import { describe, expect, it } from "vitest";
import { normalizeKakaoPhoneNumber } from "@/lib/auth/providers/kakao";

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
