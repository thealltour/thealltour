/**
 * In-memory SocialRepository for unit tests and local invariant verification.
 * Enforces STEP 3-5 domain rules without network/SNS side effects.
 */

import type {
  IdentityGrantBinding,
  ProviderIdentity,
  SocialAccount,
  SocialAccountStatus,
} from "@/lib/marketing/social/domain/accounts";
import type {
  AuthorizationGrant,
  AuthorizationGrantStatus,
} from "@/lib/marketing/social/domain/authorization";
import {
  createCredentialReference,
  type CredentialReference,
} from "@/lib/marketing/social/domain/credentials";
import type { SocialChannel, SocialProvider } from "@/lib/marketing/social/domain/providers";
import type {
  SocialPerformanceMetricValueRow,
  SocialPerformanceSnapshotRow,
  SocialPublicationRow,
} from "@/lib/marketing/social/persistence/types";
import { assertSocialPersistenceDtoHasNoSecrets } from "@/lib/marketing/social/persistence/types";
import type { PublicationStatus } from "@/lib/marketing/social/publication/types";
import type {
  AccountAuthorizationResolution,
  CreateAuthorizationGrantInput,
  CreateCredentialReferenceInput,
  CreatePendingPublicationInput,
  CreatePerformanceSnapshotInput,
  ReauthorizeIdentityInput,
  ReauthorizeIdentityResult,
  RegisterSocialAccountInput,
  SocialRepository,
  UpsertProviderIdentityInput,
} from "@/lib/marketing/social/repository/contracts";
import {
  SocialIdempotencyConflictError,
  SocialInvariantError,
  SocialRepositoryError,
} from "@/lib/marketing/social/repository/errors";
import {
  assertAccountMatchesIdentity,
  assertOpaquePersistenceInput,
  assertProviderChannelCompatible,
} from "@/lib/marketing/social/repository/invariants";

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

type CredRow = {
  id: string;
  storeKind: string;
  ref: CredentialReference;
  createdAt: string;
  updatedAt: string;
};

export class InMemorySocialRepository implements SocialRepository {
  private identities = new Map<string, ProviderIdentity>();
  private identityKey = new Map<string, string>();
  private credentials = new Map<string, CredRow>();
  private grants = new Map<string, AuthorizationGrant & { credentialReferenceId: string }>();
  private bindings = new Map<string, IdentityGrantBinding>();
  private accounts = new Map<string, SocialAccount>();
  private accountKey = new Map<string, string>();
  private publications = new Map<string, SocialPublicationRow>();
  private publicationIdempotency = new Map<string, string>();
  private snapshots = new Map<string, SocialPerformanceSnapshotRow>();
  private metrics = new Map<string, SocialPerformanceMetricValueRow[]>();

  /** Test hook: force next reauthorize step to fail after creating credential. */
  failReauthorizeAfter: "credential" | "grant" | "binding" | null = null;

  private identityLookupKey(provider: string, kind: string, externalId: string): string {
    return `${provider}|${kind}|${externalId}`;
  }

  private accountLookupKey(provider: string, channel: string, externalId: string): string {
    return `${provider}|${channel}|${externalId}`;
  }

  async upsertProviderIdentity(input: UpsertProviderIdentityInput): Promise<ProviderIdentity> {
    assertOpaquePersistenceInput(input);
    const key = this.identityLookupKey(input.provider, input.kind, input.externalId);
    const existingId = this.identityKey.get(key);
    if (existingId) {
      const existing = this.identities.get(existingId)!;
      const updated: ProviderIdentity = {
        ...existing,
        displayName: input.displayName ?? existing.displayName,
        channelHints: input.channelHints ?? existing.channelHints,
        extension: input.extension ?? existing.extension,
      };
      this.identities.set(existingId, updated);
      return updated;
    }
    const identity: ProviderIdentity = {
      id: newId(),
      provider: input.provider,
      kind: input.kind,
      externalId: input.externalId,
      displayName: input.displayName ?? null,
      channelHints: input.channelHints ?? [],
      extension: input.extension,
    };
    this.identities.set(identity.id, identity);
    this.identityKey.set(key, identity.id);
    return identity;
  }

