import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_5,
  assertNoRawCredentialMaterial,
  createCredentialReference,
  createInMemorySocialRepository,
  SocialIdempotencyConflictError,
  toSafeAuthorizationProjection,
  toSafeSocialAccountProjection,
} from "@/lib/marketing/social";

async function seedConnectedThreadsAccount() {
  const repo = createInMemorySocialRepository();
  const identity = await repo.upsertProviderIdentity({
    provider: "meta",
    kind: "threads_profile",
    externalId: "threads_ext_1",
    displayName: "Threads One",
    channelHints: ["threads"],
  });
  const cred = await repo.createCredentialReference({
    storeHandle: "store:meta:grant-seed-1",
    provider: "meta",
    family: "oauth2_user",
  });
  const grant = await repo.createAuthorizationGrant({
    provider: "meta",
    credentialRef: cred.ref,
    credentialReferenceId: cred.id,
    credentialFamily: "oauth2_user",
    status: "active",
    permissions: [{ code: "threads_content_publish" }],
    refreshSupported: true,
  });
  await repo.bindIdentityToGrant({
    providerIdentityId: identity.id,
    authorizationGrantId: grant.id,
  });
  const account = await repo.registerSocialAccount({
    provider: "meta",
    channel: "threads",
    providerIdentityId: identity.id,
    externalIdentityId: identity.externalId,
    displayName: identity.displayName,
    status: "connected",
    activeAuthorizationGrantId: grant.id,
  });
  return { repo, identity, grant, account, cred };
}

