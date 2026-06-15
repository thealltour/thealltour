import type { OAuthProviderAdapter, OAuthProfile, OAuthTokens } from "@/lib/auth/types";

function requiredEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Kakao OAuth failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

export const kakaoProvider: OAuthProviderAdapter = {
  id: "kakao",
  displayName: "카카오",
  isConfigured: () => Boolean(requiredEnv("KAKAO_REST_API_KEY")),
  getAuthorizationUrl: ({ state, redirectUri }) => {
    const params = new URLSearchParams({
      client_id: requiredEnv("KAKAO_REST_API_KEY"),
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: "profile_nickname,account_email",
    });
    return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  },
  exchangeCode: async (code, redirectUri) => {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: requiredEnv("KAKAO_REST_API_KEY"),
      redirect_uri: redirectUri,
      code,
    });
    const clientSecret = requiredEnv("KAKAO_CLIENT_SECRET");
    if (clientSecret) body.set("client_secret", clientSecret);

    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await parseJsonResponse<{ access_token: string; refresh_token?: string }>(response);
    return { accessToken: data.access_token, refreshToken: data.refresh_token } satisfies OAuthTokens;
  },
  fetchProfile: async (tokens) => {
    const response = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });
    const data = await parseJsonResponse<{
      id: number;
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
      properties?: { nickname?: string; profile_image?: string };
    }>(response);
    const account = data.kakao_account;
    const nickname =
      account?.profile?.nickname?.trim() ||
      data.properties?.nickname?.trim() ||
      "회원";
    return {
      providerUserId: String(data.id),
      email: account?.email?.trim() || null,
      name: nickname,
      avatarUrl: account?.profile?.profile_image_url?.trim() || data.properties?.profile_image?.trim() || null,
      raw: data as unknown as Record<string, unknown>,
    } satisfies OAuthProfile;
  },
};