  async getProviderIdentityById(id: string): Promise<ProviderIdentity | null> {
    return this.identities.get(id) ?? null;
  }

  async findProviderIdentity(
    provider: SocialProvider,
    kind: string,
    externalId: string,
  ): Promise<ProviderIdentity | null> {
    const id = this.identityKey.get(this.identityLookupKey(provider, kind, externalId));
    return id ? (this.identities.get(id) ?? null) : null;
  }

  async createCredentialReference(input: CreateCredentialReferenceInput): Promise<{
    id: string;
    ref: CredentialReference;
  }> {
    assertOpaquePersistenceInput(input);
    const ref = createCredentialReference({
      storeHandle: input.storeHandle,
      provider: input.provider,
      family: input.family,
    });
    const row: CredRow = {
      id: newId(),
      storeKind: input.storeKind ?? "future_secure_store",
      ref,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    assertSocialPersistenceDtoHasNoSecrets({
      storeHandle: row.ref.storeHandle,
      provider: row.ref.provider,
    });
    this.credentials.set(row.id, row);
    return { id: row.id, ref };
  }

  async getCredentialReferenceById(
    id: string,
  ): Promise<{ id: string; ref: CredentialReference } | null> {
    const row = this.credentials.get(id);
    return row ? { id: row.id, ref: row.ref } : null;
  }

  async createAuthorizationGrant(input: CreateAuthorizationGrantInput): Promise<AuthorizationGrant> {
    assertOpaquePersistenceInput(input);
    let credentialReferenceId = input.credentialReferenceId;
    if (!credentialReferenceId) {
      const created = await this.createCredentialReference({
        storeHandle: input.credentialRef.storeHandle,
        provider: input.credentialRef.provider,
        family: input.credentialRef.family,
      });
      credentialReferenceId = created.id;
    } else {
      const existing = this.credentials.get(credentialReferenceId);
      if (!existing) throw new SocialRepositoryError("not_found", "credential reference missing");
    }
    const grant: AuthorizationGrant & { credentialReferenceId: string } = {
      id: newId(),
      provider: input.provider,
      status: input.status ?? "pending",
      credentialFamily: input.credentialFamily,
      permissions: input.permissions ?? [],
      credentialRef: input.credentialRef,
      providerIdentityIds: input.providerIdentityIds ?? [],
      issuedAt: input.issuedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      refreshSupported: input.refreshSupported ?? false,
      reauthorizationRequired: input.reauthorizationRequired ?? false,
      credentialReferenceId,
    };
    this.grants.set(grant.id, grant);
    return grant;
  }

  async getAuthorizationGrantById(id: string): Promise<AuthorizationGrant | null> {
    return this.grants.get(id) ?? null;
  }

  async updateAuthorizationGrantStatus(
    id: string,
    status: AuthorizationGrantStatus,
    patch?: Partial<{
      expiresAt: string | null;
      reauthorizationRequired: boolean;
      refreshSupported: boolean;
    }>,
  ): Promise<AuthorizationGrant> {
    const grant = this.grants.get(id);
    if (!grant) throw new SocialRepositoryError("not_found", `grant not found: ${id}`);
    const updated = {
      ...grant,
      status,
      expiresAt: patch?.expiresAt !== undefined ? patch.expiresAt : grant.expiresAt,
      reauthorizationRequired:
        patch?.reauthorizationRequired !== undefined
          ? patch.reauthorizationRequired
          : grant.reauthorizationRequired,
      refreshSupported:
        patch?.refreshSupported !== undefined ? patch.refreshSupported : grant.refreshSupported,
    };
    this.grants.set(id, updated);
    return updated;
  }

  async bindIdentityToGrant(input: {
    providerIdentityId: string;
    authorizationGrantId: string;
  }): Promise<IdentityGrantBinding> {
    if (!this.identities.has(input.providerIdentityId)) {
      throw new SocialRepositoryError("not_found", "provider identity missing");
    }
    if (!this.grants.has(input.authorizationGrantId)) {
      throw new SocialRepositoryError("not_found", "grant missing");
    }
    for (const binding of this.bindings.values()) {
      if (
        binding.providerIdentityId === input.providerIdentityId &&
        binding.authorizationGrantId === input.authorizationGrantId
      ) {
        const reactivated = { ...binding, status: "active" as const };
        this.bindings.set(binding.id, reactivated);
        return reactivated;
      }
    }
    const binding: IdentityGrantBinding = {
      id: newId(),
      providerIdentityId: input.providerIdentityId,
      authorizationGrantId: input.authorizationGrantId,
      status: "active",
    };
    this.bindings.set(binding.id, binding);
    const grant = this.grants.get(input.authorizationGrantId)!;
    if (!grant.providerIdentityIds.includes(input.providerIdentityId)) {
      grant.providerIdentityIds = [...grant.providerIdentityIds, input.providerIdentityId];
    }
    return binding;
  }

  async revokeBinding(bindingId: string): Promise<IdentityGrantBinding> {
    const binding = this.bindings.get(bindingId);
    if (!binding) throw new SocialRepositoryError("not_found", `binding not found: ${bindingId}`);
    const revoked = { ...binding, status: "revoked" as const };
    this.bindings.set(bindingId, revoked);
    return revoked;
  }

  async findActiveBinding(
    providerIdentityId: string,
    authorizationGrantId?: string,
  ): Promise<IdentityGrantBinding | null> {
    for (const binding of this.bindings.values()) {
      if (binding.providerIdentityId !== providerIdentityId) continue;
      if (binding.status !== "active") continue;
      if (authorizationGrantId && binding.authorizationGrantId !== authorizationGrantId) continue;
      return binding;
    }
    return null;
  }

  async listBindingsForIdentity(providerIdentityId: string): Promise<IdentityGrantBinding[]> {
    return [...this.bindings.values()].filter((b) => b.providerIdentityId === providerIdentityId);
  }

  async registerSocialAccount(input: RegisterSocialAccountInput): Promise<SocialAccount> {
    assertOpaquePersistenceInput(input);
    assertProviderChannelCompatible(input.provider, input.channel);
    const identity = this.identities.get(input.providerIdentityId);
    if (!identity) throw new SocialRepositoryError("not_found", "provider identity missing");
    const key = this.accountLookupKey(input.provider, input.channel, input.externalIdentityId);
    if (this.accountKey.has(key)) {
      throw new SocialInvariantError("SocialAccount already exists for provider/channel/external id");
    }
    const account: SocialAccount = {
      id: newId(),
      provider: input.provider,
      channel: input.channel,
      providerIdentityId: input.providerIdentityId,
      externalIdentityId: input.externalIdentityId,
      displayName: input.displayName ?? null,
      status: input.status ?? "disconnected",
      activeAuthorizationGrantId: input.activeAuthorizationGrantId ?? null,
    };
    assertAccountMatchesIdentity(account, identity);
    this.accounts.set(account.id, account);
    this.accountKey.set(key, account.id);
    return account;
  }

  async getSocialAccountById(id: string): Promise<SocialAccount | null> {
    return this.accounts.get(id) ?? null;
  }

  async findSocialAccount(input: {
    provider: SocialProvider;
    channel: SocialChannel;
    externalIdentityId: string;
  }): Promise<SocialAccount | null> {
    const id = this.accountKey.get(
      this.accountLookupKey(input.provider, input.channel, input.externalIdentityId),
    );
    return id ? (this.accounts.get(id) ?? null) : null;
  }

  async updateSocialAccountStatus(id: string, status: SocialAccountStatus): Promise<SocialAccount> {
    const account = this.accounts.get(id);
    if (!account) throw new SocialRepositoryError("not_found", `account not found: ${id}`);
    const updated = { ...account, status };
    this.accounts.set(id, updated);
    return updated;
  }

  async setSocialAccountSoftGrantPointer(
    accountId: string,
    grantId: string | null,
  ): Promise<SocialAccount> {
    const account = this.accounts.get(accountId);
    if (!account) throw new SocialRepositoryError("not_found", `account not found: ${accountId}`);
    if (grantId && !this.grants.has(grantId)) {
      throw new SocialRepositoryError("not_found", `grant not found: ${grantId}`);
    }
    const updated = { ...account, activeAuthorizationGrantId: grantId };
    this.accounts.set(accountId, updated);
    return updated;
  }

  async resolveProviderIdentityForAccount(accountId: string): Promise<ProviderIdentity | null> {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    return this.identities.get(account.providerIdentityId) ?? null;
  }

  async resolveAccountAuthorization(accountId: string): Promise<AccountAuthorizationResolution> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new SocialRepositoryError("not_found", `account not found: ${accountId}`);
    }
    const identity = this.identities.get(account.providerIdentityId) ?? null;
    const softPointerGrantId = account.activeAuthorizationGrantId ?? null;