describe("social repository STEP 3-5", () => {
  it("creates and reads SocialAccount with provider/channel consistency", async () => {
    const { repo, account, identity } = await seedConnectedThreadsAccount();
    const loaded = await repo.getSocialAccountById(account.id);
    expect(loaded?.id).toBe(account.id);
    expect(loaded?.channel).toBe("threads");
    const found = await repo.findSocialAccount({
      provider: "meta",
      channel: "threads",
      externalIdentityId: "threads_ext_1",
    });
    expect(found?.id).toBe(account.id);
    const resolvedIdentity = await repo.resolveProviderIdentityForAccount(account.id);
    expect(resolvedIdentity?.id).toBe(identity.id);
    await expect(
      repo.registerSocialAccount({
        provider: "meta",
        channel: "youtube",
        providerIdentityId: identity.id,
        externalIdentityId: identity.externalId,
      }),
    ).rejects.toThrow(/incompatible|mismatch/);
  });

  it("upserts stable ProviderIdentity and survives grant revocation", async () => {
    const { repo, identity, grant } = await seedConnectedThreadsAccount();
    const again = await repo.upsertProviderIdentity({
      provider: "meta",
      kind: "threads_profile",
      externalId: "threads_ext_1",
      displayName: "Renamed",
      channelHints: ["threads"],
    });
    expect(again.id).toBe(identity.id);
    expect(again.displayName).toBe("Renamed");

    const binding = await repo.findActiveBinding(identity.id, grant.id);
    expect(binding?.status).toBe("active");
    await repo.revokeBinding(binding!.id);
    await repo.updateAuthorizationGrantStatus(grant.id, "revoked");

    const stillThere = await repo.getProviderIdentityById(identity.id);
    expect(stillThere?.externalId).toBe("threads_ext_1");
    expect(await repo.findActiveBinding(identity.id)).toBeNull();
  });

  it("rejects revoked binding and stale soft pointer as non-authoritative", async () => {
    const { repo, account, identity, grant } = await seedConnectedThreadsAccount();

    const binding = await repo.findActiveBinding(identity.id, grant.id);
    await repo.revokeBinding(binding!.id);
    await repo.updateAuthorizationGrantStatus(grant.id, "revoked");

    // Soft pointer still points at revoked grant — must NOT be usable
    await repo.setSocialAccountSoftGrantPointer(account.id, grant.id);
    const resolution = await repo.resolveAccountAuthorization(account.id);
    expect(resolution.usable).toBe(false);
    if (resolution.usable) {
      throw new Error("expected authorization to be unusable");
    }
    expect(resolution.reason).toMatch(/no_active_binding|grant_revoked/);
    expect(resolution.softPointerGrantId).toBe(grant.id);
  });

  it("resolves authorization via active binding, not soft pointer alone", async () => {
    const { repo, account, identity, grant } = await seedConnectedThreadsAccount();
    // Point soft pointer at nonsense / missing — binding still authorizes
    await repo.setSocialAccountSoftGrantPointer(account.id, null);
    const resolution = await repo.resolveAccountAuthorization(account.id);
    expect(resolution.usable).toBe(true);
    if (resolution.usable) {
      expect(resolution.resolved.binding.authorizationGrantId).toBe(grant.id);
      expect(resolution.resolved.identity.id).toBe(identity.id);
      expect(resolution.resolved.account.activeAuthorizationGrantId).toBeNull();
    }
  });

  it("rebinds same ProviderIdentity to a replacement grant atomically", async () => {
    const { repo, identity, grant, account } = await seedConnectedThreadsAccount();
    const result = await repo.reauthorizeIdentity({
      providerIdentityId: identity.id,
      previousGrantId: grant.id,
      socialAccountIds: [account.id],
      newCredential: {
        storeHandle: "store:meta:grant-replacement-2",
        provider: "meta",
        family: "oauth2_user",
      },
      newGrant: {
        provider: "meta",
        credentialFamily: "oauth2_user",
        status: "active",
        permissions: [{ code: "threads_content_publish" }],
        refreshSupported: true,
      },
    });

    expect(result.grant.id).not.toBe(grant.id);
    expect((await repo.getAuthorizationGrantById(grant.id))?.status).toBe("revoked");
    expect(result.grant.status).toBe("active");
    expect((await repo.getProviderIdentityById(identity.id))?.id).toBe(identity.id);

    const bindings = await repo.listBindingsForIdentity(identity.id);
    expect(bindings.some((b) => b.status === "revoked" && b.authorizationGrantId === grant.id)).toBe(
      true,
    );
    expect(bindings.some((b) => b.status === "active" && b.authorizationGrantId === result.grant.id)).toBe(
      true,
    );

    const updatedAccount = await repo.getSocialAccountById(account.id);
    expect(updatedAccount?.activeAuthorizationGrantId).toBe(result.grant.id);

    const resolution = await repo.resolveAccountAuthorization(account.id);
    expect(resolution.usable).toBe(true);
  });

  it("rolls back reauthorization on forced failure", async () => {
    const { repo, identity, grant, account } = await seedConnectedThreadsAccount();
    repo.failReauthorizeAfter = "binding";
    await expect(
      repo.reauthorizeIdentity({
        providerIdentityId: identity.id,
        previousGrantId: grant.id,
        socialAccountIds: [account.id],
        newCredential: {
          storeHandle: "store:meta:grant-fail-3",
          provider: "meta",
          family: "oauth2_user",
        },
        newGrant: {
          provider: "meta",
          credentialFamily: "oauth2_user",
          status: "active",
        },
      }),
    ).rejects.toThrow(/forced fail/);

    expect((await repo.getAuthorizationGrantById(grant.id))?.status).toBe("active");
    expect((await repo.findActiveBinding(identity.id, grant.id))?.status).toBe("active");
    expect((await repo.getSocialAccountById(account.id))?.activeAuthorizationGrantId).toBe(grant.id);
    expect(await repo.getProviderIdentityById(identity.id)).not.toBeNull();
  });

  it("round-trips opaque CredentialReference without raw secrets", async () => {
    const repo = createInMemorySocialRepository();
    const created = await repo.createCredentialReference({
      storeHandle: "store:meta:opaque-only",
      provider: "meta",
      family: "oauth2_user",
    });
    const loaded = await repo.getCredentialReferenceById(created.id);
    expect(loaded?.ref.storeHandle).toBe("store:meta:opaque-only");
    assertNoRawCredentialMaterial(loaded);
    expect(() =>
      createCredentialReference({
        storeHandle: "refresh_token_xyz",
        provider: "meta",
        family: "oauth2_user",
      }),
    ).toThrow(/opaque/);

    const safe = toSafeAuthorizationProjection({
      id: "g1",
      provider: "meta",
      status: "active",
      credentialFamily: "oauth2_user",
      permissions: [{ code: "x" }],
      credentialRef: created.ref,
      providerIdentityIds: [],
      refreshSupported: true,
    });
    expect(safe.hasCredentialReference).toBe(true);
    expect(safe).not.toHaveProperty("storeHandle");
    expect(JSON.stringify(safe)).not.toMatch(/store:meta/);
  });

  it("enforces publication idempotency and multi-publication per content", async () => {
    const { repo, account } = await seedConnectedThreadsAccount();
    const identityIg = await repo.upsertProviderIdentity({
      provider: "meta",
      kind: "instagram_professional",
      externalId: "ig_ext_1",
      channelHints: ["instagram"],
    });
    const accountIg = await repo.registerSocialAccount({
      provider: "meta",
      channel: "instagram",
      providerIdentityId: identityIg.id,
      externalIdentityId: identityIg.externalId,
      status: "connected",
    });

    const contentId = "11111111-1111-4111-8111-111111111111";
    const pub1 = await repo.createPendingPublication({
      contentId,
      socialAccountId: account.id,
      provider: "meta",
      channel: "threads",
      idempotencyKey: `${contentId}:threads:v1`,
      governanceDecision: "ALLOW",
      humanApprovalRef: "approval:1",
    });
    const pub2 = await repo.createPendingPublication({
      contentId,
      socialAccountId: accountIg.id,
      provider: "meta",
      channel: "instagram",
      idempotencyKey: `${contentId}:instagram:v1`,
      governanceDecision: "ALLOW",
      humanApprovalRef: "approval:1",
    });
    expect(pub1.id).not.toBe(pub2.id);
    expect(await repo.listPublicationsForContent(contentId)).toHaveLength(2);

    await expect(
      repo.createPendingPublication({
        contentId,
        socialAccountId: account.id,
        provider: "meta",
        channel: "threads",
        idempotencyKey: `${contentId}:threads:v1`,
      }),
    ).rejects.toBeInstanceOf(SocialIdempotencyConflictError);

    const existing = await repo.findPublicationByIdempotency(account.id, `${contentId}:threads:v1`);
    expect(existing?.id).toBe(pub1.id);
  });

  it("persists account-level and publication-level performance snapshots", async () => {
    const { repo, account } = await seedConnectedThreadsAccount();
    const pub = await repo.createPendingPublication({
      socialAccountId: account.id,
      provider: "meta",
      channel: "threads",
      idempotencyKey: "perf-pub-1",
    });
    await repo.updatePublicationStatus(pub.id, "published", {
      externalPostId: "ext_post_1",
      publishedAt: "2026-08-25T00:00:00.000Z",
    });

    const accountSnap = await repo.createPerformanceSnapshot({
      provider: "meta",
      channel: "threads",
      scope: "account",
      socialAccountId: account.id,
      dataAvailability: "partial",
      metrics: [{ metricType: "followers", metricValue: 10, unit: "count" }],
    });
    const pubSnap = await repo.createPerformanceSnapshot({
      provider: "meta",
      channel: "threads",
      scope: "publication",
      socialAccountId: account.id,
      socialPublicationId: pub.id,
      dataAvailability: "available",
      metrics: [
        { metricType: "impressions", metricValue: 100 },
        { metricType: "likes", metricValue: 5 },
      ],
    });
    expect(accountSnap.snapshot.scope).toBe("account");
    expect(accountSnap.snapshot.socialPublicationId).toBeNull();
    expect(pubSnap.metrics).toHaveLength(2);

    const listed = await repo.listPerformanceSnapshots({ socialAccountId: account.id });
    expect(listed.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps publication flow inactive and returns safe account projections", async () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_5).toBe(0);
    const { repo, account } = await seedConnectedThreadsAccount();
    const resolution = await repo.resolveAccountAuthorization(account.id);
    const safe = toSafeSocialAccountProjection(account, resolution.usable);
    expect(safe.authorizationUsable).toBe(true);
    expect(safe).not.toHaveProperty("activeAuthorizationGrantId");
    expect(safe).not.toHaveProperty("credentialRef");
  });
});
