import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  PUBLICATION_FLOW_INACTIVE,
  MarketingPublicationError,
  MARKETING_PUBLICATION_ERROR_CODES,
  assertNoRawCredentialMaterial,
  createCredentialReference,
  createInMemoryCredentialStore,
  createInMemorySocialRepository,
  createMarketingPublicationOrchestrator,
  createThreadsMarketingPublicationAdapter,
  THREADS_MARKETING_ADAPTER_NOT_ADMIN_ROUTE,
  buildMarketingPublicationIdempotencyKey,
} from "@/lib/marketing/social";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import { HUMAN_MARKETING_REVIEW_CONTRACT } from "@/lib/marketing/review/types";

function approvedReview(candidateId = "cmc_pub2"): HumanMarketingReview {
  const now = new Date().toISOString();
  return {
    contract: HUMAN_MARKETING_REVIEW_CONTRACT,
    reviewId: "hmr_pub2_1",
    candidateId,
    runId: "run_pub2",
    status: "approved_for_manual_publish",
    originalDraft: { title: "t", body: "Hello Threads", channel: "threads" },
    currentDraft: { title: "t", body: "Hello Threads", channel: "threads" },
    humanNotes: null,
    rejectionReason: null,
    deferredUntil: null,
    manualPublication: null,
    reviewedBy: "admin",
    governanceReviewedDraftBody: "Hello Threads",
    humanEditedAfterGovernance: false,
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    manuallyPublishedAt: null,
  };
}

