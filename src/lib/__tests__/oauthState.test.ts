import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createOAuthStateToken, verifyOAuthStateToken } from "@/lib/auth/oauthState";

describe("oauthState", () => {
  const originalSecret = process.env.MEMBER_SESSION_SECRET;

  beforeEach(() => {
    process.env.MEMBER_SESSION_SECRET = "test-secret-for-oauth-state-32bytes!!";
  });

  afterEach(() => {
    process.env.MEMBER_SESSION_SECRET = originalSecret;
  });

  it("round-trips signed state", () => {
    const token = createOAuthStateToken({
      provider: "google",
      mode: "login",
      next: "/mypage",
    });
    const parsed = verifyOAuthStateToken(token);
    expect(parsed?.provider).toBe("google");
    expect(parsed?.mode).toBe("login");
    expect(parsed?.next).toBe("/mypage");
  });

  it("rejects tampered token", () => {
    const token = createOAuthStateToken({
      provider: "google",
      mode: "login",
      next: "/",
    });
    const tampered = `${token}x`;
    expect(verifyOAuthStateToken(tampered)).toBeNull();
  });
});
