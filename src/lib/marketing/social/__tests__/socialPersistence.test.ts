import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_4,
  SOCIAL_CREDENTIAL_OWNERSHIP_CHAIN,
  SOCIAL_PERSISTENCE_FORBIDDEN_COLUMNS,
  SOCIAL_PERSISTENCE_TABLES,
  THREAD_MARKETING_POSTS_NOT_EXTERNAL_PUBLICATION_MODEL,
  assertNoRawCredentialMaterial,
  assertSocialAccountProviderChannelConsistency,
  assertSocialPersistenceDtoHasNoSecrets,
  buildMetaGrantReplacementExample,
  buildMetaMultiIdentityExample,
  type SocialAccountRow,
  type SocialAuthorizationGrantRow,
  type SocialCredentialReferenceRow,
  type SocialPerformanceMetricValueRow,
  type SocialPerformanceSnapshotRow,
  type SocialPublicationRow,
} from "@/lib/marketing/social";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260825180000_social_persistence_schema.sql",
);

describe("social persistence STEP 3-4", () => {
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates expected tables without seed/token data", () => {
    for (const table of SOCIAL_PERSISTENCE_TABLES) {
      expect(migrationSql).toContain(`create table if not exists public.${table}`);
    }
    expect(migrationSql.toLowerCase()).not.toMatch(/insert\s+into/);
    for (const col of SOCIAL_PERSISTENCE_FORBIDDEN_COLUMNS) {
      expect(migrationSql).not.toContain(col);
    }
    expect(migrationSql).not.toMatch(/access[_]?token/i);
    expect(migrationSql).not.toMatch(/refresh[_]?token/i);
    expect(migrationSql).not.toMatch(/client[_]?secret/i);
  });

  it("documents credential ownership chain and binding independence", () => {
    expect(SOCIAL_CREDENTIAL_OWNERSHIP_CHAIN).toContain("AuthorizationGrant");
    expect(SOCIAL_CREDENTIAL_OWNERSHIP_CHAIN).toContain("CredentialReference");
    expect(migrationSql).toContain("social_identity_grant_bindings");
    expect(migrationSql).toContain("Lifetime independent of grants");
    expect(migrationSql).toContain("active_authorization_grant_id");
    // SocialAccount must not own credential_reference_id
    expect(migrationSql).not.toMatch(
      /create table if not exists public\.social_accounts[\s\S]*?credential_reference_id/,
    );
  });

  it("enforces provider/channel consistency on SocialAccount domain", () => {
    const example = buildMetaMultiIdentityExample();
    for (const account of example.accounts) {
      expect(() => assertSocialAccountProviderChannelConsistency(account)).not.toThrow();
    }
    expect(() =>
      assertSocialAccountProviderChannelConsistency({
        ...example.accounts[0],
        channel: "youtube",
      }),
    ).toThrow(/mismatch/);
  });

  it("keeps ProviderIdentity alive across grant replacement", () => {
    const base = buildMetaMultiIdentityExample();
    const replaced = buildMetaGrantReplacementExample();
    expect(replaced.identities.map((i) => i.id).sort()).toEqual(
      base.identities.map((i) => i.id).sort(),
    );
    expect(replaced.identities.map((i) => i.externalId).sort()).toEqual(
      base.identities.map((i) => i.externalId).sort(),
    );
  });

  it("rejects raw credential fields on persistence DTOs", () => {
    const cred: SocialCredentialReferenceRow = {
      id: "c1",
      storeKind: "future_secure_store",
      storeHandle: "store:meta:handle-1",
      provider: "meta",
      credentialFamily: "oauth2_user",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
    assertSocialPersistenceDtoHasNoSecrets(cred);
    assertNoRawCredentialMaterial(cred);

    const grant: SocialAuthorizationGrantRow = {
      id: "g1",
      provider: "meta",
      credentialReferenceId: "c1",
      credentialFamily: "oauth2_user",
      status: "active",
      permissions: [{ code: "pages_manage_posts" }],
      refreshSupported: true,
      reauthorizationRequired: false,
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
    assertSocialPersistenceDtoHasNoSecrets(grant);

    expect(() =>
      assertSocialPersistenceDtoHasNoSecrets({
        ...cred,
        access_token: "nope",
      } as object),
    ).toThrow(/Forbidden credential column/);
  });

  it("represents MarketingPost → multiple ExternalPublications", () => {
    const contentId = "content-master-1";
    const pubs: SocialPublicationRow[] = [
      {
        id: "pub-ig-1",
        contentId,
        socialAccountId: "sa_instagram_1",
        provider: "meta",
        channel: "instagram",
        mediaType: "image",
        status: "pending",
        idempotencyKey: `${contentId}:instagram:v1`,
        governanceDecision: "ALLOW",
        humanApprovalRef: "approval:run-1",
        providerStatusMetadata: {},
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
      },
      {
        id: "pub-th-1",
        contentId,
        socialAccountId: "sa_threads_1",
        provider: "meta",
        channel: "threads",
        mediaType: "text",
        status: "pending",
        idempotencyKey: `${contentId}:threads:v1`,
        governanceDecision: "ALLOW",
        humanApprovalRef: "approval:run-1",
        providerStatusMetadata: {},
        createdAt: "2026-08-25T00:00:00.000Z",
        updatedAt: "2026-08-25T00:00:00.000Z",
      },
    ];
    expect(pubs).toHaveLength(2);
    expect(new Set(pubs.map((p) => p.contentId))).toEqual(new Set([contentId]));
    expect(THREAD_MARKETING_POSTS_NOT_EXTERNAL_PUBLICATION_MODEL).toContain("thread_marketing");
    expect(migrationSql).toContain("idx_social_publications_account_idempotency");
    expect(migrationSql).toContain("Not thread_marketing_posts");
  });

  it("documents publication idempotency uniqueness", () => {
    expect(migrationSql).toMatch(
      /unique index if not exists idx_social_publications_account_idempotency[\s\S]*?\(social_account_id, idempotency_key\)/,
    );
    expect(migrationSql).toMatch(
      /unique index if not exists idx_social_publications_provider_channel_external[\s\S]*?\(provider, channel, external_post_id\)/,
    );
    // pending rows may omit external_post_id
    const pending: SocialPublicationRow = {
      id: "pub-pending",
      socialAccountId: "sa_1",
      provider: "meta",
      channel: "threads",
      status: "pending",
      externalPostId: null,
      idempotencyKey: "content-1:threads:attempt-a",
      providerStatusMetadata: {},
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
    expect(pending.externalPostId).toBeNull();
    expect(pending.status).toBe("pending");
  });

  it("represents account-level and publication-level performance snapshots", () => {
    const accountSnap: SocialPerformanceSnapshotRow = {
      id: "snap-a",
      provider: "meta",
      channel: "instagram",
      scope: "account",
      socialAccountId: "sa_instagram_1",
      socialPublicationId: null,
      measuredAt: "2026-08-25T00:00:00.000Z",
      dataAvailability: "partial",
      createdAt: "2026-08-25T00:00:00.000Z",
    };
    const pubSnap: SocialPerformanceSnapshotRow = {
      id: "snap-p",
      provider: "meta",
      channel: "instagram",
      scope: "publication",
      socialAccountId: "sa_instagram_1",
      socialPublicationId: "pub-ig-1",
      measuredAt: "2026-08-25T00:00:00.000Z",
      dataAvailability: "available",
      createdAt: "2026-08-25T00:00:00.000Z",
    };
    const metrics: SocialPerformanceMetricValueRow[] = [
      {
        id: "m1",
        snapshotId: "snap-p",
        metricType: "impressions",
        metricValue: 1200,
        unit: "count",
        createdAt: "2026-08-25T00:00:00.000Z",
      },
      {
        id: "m2",
        snapshotId: "snap-p",
        metricType: "engagements",
        metricValue: 84,
        unit: "count",
        createdAt: "2026-08-25T00:00:00.000Z",
      },
    ];
    expect(accountSnap.scope).toBe("account");
    expect(accountSnap.socialPublicationId).toBeNull();
    expect(pubSnap.socialPublicationId).toBe("pub-ig-1");
    expect(metrics).toHaveLength(2);
    expect(migrationSql).toContain("social_performance_snapshots_publication_scope");
  });

  it("keeps PUBLICATION_FLOW_INACTIVE and zero SNS side effects", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_4).toBe(0);
  });

  it("models SocialAccount row without credential ownership", () => {
    const row: SocialAccountRow = {
      id: "sa_1",
      provider: "meta",
      channel: "threads",
      providerIdentityId: "pid_1",
      externalIdentityId: "threads_ext_1",
      status: "connected",
      activeAuthorizationGrantId: "grant_1",
      createdAt: "2026-08-25T00:00:00.000Z",
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
    expect(row).not.toHaveProperty("credentialReferenceId");
    expect(row).not.toHaveProperty("credentialRef");
    assertSocialPersistenceDtoHasNoSecrets(row);
  });

  it("declares service_role-only RLS and revokes anon/authenticated", () => {
    expect(migrationSql).toContain("enable row level security");
    expect(migrationSql).toContain("service_role_all_social_credential_references");
    expect(migrationSql).toContain("service_role_all_social_authorization_grants");
    expect(migrationSql).toContain("revoke all on public.social_credential_references from anon, authenticated");
    expect(migrationSql).toContain("revoke all on public.social_authorization_grants from anon, authenticated");
    expect(migrationSql).toContain("revoke all on public.social_accounts from anon, authenticated");
    expect(migrationSql).not.toMatch(/create policy[\s\S]*to anon/);
    expect(migrationSql).not.toMatch(/create policy[\s\S]*to authenticated/);
  });

  it("includes governance/approval reference hooks without activating eligibility", () => {
    expect(migrationSql).toContain("governance_decision");
    expect(migrationSql).toContain("governance_run_id");
    expect(migrationSql).toContain("human_approval_ref");
    expect(migrationSql).toContain("references public.ai_runs");
  });
});