async function seedThreadsAccount() {
  const repo = createInMemorySocialRepository();
  const identity = await repo.upsertProviderIdentity({
    provider: "meta",
    kind: "threads_profile",
    externalId: "threads_ext_pub2",
    displayName: "Pub2 Threads",
    channelHints: ["threads"],
  });
  const cred = await repo.createCredentialReference({
    storeHandle: "store:meta:pub2-grant",
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
  return { repo, account, cred };
}

describe("PUB-2 marketing publication control plane", () => {
  it("keeps PUBLICATION_FLOW_INACTIVE hard-off and separates admin path marker", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(THREADS_MARKETING_ADAPTER_NOT_ADMIN_ROUTE).toContain("not_admin");
  });

  it("A: rejects prepare without approved_for_manual_publish", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => ({
        ...approvedReview(),
        status: "pending",
      }),
    });
    await expect(
      orch.prepare({
        candidateId: "cmc_pub2",
        socialAccountId: account.id,
        channel: "threads",
        text: "Hello",
      }),
    ).rejects.toMatchObject({ code: MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED });
  });

  it("B: approved candidate prepares pending publication", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => approvedReview(),
    });
    const prepared = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "Hello Threads",
    });
    expect(prepared.created).toBe(true);
    expect(prepared.publication.status).toBe("pending");
    expect(prepared.publication.humanApprovalRef).toContain("hmr_pub2_1");
    expect(prepared.publication.channel).toBe("threads");
    assertNoRawCredentialMaterial(prepared.publication);
  });

  it("C: same idempotency key reuses publication (no duplicate)", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => approvedReview(),
    });
    const first = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "Same body",
    });
    const second = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "Same body",
    });
    expect(second.created).toBe(false);
    expect(second.publication.id).toBe(first.publication.id);
    const listed = await repo.listPublicationsForAccount(account.id);
    expect(listed).toHaveLength(1);
    expect(
      buildMarketingPublicationIdempotencyKey({
        candidateId: "cmc_pub2",
        socialAccountId: account.id,
        channel: "threads",
        mediaType: "TEXT",
        text: "Same body",
      }),
    ).toBe(first.idempotencyKey);
  });

  it("D/E: Threads adapter maps TEXT and optional IMAGE via injected client", async () => {
    const publish = vi.fn(async (input: { text: string; imageUrl?: string; auth?: unknown }) => {
      expect(input.auth).toEqual({ accessToken: "tok", userId: "uid" });
      return {
        id: input.imageUrl ? "media_img" : "media_txt",
        permalink: "https://threads.net/@x/post/1",
        creationId: "c1",
      };
    });
    const adapter = createThreadsMarketingPublicationAdapter({ publish });
    const store = createInMemoryCredentialStore({
      "store:meta:pub2-grant": { accessToken: "tok", userId: "uid" },
    });
    const credential = await store.resolve(
      createCredentialReference({
        storeHandle: "store:meta:pub2-grant",
        provider: "meta",
        family: "oauth2_user",
      }),
    );

    const textResult = await adapter.publish(
      {
        provider: "meta",
        channel: "threads",
        marketingPost: { channel: "threads", body: "Hello TEXT" },
      },
      { credential },
    );
    expect(textResult.status).toBe("published");
    expect(textResult.externalPostId).toBe("media_txt");
    expect(textResult.sideEffectPerformed).toBe(true);
    expect(publish.mock.calls[0]![0].imageUrl).toBeUndefined();

    const imageResult = await adapter.publish(
      {
        provider: "meta",
        channel: "threads",
        marketingPost: { channel: "threads", body: "Hello IMAGE" },
        imageUrl: "https://cdn.example.com/a.jpg",
      },
      { credential },
    );
    expect(imageResult.externalPostId).toBe("media_img");
    expect(publish.mock.calls[1]![0].imageUrl).toBe("https://cdn.example.com/a.jpg");
  });

  it("F/G: credential store resolves without adapter knowing storage; secrets not on publication", async () => {
    const { repo, account, cred } = await seedThreadsAccount();
    const store = createInMemoryCredentialStore();
    store.put(cred.ref.storeHandle, { accessToken: "secret-token", userId: "user-1" });
    const resolved = await store.resolve(cred.ref);
    expect(resolved.material.accessToken).toBe("secret-token");

    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => approvedReview(),
    });
    const prepared = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "Body",
    });
    expect(() => assertNoRawCredentialMaterial(prepared.publication)).not.toThrow();
    expect(JSON.stringify(prepared.publication)).not.toMatch(/secret-token/);
  });

  it("H: side-effect gate disabled → execute denies without adapter invocation", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => approvedReview(),
    });
    const prepared = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "No live",
    });
    const publish = vi.fn();
    const adapter = createThreadsMarketingPublicationAdapter({ publish });
    const store = createInMemoryCredentialStore({
      "store:meta:pub2-grant": { accessToken: "tok", userId: "uid" },
    });
    const result = await orch.execute({
      publicationId: prepared.publication.id,
      adapter,
      credentialStore: store,
      credentialRef: createCredentialReference({
        storeHandle: "store:meta:pub2-grant",
        provider: "meta",
        family: "oauth2_user",
      }),
      text: "No live",
      // default side effect policy = disabled
    });
    expect(result.outcome).toBe("side_effects_denied");
    expect(publish).not.toHaveBeenCalled();
    expect(result.publication.status).toBe("pending");
  });

  it("I: already published publication does not re-invoke remote", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => approvedReview(),
    });
    const prepared = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "Once",
    });
    await repo.updatePublicationStatus(prepared.publication.id, "published", {
      externalPostId: "already_1",
      externalUrl: "https://threads.net/p/1",
      publishedAt: new Date().toISOString(),
    });
    const publish = vi.fn();
    const adapter = createThreadsMarketingPublicationAdapter({ publish });
    const store = createInMemoryCredentialStore({
      "store:meta:pub2-grant": { accessToken: "tok", userId: "uid" },
    });
    const result = await orch.execute({
      publicationId: prepared.publication.id,
      adapter,
      credentialStore: store,
      credentialRef: createCredentialReference({
        storeHandle: "store:meta:pub2-grant",
        provider: "meta",
        family: "oauth2_user",
      }),
      text: "Once",
      sideEffectPolicy: {
        enabled: true,
        channel: "threads",
        socialAccountId: account.id,
        publicationId: prepared.publication.id,
      },
    });
    expect(result.outcome).toBe("already_published");
    expect(publish).not.toHaveBeenCalled();
  });

  it("J: failed adapter maps to failed publication state", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => approvedReview(),
    });
    const prepared = await orch.prepare({
      candidateId: "cmc_pub2",
      socialAccountId: account.id,
      channel: "threads",
      text: "Will fail",
    });
    const adapter = createThreadsMarketingPublicationAdapter({
      publish: async () => {
        throw new Error("upstream boom");
      },
    });
    const store = createInMemoryCredentialStore({
      "store:meta:pub2-grant": { accessToken: "tok", userId: "uid" },
    });
    const result = await orch.execute({
      publicationId: prepared.publication.id,
      adapter,
      credentialStore: store,
      credentialRef: createCredentialReference({
        storeHandle: "store:meta:pub2-grant",
        provider: "meta",
        family: "oauth2_user",
      }),
      text: "Will fail",
      sideEffectPolicy: {
        enabled: true,
        channel: "threads",
        socialAccountId: account.id,
        publicationId: prepared.publication.id,
      },
    });
    expect(result.outcome).toBe("failed");
    expect(result.publication.status).toBe("failed");
    expect(result.adapterResult?.error?.code).toBeTruthy();
    expect(JSON.stringify(result.publication)).not.toMatch(/tok|accessToken/);
  });

  it("READY-only is insufficient: missing review throws APPROVAL_REQUIRED", async () => {
    const { repo, account } = await seedThreadsAccount();
    const orch = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async () => null,
    });
    await expect(
      orch.prepare({
        candidateId: "cmc_ready_only",
        socialAccountId: account.id,
        channel: "threads",
        text: "x",
      }),
    ).rejects.toBeInstanceOf(MarketingPublicationError);
  });
});
