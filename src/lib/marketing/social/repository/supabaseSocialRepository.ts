import "server-only";

import type { SocialDbClient } from "@/lib/marketing/social/repository/dbClient";

/**
 * Supabase-backed SocialRepository (service_role, server-only).
 * No OAuth / CredentialStore resolution / SNS side effects.
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
import {
  mapAuthorizationGrantRow,
  mapBindingRow,
  mapCredentialReferenceRow,
  mapMetricValueRow,
  mapPerformanceSnapshotRow,
  mapProviderIdentityRow,
  mapPublicationRow,
  mapSocialAccountRow,
} from "@/lib/marketing/social/repository/mappers";

function throwDb(error: { message: string; code?: string } | null, fallback: string): never {
  if (error?.code === "23505") {
    throw new SocialIdempotencyConflictError("duplicate");
  }
  throw new SocialRepositoryError("db_error", error?.message || fallback);
}

function asRow(data: unknown): Record<string, unknown> {
  if (typeof data !== "object" || data == null || Array.isArray(data)) {
    throw new SocialRepositoryError("db_error", "expected single row");
  }
  return data as Record<string, unknown>;
}

function asRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];
  if (!Array.isArray(data)) {
    throw new SocialRepositoryError("db_error", "expected row array");
  }
  return data as Record<string, unknown>[];
}

export type { SocialDbClient, SocialDbQuery, SocialDbResult } from "@/lib/marketing/social/repository/dbClient";

export class SupabaseSocialRepository implements SocialRepository {
  constructor(private readonly client: SocialDbClient) {}

  async upsertProviderIdentity(input: UpsertProviderIdentityInput): Promise<ProviderIdentity> {
    assertOpaquePersistenceInput(input);
    const { data, error } = await this.client
      .from("social_provider_identities")
      .upsert(
        {
          provider: input.provider,
          identity_kind: input.kind,
          external_id: input.externalId,
          display_name: input.displayName ?? null,
          channel_hints: input.channelHints ?? [],
          extension: input.extension ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider,identity_kind,external_id" },
      )
      .select("*")
      .single();
    if (error) throwDb(error, "upsertProviderIdentity failed");
    return mapProviderIdentityRow(asRow(data));
  }

  async getProviderIdentityById(id: string): Promise<ProviderIdentity | null> {
    const { data, error } = await this.client
      .from("social_provider_identities")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "getProviderIdentityById failed");
    return data ? mapProviderIdentityRow(asRow(data)) : null;
  }

  async findProviderIdentity(
    provider: SocialProvider,
    kind: string,
    externalId: string,
  ): Promise<ProviderIdentity | null> {
    const { data, error } = await this.client
      .from("social_provider_identities")
      .select("*")
      .eq("provider", provider)
      .eq("identity_kind", kind)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) throwDb(error, "findProviderIdentity failed");
    return data ? mapProviderIdentityRow(asRow(data)) : null;
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
    const { data, error } = await this.client
      .from("social_credential_references")
      .insert({
        store_kind: input.storeKind ?? "future_secure_store",
        store_handle: ref.storeHandle,
        provider: ref.provider,
        credential_family: ref.family,
      })
      .select("*")
      .single();
    if (error) throwDb(error, "createCredentialReference failed");
    return mapCredentialReferenceRow(asRow(data));
  }

  async getCredentialReferenceById(
    id: string,
  ): Promise<{ id: string; ref: CredentialReference } | null> {
    const { data, error } = await this.client
      .from("social_credential_references")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "getCredentialReferenceById failed");
    return data ? mapCredentialReferenceRow(asRow(data)) : null;
  }

  async createAuthorizationGrant(input: CreateAuthorizationGrantInput): Promise<AuthorizationGrant> {
    assertOpaquePersistenceInput(input);
    let credentialReferenceId = input.credentialReferenceId;
    let credentialRef = input.credentialRef;
    if (!credentialReferenceId) {
      const created = await this.createCredentialReference({
        storeHandle: input.credentialRef.storeHandle,
        provider: input.credentialRef.provider,
        family: input.credentialRef.family,
      });
      credentialReferenceId = created.id;
      credentialRef = created.ref;
    }
    const { data, error } = await this.client
      .from("social_authorization_grants")
      .insert({
        provider: input.provider,
        credential_reference_id: credentialReferenceId,
        credential_family: input.credentialFamily,
        status: input.status ?? "pending",
        permissions: input.permissions ?? [],
        issued_at: input.issuedAt ?? null,
        expires_at: input.expiresAt ?? null,
        refresh_supported: input.refreshSupported ?? false,
        reauthorization_required: input.reauthorizationRequired ?? false,
      })
      .select("*")
      .single();
    if (error) throwDb(error, "createAuthorizationGrant failed");
    const grant = mapAuthorizationGrantRow(asRow(data), credentialRef);
    grant.providerIdentityIds = input.providerIdentityIds ?? [];
    return grant;
  }

  async getAuthorizationGrantById(id: string): Promise<AuthorizationGrant | null> {
    const { data, error } = await this.client
      .from("social_authorization_grants")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "getAuthorizationGrantById failed");
    if (!data) return null;
    const row = asRow(data);
    const cred = await this.getCredentialReferenceById(String(row.credential_reference_id));
    if (!cred) return null;
    return mapAuthorizationGrantRow(row, cred.ref);
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
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (patch?.expiresAt !== undefined) update.expires_at = patch.expiresAt;
    if (patch?.reauthorizationRequired !== undefined) {
      update.reauthorization_required = patch.reauthorizationRequired;
    }
    if (patch?.refreshSupported !== undefined) update.refresh_supported = patch.refreshSupported;
    const { data, error } = await this.client
      .from("social_authorization_grants")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throwDb(error, "updateAuthorizationGrantStatus failed");
    const row = asRow(data);
    const cred = await this.getCredentialReferenceById(String(row.credential_reference_id));
    if (!cred) throw new SocialRepositoryError("not_found", "credential reference missing");
    return mapAuthorizationGrantRow(row, cred.ref);
  }

  async bindIdentityToGrant(input: {
    providerIdentityId: string;
    authorizationGrantId: string;
  }): Promise<IdentityGrantBinding> {
    const { data, error } = await this.client
      .from("social_identity_grant_bindings")
      .upsert(
        {
          provider_identity_id: input.providerIdentityId,
          authorization_grant_id: input.authorizationGrantId,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_identity_id,authorization_grant_id" },
      )
      .select("*")
      .single();
    if (error) throwDb(error, "bindIdentityToGrant failed");
    return mapBindingRow(asRow(data));
  }

  async revokeBinding(bindingId: string): Promise<IdentityGrantBinding> {
    const { data, error } = await this.client
      .from("social_identity_grant_bindings")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", bindingId)
      .select("*")
      .single();
    if (error) throwDb(error, "revokeBinding failed");
    return mapBindingRow(asRow(data));
  }

  async findActiveBinding(
    providerIdentityId: string,
    authorizationGrantId?: string,
  ): Promise<IdentityGrantBinding | null> {
    let query = this.client
      .from("social_identity_grant_bindings")
      .select("*")
      .eq("provider_identity_id", providerIdentityId)
      .eq("status", "active");
    if (authorizationGrantId) query = query.eq("authorization_grant_id", authorizationGrantId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throwDb(error, "findActiveBinding failed");
    return data ? mapBindingRow(asRow(data)) : null;
  }

  async listBindingsForIdentity(providerIdentityId: string): Promise<IdentityGrantBinding[]> {
    const { data, error } = await this.client
      .from("social_identity_grant_bindings")
      .select("*")
      .eq("provider_identity_id", providerIdentityId);
    if (error) throwDb(error, "listBindingsForIdentity failed");
    return asRows(data).map(mapBindingRow);
  }

  async registerSocialAccount(input: RegisterSocialAccountInput): Promise<SocialAccount> {
    assertOpaquePersistenceInput(input);
    assertProviderChannelCompatible(input.provider, input.channel);
    const identity = await this.getProviderIdentityById(input.providerIdentityId);
    if (!identity) throw new SocialRepositoryError("not_found", "provider identity missing");
    const provisional: SocialAccount = {
      id: "pending",
      provider: input.provider,
      channel: input.channel,
      providerIdentityId: input.providerIdentityId,
      externalIdentityId: input.externalIdentityId,
      displayName: input.displayName ?? null,
      status: input.status ?? "disconnected",
      activeAuthorizationGrantId: input.activeAuthorizationGrantId ?? null,
    };
    assertAccountMatchesIdentity(provisional, identity);
    const { data, error } = await this.client
      .from("social_accounts")
      .insert({
        provider: input.provider,
        channel: input.channel,
        provider_identity_id: input.providerIdentityId,
        external_identity_id: input.externalIdentityId,
        display_name: input.displayName ?? null,
        status: input.status ?? "disconnected",
        active_authorization_grant_id: input.activeAuthorizationGrantId ?? null,
      })
      .select("*")
      .single();
    if (error) throwDb(error, "registerSocialAccount failed");
    return mapSocialAccountRow(asRow(data));
  }

  async getSocialAccountById(id: string): Promise<SocialAccount | null> {
    const { data, error } = await this.client
      .from("social_accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "getSocialAccountById failed");
    return data ? mapSocialAccountRow(asRow(data)) : null;
  }

  async findSocialAccount(input: {
    provider: SocialProvider;
    channel: SocialChannel;
    externalIdentityId: string;
  }): Promise<SocialAccount | null> {
    const { data, error } = await this.client
      .from("social_accounts")
      .select("*")
      .eq("provider", input.provider)
      .eq("channel", input.channel)
      .eq("external_identity_id", input.externalIdentityId)
      .maybeSingle();
    if (error) throwDb(error, "findSocialAccount failed");
    return data ? mapSocialAccountRow(asRow(data)) : null;
  }

  async updateSocialAccountStatus(id: string, status: SocialAccountStatus): Promise<SocialAccount> {
    const { data, error } = await this.client
      .from("social_accounts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throwDb(error, "updateSocialAccountStatus failed");
    return mapSocialAccountRow(asRow(data));
  }

  async setSocialAccountSoftGrantPointer(
    accountId: string,
    grantId: string | null,
  ): Promise<SocialAccount> {
    const { data, error } = await this.client
      .from("social_accounts")
      .update({
        active_authorization_grant_id: grantId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select("*")
      .single();
    if (error) throwDb(error, "setSocialAccountSoftGrantPointer failed");
    return mapSocialAccountRow(asRow(data));
  }

  async resolveProviderIdentityForAccount(accountId: string): Promise<ProviderIdentity | null> {
    const account = await this.getSocialAccountById(accountId);
    if (!account) return null;
    return this.getProviderIdentityById(account.providerIdentityId);
  }

  async resolveAccountAuthorization(accountId: string): Promise<AccountAuthorizationResolution> {
    const account = await this.getSocialAccountById(accountId);
    if (!account) throw new SocialRepositoryError("not_found", `account not found: ${accountId}`);
    const identity = await this.getProviderIdentityById(account.providerIdentityId);
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
    const grant = await this.getAuthorizationGrantById(activeBinding.authorizationGrantId);
    if (!grant || grant.status !== "active") {
      return {
        usable: false,
        reason: grant ? `grant_${grant.status}` : "grant_missing",
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
        grant,
        credentialRef: grant.credentialRef,
      },
    };
  }

  async reauthorizeIdentity(input: ReauthorizeIdentityInput): Promise<ReauthorizeIdentityResult> {
    assertOpaquePersistenceInput(input);
    // Application-level transaction with compensating rollback (no DB RPC in STEP 3-5).
    const createdCredentialIds: string[] = [];
    const createdGrantIds: string[] = [];
    const createdBindingIds: string[] = [];
    const previousBindingIds: string[] = [];
    const previousAccountPointers = new Map<string, string | null>();

    try {
      const identity = await this.getProviderIdentityById(input.providerIdentityId);
      if (!identity) throw new SocialRepositoryError("not_found", "provider identity missing");

      const previousBindings = (await this.listBindingsForIdentity(input.providerIdentityId)).filter(
        (b) => b.authorizationGrantId === input.previousGrantId && b.status === "active",
      );

      const cred = await this.createCredentialReference(input.newCredential);
      createdCredentialIds.push(cred.id);

      const grant = await this.createAuthorizationGrant({
        ...input.newGrant,
        credentialRef: cred.ref,
        credentialReferenceId: cred.id,
        status: input.newGrant.status ?? "active",
        providerIdentityIds: [input.providerIdentityId],
      });
      createdGrantIds.push(grant.id);

      for (const binding of previousBindings) {
        previousBindingIds.push(binding.id);
        await this.revokeBinding(binding.id);
      }
      await this.updateAuthorizationGrantStatus(input.previousGrantId, "revoked");

      const binding = await this.bindIdentityToGrant({
        providerIdentityId: input.providerIdentityId,
        authorizationGrantId: grant.id,
      });
      createdBindingIds.push(binding.id);

      let accountIds = input.socialAccountIds;
      if (!accountIds) {
        // Best-effort: caller should pass account ids; without list API we only update provided ones.
        accountIds = [];
      }
      const updatedAccounts: SocialAccount[] = [];
      for (const accountId of accountIds) {
        const before = await this.getSocialAccountById(accountId);
        if (before) previousAccountPointers.set(accountId, before.activeAuthorizationGrantId ?? null);
        updatedAccounts.push(await this.setSocialAccountSoftGrantPointer(accountId, grant.id));
      }

      return {
        credentialReferenceId: cred.id,
        credentialRef: cred.ref,
        grant,
        bindings: [binding],
        updatedAccounts,
      };
    } catch (error) {
      // Compensating rollback (best-effort)
      for (const accountId of previousAccountPointers.keys()) {
        try {
          await this.setSocialAccountSoftGrantPointer(
            accountId,
            previousAccountPointers.get(accountId) ?? null,
          );
        } catch {
          /* best-effort rollback */
        }
      }
      for (const bindingId of createdBindingIds) {
        try {
          await this.revokeBinding(bindingId);
        } catch {
          /* best-effort rollback */
        }
      }
      for (const bindingId of previousBindingIds) {
        try {
          await this.client
            .from("social_identity_grant_bindings")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("id", bindingId)
            .select("*")
            .maybeSingle();
        } catch {
          /* best-effort rollback */
        }
      }
      for (const grantId of createdGrantIds) {
        try {
          await this.updateAuthorizationGrantStatus(grantId, "invalid");
        } catch {
          /* best-effort rollback */
        }
      }
      try {
        await this.updateAuthorizationGrantStatus(input.previousGrantId, "active");
      } catch {
        /* best-effort rollback */
      }
      throw error;
    }
  }

  async createPendingPublication(input: CreatePendingPublicationInput): Promise<SocialPublicationRow> {
    assertOpaquePersistenceInput(input);
    assertProviderChannelCompatible(input.provider, input.channel);
    const account = await this.getSocialAccountById(input.socialAccountId);
    if (!account) throw new SocialRepositoryError("not_found", "social account missing");
    if (account.provider !== input.provider || account.channel !== input.channel) {
      throw new SocialInvariantError("publication provider/channel must match SocialAccount");
    }
    const existing = await this.findPublicationByIdempotency(
      input.socialAccountId,
      input.idempotencyKey,
    );
    if (existing) throw new SocialIdempotencyConflictError(existing.id);

    const { data, error } = await this.client
      .from("social_publications")
      .insert({
        content_id: input.contentId ?? null,
        ai_publication_id: input.aiPublicationId ?? null,
        social_account_id: input.socialAccountId,
        provider: input.provider,
        channel: input.channel,
        media_type: input.mediaType ?? null,
        status: "pending",
        idempotency_key: input.idempotencyKey,
        governance_decision: input.governanceDecision ?? null,
        governance_run_id: input.governanceRunId ?? null,
        human_approval_ref: input.humanApprovalRef ?? null,
        provider_status_metadata: {},
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        const again = await this.findPublicationByIdempotency(
          input.socialAccountId,
          input.idempotencyKey,
        );
        throw new SocialIdempotencyConflictError(again?.id ?? "duplicate");
      }
      throwDb(error, "createPendingPublication failed");
    }
    return mapPublicationRow(asRow(data));
  }

  async getPublicationById(id: string): Promise<SocialPublicationRow | null> {
    const { data, error } = await this.client
      .from("social_publications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throwDb(error, "getPublicationById failed");
    return data ? mapPublicationRow(asRow(data)) : null;
  }

  async findPublicationByIdempotency(
    socialAccountId: string,
    idempotencyKey: string,
  ): Promise<SocialPublicationRow | null> {
    const { data, error } = await this.client
      .from("social_publications")
      .select("*")
      .eq("social_account_id", socialAccountId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error) throwDb(error, "findPublicationByIdempotency failed");
    return data ? mapPublicationRow(asRow(data)) : null;
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
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (patch?.externalPostId !== undefined) update.external_post_id = patch.externalPostId;
    if (patch?.externalUrl !== undefined) update.external_url = patch.externalUrl;
    if (patch?.publishedAt !== undefined) update.published_at = patch.publishedAt;
    if (patch?.providerStatusMetadata !== undefined) {
      update.provider_status_metadata = patch.providerStatusMetadata;
    }
    const { data, error } = await this.client
      .from("social_publications")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throwDb(error, "updatePublicationStatus failed");
    return mapPublicationRow(asRow(data));
  }

  async listPublicationsForContent(contentId: string): Promise<SocialPublicationRow[]> {
    const { data, error } = await this.client
      .from("social_publications")
      .select("*")
      .eq("content_id", contentId);
    if (error) throwDb(error, "listPublicationsForContent failed");
    return asRows(data).map(mapPublicationRow);
  }

  async listPublicationsForAccount(socialAccountId: string): Promise<SocialPublicationRow[]> {
    const { data, error } = await this.client
      .from("social_publications")
      .select("*")
      .eq("social_account_id", socialAccountId);
    if (error) throwDb(error, "listPublicationsForAccount failed");
    return asRows(data).map(mapPublicationRow);
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
    const { data, error } = await this.client
      .from("social_performance_snapshots")
      .insert({
        provider: input.provider,
        channel: input.channel,
        scope: input.scope,
        social_account_id: input.socialAccountId,
        social_publication_id: input.socialPublicationId ?? null,
        period_start: input.periodStart ?? null,
        period_end: input.periodEnd ?? null,
        measured_at: input.measuredAt ?? new Date().toISOString(),
        data_availability: input.dataAvailability ?? "unavailable",
      })
      .select("*")
      .single();
    if (error) throwDb(error, "createPerformanceSnapshot failed");
    const snapshot = mapPerformanceSnapshotRow(asRow(data));
    const metricRows = input.metrics.map((m) => ({
      snapshot_id: snapshot.id,
      metric_type: m.metricType,
      metric_value: m.metricValue,
      unit: m.unit ?? null,
    }));
    let metrics: SocialPerformanceMetricValueRow[] = [];
    if (metricRows.length > 0) {
      const inserted = await this.client
        .from("social_performance_metric_values")
        .insert(metricRows)
        .select("*");
      if (inserted.error) throwDb(inserted.error, "createPerformanceSnapshot metrics failed");
      metrics = asRows(inserted.data).map(mapMetricValueRow);
    }
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
    let query = this.client.from("social_performance_snapshots").select("*");
    if (input.socialAccountId) query = query.eq("social_account_id", input.socialAccountId);
    if (input.socialPublicationId) {
      query = query.eq("social_publication_id", input.socialPublicationId);
    }
    if (input.from) query = query.gte("measured_at", input.from);
    if (input.to) query = query.lte("measured_at", input.to);
    const { data, error } = await query.order("measured_at", { ascending: false });
    if (error) throwDb(error, "listPerformanceSnapshots failed");
    const snapshots = asRows(data).map(mapPerformanceSnapshotRow);
    const results = [];
    for (const snapshot of snapshots) {
      const metricRes = await this.client
        .from("social_performance_metric_values")
        .select("*")
        .eq("snapshot_id", snapshot.id);
      if (metricRes.error) throwDb(metricRes.error, "listPerformanceSnapshots metrics failed");
      results.push({
        snapshot,
        metrics: asRows(metricRes.data).map(mapMetricValueRow),
      });
    }
    return results;
  }
}
