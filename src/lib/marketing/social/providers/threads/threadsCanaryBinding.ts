/**
 * Bind exactly one Threads marketing canary SocialAccount (PUB-3).
 *
 * SocialAccount → ProviderIdentity → AuthorizationGrant → CredentialReference
 * Secrets remain in CredentialStore (runtime env); never written to these rows.
 */

import "server-only";

import type { SocialAccount } from "@/lib/marketing/social/domain/accounts";
import type { AuthorizationGrant } from "@/lib/marketing/social/domain/authorization";
import type { CredentialReference } from "@/lib/marketing/social/domain/credentials";
import {
  THREADS_MARKETING_CANARY_REQUIRED_PERMISSIONS,
  THREADS_MARKETING_CANARY_STORE_HANDLE,
  THREADS_MARKETING_CANARY_STORE_KIND,
  createThreadsMarketingCanaryCredentialReference,
} from "@/lib/marketing/social/domain/runtimeEnvCredentialStore";
import type { SocialRepository } from "@/lib/marketing/social/repository/contracts";

export const THREADS_PROVIDER_IDENTITY_KIND = "threads_profile" as const;

export type EnsureThreadsMarketingCanaryAccountInput = {
  /** Threads user id (public identity) — typically THREADS_USER_ID */
  threadsUserId: string;
  displayName?: string | null;
};

export type EnsureThreadsMarketingCanaryAccountResult = {
  created: boolean;
  account: SocialAccount;
  credentialRef: CredentialReference;
  grant: AuthorizationGrant;
  providerIdentityId: string;
  authorizationGrantId: string;
};

function requireThreadsUserId(value: string): string {
  const id = value.trim();
  if (!id) {
    throw new Error("threadsUserId is required to bind Threads marketing canary account");
  }
  if (!/^\d+$/.test(id)) {
    throw new Error("threadsUserId must be a numeric Threads/Meta user id");
  }
  return id;
}

/**
 * Idempotent: reuses existing meta/threads account for the same external identity.
 */
export async function ensureThreadsMarketingCanaryAccount(
  repository: SocialRepository,
  input: EnsureThreadsMarketingCanaryAccountInput,
): Promise<EnsureThreadsMarketingCanaryAccountResult> {
  const threadsUserId = requireThreadsUserId(input.threadsUserId);
  const displayName = input.displayName?.trim() || `Threads canary ${threadsUserId}`;
  const credentialRef = createThreadsMarketingCanaryCredentialReference();

  const existing = await repository.findSocialAccount({
    provider: "meta",
    channel: "threads",
    externalIdentityId: threadsUserId,
  });

  if (existing) {
    const auth = await repository.resolveAccountAuthorization(existing.id);
    if (!auth.usable) {
      throw new Error(
        `Existing Threads SocialAccount ${existing.id} is not authorization-usable: ${auth.reason}`,
      );
    }
    if (auth.resolved.credentialRef.storeHandle !== THREADS_MARKETING_CANARY_STORE_HANDLE) {
      throw new Error(
        `Existing Threads SocialAccount ${existing.id} is bound to unexpected storeHandle`,
      );
    }
    return {
      created: false,
      account: auth.resolved.account,
      credentialRef: auth.resolved.credentialRef,
      grant: auth.resolved.grant,
      providerIdentityId: auth.resolved.identity.id,
      authorizationGrantId: auth.resolved.grant.id,
    };
  }

  const identity = await repository.upsertProviderIdentity({
    provider: "meta",
    kind: THREADS_PROVIDER_IDENTITY_KIND,
    externalId: threadsUserId,
    displayName,
    channelHints: ["threads"],
  });

  const { id: credentialReferenceId, ref } = await repository.createCredentialReference({
    storeKind: THREADS_MARKETING_CANARY_STORE_KIND,
    storeHandle: credentialRef.storeHandle,
    provider: "meta",
    family: "oauth2_user",
  });

  const grant = await repository.createAuthorizationGrant({
    provider: "meta",
    credentialRef: ref,
    credentialReferenceId,
    credentialFamily: "oauth2_user",
    status: "active",
    permissions: THREADS_MARKETING_CANARY_REQUIRED_PERMISSIONS.map((code) => ({ code })),
    refreshSupported: true,
    reauthorizationRequired: false,
    providerIdentityIds: [identity.id],
  });

  await repository.bindIdentityToGrant({
    providerIdentityId: identity.id,
    authorizationGrantId: grant.id,
  });

  const account = await repository.registerSocialAccount({
    provider: "meta",
    channel: "threads",
    providerIdentityId: identity.id,
    externalIdentityId: threadsUserId,
    displayName,
    status: "connected",
    activeAuthorizationGrantId: grant.id,
  });

  return {
    created: true,
    account,
    credentialRef: ref,
    grant,
    providerIdentityId: identity.id,
    authorizationGrantId: grant.id,
  };
}
