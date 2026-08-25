/**
 * CredentialReference + future CredentialStore boundary (STEP 3-3).
 * No access/refresh token plaintext. No production secret backend chosen yet.
 */

import type { CredentialFamily } from "@/lib/marketing/social/domain/capabilityStatus";
import type { SocialProvider } from "@/lib/marketing/social/domain/providers";

/**
 * Opaque handle to credential material in a future secure store.
 * Must never carry token strings.
 */
export type CredentialReference = {
  kind: "credential_reference";
  /** Opaque id understood only by CredentialStore implementations */
  storeHandle: string;
  provider: SocialProvider;
  family: CredentialFamily;
};

export type CredentialLifecycleHint = {
  expiresAt?: string | null;
  refreshSupported?: boolean;
  lastRotatedAt?: string | null;
  reauthorizationRequired?: boolean;
};

/**
 * Future secure credential backend — interface only.
 * Implementations must not log or return raw secrets to marketing domain callers
 * except through tightly scoped adapter runtime (never prompts / MCP / memory).
 */
export type CredentialStore = {
  readonly kind: "credential_store";
  /** Resolve opaque reference for adapter use only — STEP 3-3 does not implement */
  resolve?(ref: CredentialReference): Promise<never>;
  rotate?(ref: CredentialReference): Promise<CredentialReference>;
  revoke?(ref: CredentialReference): Promise<void>;
};

/** Keys that must never appear on public social domain objects. */
export const FORBIDDEN_RAW_CREDENTIAL_KEYS = [
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "clientSecret",
  "client_secret",
  "apiKey",
  "api_key",
  "apiSecret",
  "api_secret",
  "password",
  "bearer",
  "authorization",
  "idToken",
  "id_token",
  "privateKey",
  "private_key",
] as const;

const FORBIDDEN_KEY_SET = new Set<string>(
  FORBIDDEN_RAW_CREDENTIAL_KEYS.map((key) => key.toLowerCase()),
);

export function isForbiddenRawCredentialKey(key: string): boolean {
  return FORBIDDEN_KEY_SET.has(key.toLowerCase());
}

export function assertNoRawCredentialMaterial(value: unknown, path = "root"): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawCredentialMaterial(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenRawCredentialKey(key)) {
      throw new Error(`Raw credential material forbidden at ${path}.${key}`);
    }
    assertNoRawCredentialMaterial(child, `${path}.${key}`);
  }
}

export function createCredentialReference(input: {
  storeHandle: string;
  provider: SocialProvider;
  family: CredentialFamily;
}): CredentialReference {
  const handle = input.storeHandle.trim();
  if (!handle) throw new Error("CredentialReference.storeHandle is required");
  if (/token|secret|bearer|password/i.test(handle)) {
    throw new Error("CredentialReference.storeHandle must be opaque (no token-like substrings)");
  }
  const ref: CredentialReference = {
    kind: "credential_reference",
    storeHandle: handle,
    provider: input.provider,
    family: input.family,
  };
  assertNoRawCredentialMaterial(ref);
  return ref;
}

/** Documented: do not use these as production credential stores by default. */
export const DISALLOWED_DEFAULT_CREDENTIAL_STORE_TARGETS = [
  "plaintext_database_column",
  "dotenv_file",
  "hermes_config_yaml",
  "ai_memory",
  "hermes_prompt",
  "cron_output",
  "mcp_tool_response",
] as const;
