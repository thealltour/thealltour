export const AUTH_PROVIDER_IDS = ["google", "kakao", "naver"] as const;

export type AuthProviderId = (typeof AUTH_PROVIDER_IDS)[number];

export type AuthMode = "login" | "link";

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
};

export type OAuthProfile = {
  providerUserId: string;
  email: string | null;
  /** members.name에 저장 (실명 우선, 없으면 닉네임) */
  name: string;
  /** member_auth_providers.display_name (닉네임) */
  nickname: string | null;
  phone: string | null;
  /** 카카오톡 채널 추가 여부(plusfriends). null=미확인 */
  kakaoChannelAdded: boolean | null;
  avatarUrl: string | null;
  raw: Record<string, unknown>;
};

export type OAuthProviderAdapter = {
  id: AuthProviderId;
  displayName: string;
  isConfigured: () => boolean;
  getAuthorizationUrl: (params: { state: string; redirectUri: string }) => string;
  exchangeCode: (code: string, redirectUri: string, state?: string) => Promise<OAuthTokens>;
  fetchProfile: (tokens: OAuthTokens) => Promise<OAuthProfile>;
};

export type MemberAuthProviderRow = {
  id: string;
  member_id: string;
  provider: AuthProviderId;
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  linked_at: string;
  last_login_at: string | null;
};

export type MemberRowForAuth = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  password_hash: string | null;
  password_salt: string | null;
  agree_terms: boolean;
  agree_privacy: boolean;
  signup_method: string;
  profile_completed_at: string | null;
  kakao_channel_added?: boolean | null;
};

export type OAuthCallbackResult =
  | {
      type: "session";
      member: MemberRowForAuth;
      next: string;
      needsProfile: boolean;
      kakaoWelcomeGranted?: boolean;
      /** 이번 콜백에서 members 행이 새로 생성됨 */
      isNewMember?: boolean;
    }
  | { type: "link_account"; pendingId: string; email: string; provider: AuthProviderId };
