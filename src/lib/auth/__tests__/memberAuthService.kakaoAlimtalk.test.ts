import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * memberAuthService 카카오 신규가입 훅: sendKakaoSignupAlimtalk fire-and-forget.
 * supabase/연관 모듈을 스텁하고 신규 생성 경로만 검증합니다.
 */

const mocks = vi.hoisted(() => ({
  sendKakaoSignupAlimtalk: vi.fn(async () => ({ ok: true as const })),
  grantKakaoSignupWelcomePoints: vi.fn(async () => ({
    granted: true as const,
    packId: "p",
    ledgerId: "l",
  })),
  syncMemberCustomerProfiles: vi.fn(async () => undefined),
  createNewMemberNotification: vi.fn(async () => undefined),
  generateUniqueUsername: vi.fn(async () => "kakao_user_1"),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: mocks.from },
}));
vi.mock("@/lib/customerAccountLinks", () => ({
  syncMemberCustomerProfiles: mocks.syncMemberCustomerProfiles,
}));
vi.mock("@/lib/adminNotifications", () => ({
  createNewMemberNotification: mocks.createNewMemberNotification,
}));
vi.mock("@/lib/auth/username", () => ({
  generateUniqueUsername: mocks.generateUniqueUsername,
}));
vi.mock("@/lib/auth/grantKakaoSignupWelcomePoints", () => ({
  grantKakaoSignupWelcomePoints: mocks.grantKakaoSignupWelcomePoints,
}));
vi.mock("@/lib/notifications/kakaoSignupAlimtalk", () => ({
  sendKakaoSignupAlimtalk: mocks.sendKakaoSignupAlimtalk,
}));

import { handleOAuthCallback } from "@/lib/auth/memberAuthService";
import type { OAuthProfile } from "@/lib/auth/types";

const newMember = {
  id: "member-new-1",
  username: "kakao_user_1",
  name: "김신규",
  email: "new@example.com",
  phone: "01099998888",
  password_hash: null,
  password_salt: null,
  agree_terms: true,
  agree_privacy: true,
  signup_method: "social",
  profile_completed_at: null,
  kakao_channel_added: false,
};

function mockMembersTable(opts: { getById?: typeof newMember | null }) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((col: string) => {
        if (col === "id") {
          return {
            maybeSingle: vi.fn(async () => ({
              data: opts.getById ?? null,
              error: null,
            })),
          };
        }
        if (col === "phone") {
          return {
            limit: vi.fn(async () => ({ data: [], error: null })),
          };
        }
        // username / etc.
        return {
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          limit: vi.fn(async () => ({ data: [], error: null })),
        };
      }),
      ilike: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: newMember, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
  };
}

function mockProvidersTable(link: { member_id: string; id: string } | null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: link, error: null })),
        })),
      })),
    })),
    upsert: vi.fn(async () => ({ error: null })),
  };
}

describe("handleOAuthCallback kakao signup alimtalk hook", () => {
  beforeEach(() => {
    mocks.sendKakaoSignupAlimtalk.mockClear();
    mocks.grantKakaoSignupWelcomePoints.mockClear();
    mocks.from.mockReset();
  });

  it("fires sendKakaoSignupAlimtalk for new kakao member", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "member_auth_providers") return mockProvidersTable(null);
      if (table === "members") return mockMembersTable({ getById: newMember });
      throw new Error(`unexpected table ${table}`);
    });

    const profile: OAuthProfile = {
      providerUserId: "kakao-uid-1",
      email: "new@example.com",
      name: "김신규",
      phone: "01099998888",
      nickname: "김신규",
      kakaoChannelAdded: null,
      avatarUrl: null,
      raw: {},
    };

    const result = await handleOAuthCallback({
      provider: "kakao",
      profile,
      mode: "login",
      next: "/",
    });

    expect(result.type).toBe("session");
    if (result.type === "session") {
      expect(result.isNewMember).toBe(true);
    }
    expect(mocks.grantKakaoSignupWelcomePoints).toHaveBeenCalledWith("member-new-1");
    expect(mocks.sendKakaoSignupAlimtalk).toHaveBeenCalledWith({
      phone: "01099998888",
      customerName: "김신규",
    });
  });

  it("does not fire alimtalk when existing kakao link logs in", async () => {
    const existing = { ...newMember, id: "member-existing", name: "기고객", phone: "01011112222" };
    mocks.from.mockImplementation((table: string) => {
      if (table === "member_auth_providers") {
        return mockProvidersTable({ member_id: "member-existing", id: "link-1" });
      }
      if (table === "members") return mockMembersTable({ getById: existing });
      throw new Error(`unexpected table ${table}`);
    });

    const result = await handleOAuthCallback({
      provider: "kakao",
      profile: {
        providerUserId: "kakao-uid-existing",
        email: "old@example.com",
        name: "기고객",
        phone: "01011112222",
        nickname: "기고객",
        kakaoChannelAdded: null,
        avatarUrl: null,
        raw: {},
      },
      mode: "login",
      next: "/",
    });

    expect(result.type).toBe("session");
    if (result.type === "session") {
      expect(result.isNewMember).toBe(false);
    }
    expect(mocks.sendKakaoSignupAlimtalk).not.toHaveBeenCalled();
  });
});