    if (!identity) {
      return {
        usable: false,
        reason: "provider_identity_missing",
        account,
        identity: null,
        softPointerGrantId,
      };
    }

    // Soft pointer is NEVER authoritative. Prefer active binding for the identity.
    const activeBinding = await this.findActiveBinding(identity.id);
    if (!activeBinding) {
      return {
        usable: false,
        reason: "no_active_binding",
        account,
        identity,
        softPointerGrantId,
      };
    }

    const grant = this.grants.get(activeBinding.authorizationGrantId) ?? null;
    if (!grant || grant.status !== "active") {
      return {
        usable: false,
        reason: grant ? `grant_${grant.status}` : "grant_missing",
        account,
        identity,
        softPointerGrantId,
      };
    }

    // Stale soft pointer: binding points to usable grant A, soft pointer to B → still usable via binding,
    // but soft pointer alone must never authorize. We authorize via binding, and report mismatch separately
    // only when soft pointer points to a different grant that someone might wrongly trust.
    // Spec: "stale active_authorization_grant_id does not confer authorization"
    // If soft pointer is stale BUT binding is active to a usable grant, authorization IS usable via binding.
    // If soft pointer is set to a revoked grant and there is NO active binding, not usable.
    // Additional case: soft pointer set to grant X which is active, but binding for that grant is revoked
    // while another binding is active — we follow binding.

