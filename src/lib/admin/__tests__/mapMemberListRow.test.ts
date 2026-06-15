import { describe, expect, it } from "vitest";
import {
  extractAuthProviders,
  formatMemberAuthProvidersLabel,
  mapMemberListRow,
  resolveHasLocalLogin,
} from "@/lib/admin/mapMemberListRow";

describe("mapMemberListRow", () => {
  it("maps auth providers and strips password_hash", () => {
    const item = mapMemberListRow({
      id: "1",
      username: "google_abc",
      name: "테스트",
      phone: "01012345678",
      email: "a@b.com",
      birth_date: null,
      gender: "male",
      agree_email: true,
      point_balance: 100,
      created_at: "2026-06-15T00:00:00Z",
      signup_method: "social",
      password_hash: null,
      member_auth_providers: [{ provider: "google" }, { provider: "kakao" }],
    });
    expect(item.auth_providers).toEqual(["google", "kakao"]);
    expect(item.has_local_login).toBe(false);
    expect(item.points).toBe(100);
    expect("password_hash" in item).toBe(false);
  });

  it("detects local login from password or signup_method", () => {
    expect(
      resolveHasLocalLogin({ signup_method: "local", password_hash: null } as never),
    ).toBe(true);
    expect(
      resolveHasLocalLogin({ signup_method: "mixed", password_hash: null } as never),
    ).toBe(true);
    expect(
      resolveHasLocalLogin({ signup_method: "social", password_hash: "hash" } as never),
    ).toBe(true);
  });

  it("formats connected account labels for CSV", () => {
    expect(
      formatMemberAuthProvidersLabel({
        has_local_login: true,
        auth_providers: extractAuthProviders([{ provider: "google" }]),
      }),
    ).toBe("사이트, Google");
  });
});
