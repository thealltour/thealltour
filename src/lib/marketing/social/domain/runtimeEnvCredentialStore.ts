/**
 * Production CredentialStore backed by process env (PUB-3).
 *
 * Secrets stay in runtime env (e.g. .env.local) — never in SocialPublication,
 * CredentialReference rows, or logs. Adapters receive ResolvedAdapterCredential only.
 *
 * This is NOT "dotenv_file as CredentialReference"; the opaque storeHandle maps to
 * known env key names. Unknown handles fail closed.
 */

import type {
  CredentialReference,
  CredentialStore,
  ResolvedAdapterCredential,
} from "@/lib/marketing/social/domain/credentials";
import {
  assertNoRawCredentialMaterial,
  createCredentialReference,
} from "@/lib/marketing/social/domain/credentials";

/** Canonical opaque handle for the first Threads marketing canary account. */
export const THREADS_MARKETING_CANARY_STORE_HANDLE = "threads-mkt-canary-v1" as const;

export const THREADS_MARKETING_CANARY_STORE_KIND = "runtime_env" as const;

/** Env names required for Threads marketing adapter material (publish path). */
export const THREADS_MARKETING_RUNTIME_SECRET_ENV_NAMES = [
  "THREADS_ACCESS_TOKEN",
  "THREADS_USER_ID",
] as const;

/**
 * OAuth / Meta app configuration (not injected into adapter material).
 * Kept for operator readiness; unused by CredentialStore.resolve for publish.
 */
export const THREADS_OAUTH_APP_ENV_NAMES = ["THREADS_APP_ID", "THREADS_APP_SECRET"] as const;

export const THREADS_MARKETING_CANARY_REQUIRED_PERMISSIONS = [
  "threads_basic",
  "threads_content_publish",
] as const;

type ThreadsEnvMapping = {
  accessTokenEnv: (typeof THREADS_MARKETING_RUNTIME_SECRET_ENV_NAMES)[number];
  userIdEnv: (typeof THREADS_MARKETING_RUNTIME_SECRET_ENV_NAMES)[number];
};

const THREADS_HANDLE_ENV_MAP: Readonly<Record<string, ThreadsEnvMapping>> = {
  [THREADS_MARKETING_CANARY_STORE_HANDLE]: {
    accessTokenEnv: "THREADS_ACCESS_TOKEN",
    userIdEnv: "THREADS_USER_ID",
  },
};

export type RuntimeEnvCredentialStoreOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

function missingSecretMessage(storeHandle: string, envNames: readonly string[]): string {
  return `CredentialStore: missing runtime secrets for storeHandle=${storeHandle} (need ${envNames.join(", ")})`;
}

/**
 * Production env-backed CredentialStore.
 * Fail-closed for unknown handles / missing secrets / provider mismatch.
 */
export function createRuntimeEnvCredentialStore(
  options: RuntimeEnvCredentialStoreOptions = {},
): CredentialStore {
  const env = options.env ?? process.env;
  return {
    kind: "credential_store",
    async resolve(ref: CredentialReference): Promise<ResolvedAdapterCredential> {
      assertNoRawCredentialMaterial(ref);

      if (ref.provider !== "meta") {
        throw new Error(
          `CredentialStore: unsupported provider=${ref.provider} (production Threads canary is meta-only)`,
        );
      }

      const mapping = THREADS_HANDLE_ENV_MAP[ref.storeHandle];
      if (!mapping) {
        throw new Error(`CredentialStore: unknown storeHandle=${ref.storeHandle}`);
      }

      const accessToken = env[mapping.accessTokenEnv]?.trim() || "";
      const userId = env[mapping.userIdEnv]?.trim() || "";
      if (!accessToken || !userId) {
        throw new Error(
          missingSecretMessage(ref.storeHandle, [
            mapping.accessTokenEnv,
            mapping.userIdEnv,
          ]),
        );
      }

      return {
        kind: "adapter_credential",
        material: Object.freeze({
          accessToken,
          userId,
        }),
      };
    },
  };
}

/**
 * Create the opaque CredentialReference used by the Threads marketing canary grant.
 */
export function createThreadsMarketingCanaryCredentialReference(): CredentialReference {
  return createCredentialReference({
    storeHandle: THREADS_MARKETING_CANARY_STORE_HANDLE,
    provider: "meta",
    family: "oauth2_user",
  });
}

/**
 * Guard: resolved Threads credential must match the bound SocialAccount identity.
 */
export function assertThreadsCredentialMatchesAccount(
  material: Readonly<Record<string, string>>,
  externalIdentityId: string,
): void {
  const userId = material.userId?.trim() || "";
  const expected = externalIdentityId.trim();
  if (!userId || !expected) {
    throw new Error("Threads credential/account identity comparison requires userId and externalIdentityId");
  }
  if (userId !== expected) {
    throw new Error(
      "Threads credential userId does not match SocialAccount.externalIdentityId (cross-account denied)",
    );
  }
}

/** Presence-only check for operator reporting (never returns secret values). */
export function inspectThreadsMarketingRuntimeSecrets(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): {
  runtimeSecretsConfigured: boolean;
  oauthAppConfigured: boolean;
  missingRuntimeNames: string[];
  missingOauthNames: string[];
} {
  const missingRuntimeNames = THREADS_MARKETING_RUNTIME_SECRET_ENV_NAMES.filter(
    (name) => !(env[name]?.trim()),
  );
  const missingOauthNames = THREADS_OAUTH_APP_ENV_NAMES.filter((name) => !(env[name]?.trim()));
  return {
    runtimeSecretsConfigured: missingRuntimeNames.length === 0,
    oauthAppConfigured: missingOauthNames.length === 0,
    missingRuntimeNames: [...missingRuntimeNames],
    missingOauthNames: [...missingOauthNames],
  };
}
