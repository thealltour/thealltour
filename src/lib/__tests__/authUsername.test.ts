import { describe, expect, it } from "vitest";
import { buildSocialUsernameBase } from "@/lib/auth/username";

describe("buildSocialUsernameBase", () => {
  it("creates valid username pattern", () => {
    const username = buildSocialUsernameBase("google", "1234567890");
    expect(username).toMatch(/^[a-zA-Z0-9_]{4,20}$/);
    expect(username.startsWith("google_")).toBe(true);
  });

  it("handles short provider user ids", () => {
    const username = buildSocialUsernameBase("kakao", "ab");
    expect(username).toMatch(/^[a-zA-Z0-9_]{4,20}$/);
  });
});
