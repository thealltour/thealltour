import type { OAuthProviderAdapter, OAuthProfile, OAuthTokens } from "@/lib/auth/types";

function requiredEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OAuth request failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

export const googleProvider: OAuthProviderAdapter = {
  id: "google",
  displayName: "Google",
  isConfigured: () => Boolean(requiredEnv("GOOGLE_CLIENT_ID") && requiredEnv("GOOGLE_CLIENT_SECRET")),
  getAuthorizationUrl: ({ state, redirectUri }) => {
    const params = new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },
  exchangeCode: async (code, redirectUri) => {
    const body = new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await parseJsonResponse<{ access_token: string; refresh_token?: string; id_token?: string }>(response);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
    } satisfies OAuthTokens;
  },
  fetchProfile: async (tokens) => {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const data = await parseJsonResponse<{
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    }>(response);
    return {
      providerUserId: String(data.id),
      email: data.email?.trim() || null,
      name: data.name?.trim() || "회원",
      avatarUrl: data.picture?.trim() || null,
      raw: data as Record<string, unknown>,
    } satisfies OAuthProfile;
  },
};
