import type { OAuthProviderAdapter, OAuthProfile, OAuthTokens } from "@/lib/auth/types";

function requiredEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Naver OAuth failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

export const naverProvider: OAuthProviderAdapter = {
  id: "naver",
  displayName: "네이버",
  isConfigured: () => Boolean(requiredEnv("NAVER_CLIENT_ID") && requiredEnv("NAVER_CLIENT_SECRET")),
  getAuthorizationUrl: ({ state, redirectUri }) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: requiredEnv("NAVER_CLIENT_ID"),
      redirect_uri: redirectUri,
      state,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  },
  exchangeCode: async (code, redirectUri, state) => {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: requiredEnv("NAVER_CLIENT_ID"),
      client_secret: requiredEnv("NAVER_CLIENT_SECRET"),
      code,
      state: state ?? "",
      redirect_uri: redirectUri,
    });
    const response = await fetch(`https://nid.naver.com/oauth2.0/token?${params.toString()}`);
    const data = await parseJsonResponse<{ access_token: string; refresh_token?: string }>(response);
    return { accessToken: data.access_token, refreshToken: data.refresh_token } satisfies OAuthTokens;
  },
  fetchProfile: async (tokens) => {
    const response = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const data = await parseJsonResponse<{
      response: {
        id: string;
        email?: string;
        name?: string;
        nickname?: string;
        profile_image?: string;
      };
    }>(response);
    const profile = data.response;
    return {
      providerUserId: String(profile.id),
      email: profile.email?.trim() || null,
      name: profile.name?.trim() || profile.nickname?.trim() || "회원",
      avatarUrl: profile.profile_image?.trim() || null,
      raw: profile as unknown as Record<string, unknown>,
    } satisfies OAuthProfile;
  },
};
