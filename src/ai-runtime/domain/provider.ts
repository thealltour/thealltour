/**
 * Provider catalog entry. Secrets stay behind an opaque credentialRef
 * (same idea as marketing CredentialReference — never embed raw keys).
 */

export const PROVIDER_KINDS = [
  "gemini",
  "groq",
  "openrouter",
  "nvidia",
  "openai-compatible",
  "local",
] as const;

export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const QUOTA_SCOPES = ["project", "organization", "account", "credential", "local"] as const;

export type QuotaScope = (typeof QUOTA_SCOPES)[number];

/** Keys that must never appear on ProviderDefinition or its metadata. */
export const FORBIDDEN_PROVIDER_SECRET_KEYS = [
  "apiKey",
  "api_key",
  "token",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "clientSecret",
  "client_secret",
  "password",
  "secret",
] as const;

export interface ProviderDefinition {
  id: string;
  kind: ProviderKind;
  displayName: string;
  enabled: boolean;
  /** Opaque credential store handle / id — not a raw secret. */
  credentialRef?: string;
  quotaScope: QuotaScope;
  metadata?: Record<string, string>;
}
