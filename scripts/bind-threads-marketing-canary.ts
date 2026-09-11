#!/usr/bin/env npx tsx
/**
 * PUB-3 ops: bind one Threads marketing canary SocialAccount + run auth preflight.
 *
 * Usage:
 *   npx tsx scripts/bind-threads-marketing-canary.ts
 *   npx tsx scripts/bind-threads-marketing-canary.ts --skip-remote-preflight
 *
 * Never prints secret values. Never creates a Threads post.
 */

import { createRequire } from "node:module";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

async function main(): Promise<void> {
  const {
    assertThreadsCredentialMatchesAccount,
    createRuntimeEnvCredentialStore,
    createThreadsMarketingCanaryCredentialReference,
    ensureThreadsMarketingCanaryAccount,
    inspectThreadsMarketingRuntimeSecrets,
    isMarketingPublicationSideEffectAllowed,
    DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS,
    THREADS_MARKETING_CANARY_STORE_HANDLE,
    THREADS_MARKETING_RUNTIME_SECRET_ENV_NAMES,
    THREADS_OAUTH_APP_ENV_NAMES,
  } = await import("../src/lib/marketing/social");
  const { createSocialRepository } = await import(
    "../src/lib/marketing/social/repository/createSocialRepository"
  );
  const { preflightThreadsAuth } = await import("../src/lib/threads/threadsAuthPreflight");

  const skipRemote = process.argv.includes("--skip-remote-preflight");
  const secretStatus = inspectThreadsMarketingRuntimeSecrets(process.env);

  console.log(
    JSON.stringify(
      {
        phase: "env_inspection",
        runtime_location: "/home/ysh/thealltour/.env.local",
        required_runtime_names: THREADS_MARKETING_RUNTIME_SECRET_ENV_NAMES,
        oauth_app_names: THREADS_OAUTH_APP_ENV_NAMES,
        runtime_configured: secretStatus.runtimeSecretsConfigured,
        oauth_app_configured: secretStatus.oauthAppConfigured,
        missing_runtime_names: secretStatus.missingRuntimeNames,
        missing_oauth_names: secretStatus.missingOauthNames,
        store_handle: THREADS_MARKETING_CANARY_STORE_HANDLE,
      },
      null,
      2,
    ),
  );

  if (!secretStatus.runtimeSecretsConfigured) {
    console.error(
      JSON.stringify({
        phase: "stopped",
        reason: "missing_runtime_secrets",
        populate: secretStatus.missingRuntimeNames,
      }),
    );
    process.exit(2);
  }

  const threadsUserId = process.env.THREADS_USER_ID!.trim();
  const repository = await createSocialRepository({ backend: "supabase" });
  const bound = await ensureThreadsMarketingCanaryAccount(repository, {
    threadsUserId,
    displayName: process.env.THREADS_DISPLAY_NAME?.trim() || null,
  });

  const store = createRuntimeEnvCredentialStore();
  const credential = await store.resolve(createThreadsMarketingCanaryCredentialReference());
  assertThreadsCredentialMatchesAccount(credential.material, bound.account.externalIdentityId);

  let remote: Awaited<ReturnType<typeof preflightThreadsAuth>> | null = null;
  if (!skipRemote) {
    remote = await preflightThreadsAuth({
      accessToken: credential.material.accessToken,
      userId: credential.material.userId,
    });
  }

  const sideEffectStillDisabled = !isMarketingPublicationSideEffectAllowed(
    DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS,
    {
      channel: "threads",
      socialAccountId: bound.account.id,
      publicationId: "dry-run-not-a-real-publication",
    },
  );

  console.log(
    JSON.stringify(
      {
        phase: "binding_complete",
        created: bound.created,
        social_account_id: bound.account.id,
        provider: bound.account.provider,
        channel: bound.account.channel,
        external_identity_id: bound.account.externalIdentityId,
        provider_identity_id: bound.providerIdentityId,
        authorization_grant_id: bound.authorizationGrantId,
        store_handle: bound.credentialRef.storeHandle,
        credential_resolved: true,
        account_identity_match: true,
        remote_preflight_skipped: skipRemote,
        remote_auth_verified: remote?.remoteAuthVerified ?? null,
        remote_ok: remote?.ok ?? null,
        remote_error_code: remote?.errorCode ?? null,
        remote_error_message: remote?.errorMessage
          ? remote.errorMessage.replace(/[A-Za-z0-9_\-]{20,}/g, "[redacted]")
          : null,
        remote_username: remote?.username ?? null,
        side_effect_gate_disabled: sideEffectStillDisabled,
        secrets_logged: false,
      },
      null,
      2,
    ),
  );

  if (!skipRemote && remote && !remote.ok) {
    process.exit(3);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ phase: "fatal", error: message.slice(0, 400) }));
  process.exit(1);
});