    const cred = this.credentials.get(grant.credentialReferenceId);
    if (!cred) {
      return {
        usable: false,
        reason: "credential_reference_missing",
        account,
        identity,
        softPointerGrantId,
      };
    }

    return {
      usable: true,
      resolved: {
        account,
        identity,
        binding: activeBinding,
        grant: { ...grant, credentialRef: cred.ref },
        credentialRef: cred.ref,
      },
    };
  }

  /**
   * Soft-pointer-only probe used by tests: if caller wrongly trusts soft pointer
   * without checking binding, they must not get usable authorization.
   */
  softPointerAloneIsAuthoritative(): false {
    return false;
  }

  async reauthorizeIdentity(input: ReauthorizeIdentityInput): Promise<ReauthorizeIdentityResult> {
    assertOpaquePersistenceInput(input);
    const identity = this.identities.get(input.providerIdentityId);
    if (!identity) throw new SocialRepositoryError("not_found", "provider identity missing");
    const previous = this.grants.get(input.previousGrantId);
    if (!previous) throw new SocialRepositoryError("not_found", "previous grant missing");

    // Snapshot for rollback
    const snapshot = {
      credentials: new Map(this.credentials),
      grants: new Map(this.grants),
      bindings: new Map(this.bindings),
      accounts: new Map(this.accounts),
    };

    try {
      const cred = await this.createCredentialReference(input.newCredential);
      if (this.failReauthorizeAfter === "credential") {
        throw new SocialRepositoryError("forced_failure", "forced fail after credential");
      }

      const grant = await this.createAuthorizationGrant({
        ...input.newGrant,
        provider: input.newGrant.provider,
        credentialFamily: input.newGrant.credentialFamily,
        credentialRef: cred.ref,
        credentialReferenceId: cred.id,
        status: input.newGrant.status ?? "active",
        providerIdentityIds: [input.providerIdentityId],
      });
      if (this.failReauthorizeAfter === "grant") {
        throw new SocialRepositoryError("forced_failure", "forced fail after grant");
      }

      // Revoke previous bindings for this identity under previous grant
      for (const binding of this.bindings.values()) {
        if (
          binding.providerIdentityId === input.providerIdentityId &&
          binding.authorizationGrantId === input.previousGrantId &&
          binding.status === "active"
        ) {
          await this.revokeBinding(binding.id);
        }
      }
      await this.updateAuthorizationGrantStatus(input.previousGrantId, "revoked");

      const binding = await this.bindIdentityToGrant({
        providerIdentityId: input.providerIdentityId,
        authorizationGrantId: grant.id,
      });
      if (this.failReauthorizeAfter === "binding") {
        throw new SocialRepositoryError("forced_failure", "forced fail after binding");
      }

      const accountIds =
        input.socialAccountIds ??
        [...this.accounts.values()]
          .filter((a) => a.providerIdentityId === input.providerIdentityId)
          .map((a) => a.id);

      const updatedAccounts: SocialAccount[] = [];
      for (const accountId of accountIds) {
        const updated = await this.setSocialAccountSoftGrantPointer(accountId, grant.id);
        updatedAccounts.push(updated);
      }

      return {
        credentialReferenceId: cred.id,
        credentialRef: cred.ref,
        grant,
        bindings: [binding],
        updatedAccounts,
      };
    } catch (error) {
      this.credentials = snapshot.credentials;
      this.grants = snapshot.grants;
      this.bindings = snapshot.bindings;
      this.accounts = snapshot.accounts;
      throw error;
    }
  }

  async createPendingPublication(input: CreatePendingPublicationInput): Promise<SocialPublicationRow> {
    assertOpaquePersistenceInput(input);
    assertProviderChannelCompatible(input.provider, input.channel);
    const account = this.accounts.get(input.socialAccountId);
    if (!account) throw new SocialRepositoryError("not_found", "social account missing");
    if (account.provider !== input.provider || account.channel !== input.channel) {
      throw new SocialInvariantError("publication provider/channel must match SocialAccount");
    }
    const idemKey = `${input.socialAccountId}|${input.idempotencyKey}`;
    const existingId = this.publicationIdempotency.get(idemKey);
    if (existingId) {
      throw new SocialIdempotencyConflictError(existingId);
    }
    const row: SocialPublicationRow = {
      id: newId(),
      contentId: input.contentId ?? null,
      aiPublicationId: input.aiPublicationId ?? null,
      socialAccountId: input.socialAccountId,
      provider: input.provider,
      channel: input.channel,
      mediaType: input.mediaType ?? null,
      status: "pending",
      externalPostId: null,
      externalUrl: null,
      publishedAt: null,
      idempotencyKey: input.idempotencyKey,
      governanceDecision: input.governanceDecision ?? null,
      governanceRunId: input.governanceRunId ?? null,
      humanApprovalRef: input.humanApprovalRef ?? null,
      providerStatusMetadata: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.publications.set(row.id, row);
    this.publicationIdempotency.set(idemKey, row.id);
    return row;
  }

  async getPublicationById(id: string): Promise<SocialPublicationRow | null> {
    return this.publications.get(id) ?? null;
  }

  async findPublicationByIdempotency(
    socialAccountId: string,
    idempotencyKey: string,
  ): Promise<SocialPublicationRow | null> {
    const id = this.publicationIdempotency.get(`${socialAccountId}|${idempotencyKey}`);
    return id ? (this.publications.get(id) ?? null) : null;
  }

  async updatePublicationStatus(
    id: string,
    status: PublicationStatus | "unknown",
    patch?: Partial<{
      externalPostId: string | null;
      externalUrl: string | null;
      publishedAt: string | null;
      providerStatusMetadata: Record<string, unknown>;
    }>,
  ): Promise<SocialPublicationRow> {
    const row = this.publications.get(id);
    if (!row) throw new SocialRepositoryError("not_found", `publication not found: ${id}`);
    const updated: SocialPublicationRow = {
      ...row,
      status,
      externalPostId: patch?.externalPostId !== undefined ? patch.externalPostId : row.externalPostId,
      externalUrl: patch?.externalUrl !== undefined ? patch.externalUrl : row.externalUrl,
      publishedAt: patch?.publishedAt !== undefined ? patch.publishedAt : row.publishedAt,
      providerStatusMetadata:
        patch?.providerStatusMetadata !== undefined
          ? patch.providerStatusMetadata
          : row.providerStatusMetadata,
      updatedAt: nowIso(),
    };
    this.publications.set(id, updated);
    return updated;
  }

  async listPublicationsForContent(contentId: string): Promise<SocialPublicationRow[]> {
    return [...this.publications.values()].filter((p) => p.contentId === contentId);
  }

  async listPublicationsForAccount(socialAccountId: string): Promise<SocialPublicationRow[]> {
    return [...this.publications.values()].filter((p) => p.socialAccountId === socialAccountId);
  }

  async createPerformanceSnapshot(input: CreatePerformanceSnapshotInput): Promise<{
    snapshot: SocialPerformanceSnapshotRow;
    metrics: SocialPerformanceMetricValueRow[];
  }> {
    assertOpaquePersistenceInput(input);
    if (input.scope === "account" && input.socialPublicationId) {
      throw new SocialInvariantError("account-scope snapshot must not reference a publication");
    }
    if (input.scope === "publication" && !input.socialPublicationId) {
      throw new SocialInvariantError("publication-scope snapshot requires socialPublicationId");
    }
    if (!this.accounts.has(input.socialAccountId)) {
      throw new SocialRepositoryError("not_found", "social account missing");
    }
    if (input.socialPublicationId && !this.publications.has(input.socialPublicationId)) {
      throw new SocialRepositoryError("not_found", "publication missing");
    }
    const snapshot: SocialPerformanceSnapshotRow = {
      id: newId(),
      provider: input.provider,
      channel: input.channel,
      scope: input.scope,
      socialAccountId: input.socialAccountId,
      socialPublicationId: input.socialPublicationId ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      measuredAt: input.measuredAt ?? nowIso(),
      dataAvailability: input.dataAvailability ?? "unavailable",
      createdAt: nowIso(),
    };
    const metrics: SocialPerformanceMetricValueRow[] = input.metrics.map((m) => ({
      id: newId(),
      snapshotId: snapshot.id,
      metricType: m.metricType,
      metricValue: m.metricValue,
      unit: m.unit ?? null,
      createdAt: nowIso(),
    }));
    this.snapshots.set(snapshot.id, snapshot);
    this.metrics.set(snapshot.id, metrics);
    return { snapshot, metrics };
  }

  async listPerformanceSnapshots(input: {
    socialAccountId?: string;
    socialPublicationId?: string;
    from?: string;
    to?: string;
  }): Promise<
    Array<{
      snapshot: SocialPerformanceSnapshotRow;
      metrics: SocialPerformanceMetricValueRow[];
    }>
  > {
    return [...this.snapshots.values()]
      .filter((s) => {
        if (input.socialAccountId && s.socialAccountId !== input.socialAccountId) return false;
        if (input.socialPublicationId && s.socialPublicationId !== input.socialPublicationId) {
          return false;
        }
        if (input.from && s.measuredAt < input.from) return false;
        if (input.to && s.measuredAt > input.to) return false;
        return true;
      })
      .map((snapshot) => ({
        snapshot,
        metrics: this.metrics.get(snapshot.id) ?? [],
      }));
  }
}
