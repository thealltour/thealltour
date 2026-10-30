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

  it("round-trips planner_kakao_memo action", () => {
    const plannerSessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const token = createOAuthStateToken({
      provider: "kakao",
      mode: "login",
      next: `/planner/${plannerSessionId}`,
      memberId: "ffffffff-0000-4000-8000-000000000001",
      action: { type: "planner_kakao_memo", plannerSessionId },
    });
    const parsed = verifyOAuthStateToken(token);
    expect(parsed?.action).toEqual({
      type: "planner_kakao_memo",
      plannerSessionId,
    });
    expect(parsed?.memberId).toBe("ffffffff-0000-4000-8000-000000000001");
  });

  it("rejects expired state", async () => {
    const { createHmac } = await import("node:crypto");
    const token = createOAuthStateToken({
      provider: "kakao",
      mode: "login",
      next: "/",
    });
    const [payloadBase64, signature] = token.split(".");
    const payload = JSON.parse(Buffer.from(payloadBase64!, "base64url").toString("utf8")) as {
      expiresAt: number;
    };
    payload.expiresAt = Date.now() - 1000;
    const expiredPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = createHmac("sha256", process.env.MEMBER_SESSION_SECRET!)
      .update(expiredPayload)
      .digest("base64url");
    expect(verifyOAuthStateToken(`${expiredPayload}.${sig}`)).toBeNull();
    expect(verifyOAuthStateToken(`${expiredPayload}.${signature}`)).toBeNull();
  });

  it("rejects invalid action plannerSessionId", () => {
    const token = createOAuthStateToken({
      provider: "kakao",
      mode: "login",
      next: "/",
      action: { type: "planner_kakao_memo", plannerSessionId: "not-a-uuid" },
    });
    // create still signs, but verify must reject malformed action
    expect(verifyOAuthStateToken(token)).toBeNull();
  });
});
