import type { AuthProviderId, OAuthProviderAdapter, OAuthProfile, OAuthTokens } from "@/lib/auth/types";
import { googleProvider } from "@/lib/auth/providers/google";
import { kakaoProvider } from "@/lib/auth/providers/kakao";
import { naverProvider } from "@/lib/auth/providers/naver";

const ALL_PROVIDERS: OAuthProviderAdapter[] = [googleProvider, kakaoProvider, naverProvider];

const PROVIDER_DISPLAY_ORDER: AuthProviderId[] = ["kakao", "google", "naver"];

export function getOAuthProvider(id: string): OAuthProviderAdapter | null {
  return ALL_PROVIDERS.find((p) => p.id === id) ?? null;
}

export function getConfiguredOAuthProviders(): OAuthProviderAdapter[] {
  return ALL_PROVIDERS.filter((p) => p.isConfigured()).sort(
    (a, b) => PROVIDER_DISPLAY_ORDER.indexOf(a.id) - PROVIDER_DISPLAY_ORDER.indexOf(b.id),
  );
}

export function isAuthProviderId(value: string): value is AuthProviderId {
  return value === "google" || value === "kakao" || value === "naver";
}

export function getProviderDisplayName(id: AuthProviderId): string {
  return getOAuthProvider(id)?.displayName ?? id;
}

export type { OAuthProfile, OAuthTokens };
