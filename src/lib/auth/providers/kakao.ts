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

/** 카카오 phone_number(+82 10-xxxx) → 국내 휴대폰 숫자만 (010…) */
export function normalizeKakaoPhoneNumber(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length >= 10 && digits.length <= 11) return digits;
  return null;
}

type KakaoUserMe = {
  id: number;
  kakao_account?: {
    email?: string;
    name?: string;
    phone_number?: string;
    profile?: { nickname?: string; profile_image_url?: string };
  };
  properties?: { nickname?: string; profile_image?: string };
};

type KakaoTalkChannelsResponse = {
  channels?: Array<{ relation?: string }>;
};

async function fetchKakaoChannelAdded(accessToken: string): Promise<boolean | null> {
  try {
    const response = await fetch("https://kapi.kakao.com/v1/api/talk/channels", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });
    if (!response.ok) {
      // scope/권한 미부여 등은 가입을 막지 않음
      return null;
    }
    const data = (await response.json()) as KakaoTalkChannelsResponse;
    const channels = data.channels ?? [];
    if (channels.length === 0) return false;
    return channels.some((ch) => String(ch.relation ?? "").toUpperCase() === "ADDED");
  } catch {
    return null;
  }
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
      // 카카오싱크 콘솔 필수 동의항목과 동일 — /v2/user/me·채널 API에서 수신
      scope: "profile_nickname,account_email,name,phone_number,plusfriends",
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
    const data = await parseJsonResponse<KakaoUserMe>(response);
    const account = data.kakao_account;
    const nickname =
      account?.profile?.nickname?.trim() || data.properties?.nickname?.trim() || null;
    const legalName = account?.name?.trim() || null;
    const phone = normalizeKakaoPhoneNumber(account?.phone_number);
    const kakaoChannelAdded = await fetchKakaoChannelAdded(tokens.accessToken);

    return {
      providerUserId: String(data.id),
      email: account?.email?.trim() || null,
      name: legalName || nickname || "회원",
      nickname,
      phone,
      kakaoChannelAdded,
      avatarUrl:
        account?.profile?.profile_image_url?.trim() || data.properties?.profile_image?.trim() || null,
      raw: data as unknown as Record<string, unknown>,
    } satisfies OAuthProfile;
  },
};
