/**
 * PUB-4: Manual Publication Bridge tests.
 * No remote publish APIs, no CredentialStore, no adapter side effects.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MARKETING_PUBLICATION_ERROR_CODES,
  MarketingPublicationError,
  MANUAL_PUBLICATION_METHOD,
  createInMemorySocialRepository,
  createManualMarketingPublicationBridge,
  createThreadsMarketingPublicationAdapter,
  ensureThreadsMarketingCanaryAccount,
  isManualSocialPublication,
  normalizeExternalPublicationUrl,
} from "@/lib/marketing/social";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import { HUMAN_MARKETING_REVIEW_CONTRACT } from "@/lib/marketing/review/types";

function reviewFixture(
  candidateId: string,
  status: HumanMarketingReview["status"] = "approved_for_manual_publish",
  reviewId = "hmr_pub4_1",
): HumanMarketingReview {
  const now = new Date().toISOString();
  return {
    contract: HUMAN_MARKETING_REVIEW_CONTRACT,
    reviewId,
    candidateId,
    runId: "run_pub4",
    status,
    originalDraft: { title: "t", body: "body", channel: "threads" },
    currentDraft: { title: "t", body: "body", channel: "threads" },
    humanNotes: null,
    rejectionReason: null,
    deferredUntil: null,
    manualPublication: null,
    reviewedBy: "admin",
    governanceReviewedDraftBody: "body",
    humanEditedAfterGovernance: false,
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    manuallyPublishedAt: null,
  };
}

async function seedAccount(repo = createInMemorySocialRepository()) {
  const bound = await ensureThreadsMarketingCanaryAccount(repo, {
    threadsUserId: "1234567890123456",
    displayName: "Canary",
  });
  return { repo, account: bound.account };
}

describe("PUB-4 manual publication bridge", () => {
  it("A: approved candidate + valid account → published SocialPublication", async () => {
    const { repo, account } = await seedAccount();
    const reviews = new Map([["cand_a", reviewFixture("cand_a")]]);
    const persist = vi.fn(async ({ candidateId, manualPublication }) => {
      const current = reviews.get(candidateId)!;
      const next = {
        ...current,
        status: "manually_published" as const,
        manualPublication,
        manuallyPublishedAt: manualPublication.publishedAt ?? null,
      };
      reviews.set(candidateId, next);
      return next;
    });
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async (id) => reviews.get(id) ?? null,
      persistManualReviewPublication: persist,
    });

    const result = await bridge.recordManualMarketingPublication({
      candidateId: "cand_a",
      socialAccountId: account.id,
      channel: "threads",
      externalPostId: "ext_post_1",
      externalUrl: "https://www.threads.net/@x/post/abc",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });

    expect(result.created).toBe(true);
    expect(result.publication.status).toBe("published");
    expect(result.publication.externalPostId).toBe("ext_post_1");
    expect(result.publication.externalUrl).toContain("threads.net");
    expect(result.publication.humanApprovalRef).toContain("hmr_pub4_1");
    expect(result.provenance.publicationMethod).toBe(MANUAL_PUBLICATION_METHOD);
    expect(result.provenance.hermesCreatedRemotePost).toBe(false);
    expect(isManualSocialPublication(result.publication)).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("B: unapproved candidate → rejected", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_b", "pending"),
      persistManualReviewPublication: async () => reviewFixture("cand_b"),
    });
    await expect(
      bridge.recordManualMarketingPublication({
        candidateId: "cand_b",
        socialAccountId: account.id,
        externalUrl: "https://example.com/p/1",
        publishedAt: "2026-09-11T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: MARKETING_PUBLICATION_ERROR_CODES.APPROVAL_REQUIRED });
  });

  it("C: candidate/review mismatch → rejected", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_c"),
      persistManualReviewPublication: async () => reviewFixture("cand_c"),
    });
    await expect(
      bridge.recordManualMarketingPublication({
        candidateId: "cand_c",
        humanReviewId: "wrong_review",
        socialAccountId: account.id,
        externalPostId: "ext_c",
        publishedAt: "2026-09-11T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: MARKETING_PUBLICATION_ERROR_CODES.REVIEW_MISMATCH });
  });

  it("D: wrong provider/account channel → rejected", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_d"),
      persistManualReviewPublication: async () => reviewFixture("cand_d"),
    });
    await expect(
      bridge.recordManualMarketingPublication({
        candidateId: "cand_d",
        socialAccountId: account.id,
        channel: "instagram",
        externalPostId: "ext_d",
        publishedAt: "2026-09-11T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: MARKETING_PUBLICATION_ERROR_CODES.CHANNEL_MISMATCH });
  });

  it("E: same manual registration repeated → same publication", async () => {
    const { repo, account } = await seedAccount();
    const reviews = new Map([["cand_e", reviewFixture("cand_e")]]);
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async (id) => reviews.get(id) ?? null,
      persistManualReviewPublication: async ({ candidateId, manualPublication }) => {
        const current = reviews.get(candidateId)!;
        const next = {
          ...current,
          status: "manually_published" as const,
          manualPublication,
        };
        reviews.set(candidateId, next);
        return next;
      },
    });
    const first = await bridge.recordManualMarketingPublication({
      candidateId: "cand_e",
      socialAccountId: account.id,
      externalPostId: "ext_e",
      externalUrl: "https://example.com/e",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    const second = await bridge.recordManualMarketingPublication({
      candidateId: "cand_e",
      socialAccountId: account.id,
      externalPostId: "ext_e",
      externalUrl: "https://example.com/e",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    expect(second.publication.id).toBe(first.publication.id);
    expect(second.reused).toBe(true);
    expect(second.created).toBe(false);
    const listed = await repo.listPublicationsForAccount(account.id);
    expect(listed).toHaveLength(1);
  });

  it("F: same account + same externalPostId → duplicate prevented", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async (id) => reviewFixture(id),
      persistManualReviewPublication: async ({ candidateId, manualPublication }) => ({
        ...reviewFixture(candidateId, "manually_published"),
        manualPublication,
      }),
    });
    await bridge.recordManualMarketingPublication({
      candidateId: "cand_f1",
      socialAccountId: account.id,
      externalPostId: "shared_ext",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    await expect(
      bridge.recordManualMarketingPublication({
        candidateId: "cand_f2",
        socialAccountId: account.id,
        externalPostId: "shared_ext",
        publishedAt: "2026-09-11T13:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: MARKETING_PUBLICATION_ERROR_CODES.CONFLICTING_REMOTE_IDENTITY,
    });
  });

  it("G: externalPostId absent but same normalized URL → duplicate prevented", async () => {
    const { repo, account } = await seedAccount();
    expect(normalizeExternalPublicationUrl("https://Example.com/post/1/")).toBe(
      "https://example.com/post/1",
    );
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async (id) => reviewFixture(id),
      persistManualReviewPublication: async ({ candidateId, manualPublication }) => ({
        ...reviewFixture(candidateId, "manually_published"),
        manualPublication,
      }),
    });
    await bridge.recordManualMarketingPublication({
      candidateId: "cand_g1",
      socialAccountId: account.id,
      externalUrl: "https://Example.com/post/1/",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    await expect(
      bridge.recordManualMarketingPublication({
        candidateId: "cand_g2",
        socialAccountId: account.id,
        externalUrl: "https://example.com/post/1",
        publishedAt: "2026-09-11T13:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: MARKETING_PUBLICATION_ERROR_CODES.CONFLICTING_REMOTE_IDENTITY,
    });
  });

  it("H: manual path does NOT invoke PublicationAdapter", async () => {
    const { repo, account } = await seedAccount();
    const publish = vi.fn(async () => ({
      id: "should-not-run",
      permalink: null,
      creationId: "x",
    }));
    const adapter = createThreadsMarketingPublicationAdapter({ publish });
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_h"),
      persistManualReviewPublication: async ({ manualPublication }) => ({
        ...reviewFixture("cand_h", "manually_published"),
        manualPublication,
      }),
    });
    await bridge.recordManualMarketingPublication({
      candidateId: "cand_h",
      socialAccountId: account.id,
      externalPostId: "ext_h",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    expect(publish).not.toHaveBeenCalled();
    void adapter;
  });

  it("I: no CredentialStore resolution required", async () => {
    const { repo, account } = await seedAccount();
    // Bridge deps intentionally omit CredentialStore.
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_i"),
      persistManualReviewPublication: async ({ manualPublication }) => ({
        ...reviewFixture("cand_i", "manually_published"),
        manualPublication,
      }),
    });
    const result = await bridge.recordManualMarketingPublication({
      candidateId: "cand_i",
      socialAccountId: account.id,
      externalUrl: "https://example.com/i",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    expect(result.publication.status).toBe("published");
    expect(JSON.stringify(result.publication)).not.toMatch(/accessToken|THREADS_ACCESS_TOKEN/);
  });

  it("J: published record contains insight linkage fields", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_j"),
      persistManualReviewPublication: async ({ manualPublication }) => ({
        ...reviewFixture("cand_j", "manually_published"),
        manualPublication,
      }),
    });
    const result = await bridge.recordManualMarketingPublication({
      candidateId: "cand_j",
      socialAccountId: account.id,
      externalPostId: "ext_j",
      externalUrl: "https://example.com/j",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    expect(result.publication.provider).toBe("meta");
    expect(result.publication.channel).toBe("threads");
    expect(result.publication.socialAccountId).toBe(account.id);
    expect(result.publication.externalPostId).toBe("ext_j");
    expect(result.publication.externalUrl).toBe("https://example.com/j");
    expect(result.publication.publishedAt).toBe("2026-09-11T12:00:00.000Z");
    expect(result.publication.providerStatusMetadata.candidateId).toBe("cand_j");
    expect(result.publication.humanApprovalRef).toContain("cand_j");
    expect(result.publication.providerStatusMetadata.publicationMethod).toBe("manual");
  });

  it("K: conflicting remote identity update fails safely", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_k"),
      persistManualReviewPublication: async ({ manualPublication }) => ({
        ...reviewFixture("cand_k", "manually_published"),
        manualPublication,
      }),
    });
    await bridge.recordManualMarketingPublication({
      candidateId: "cand_k",
      socialAccountId: account.id,
      externalPostId: "ext_k1",
      externalUrl: "https://example.com/k1",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    await expect(
      bridge.recordManualMarketingPublication({
        candidateId: "cand_k",
        socialAccountId: account.id,
        externalPostId: "ext_k2",
        externalUrl: "https://example.com/k2",
        publishedAt: "2026-09-11T13:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(MarketingPublicationError);
  });

  it("allows filling missing externalPostId on same URL", async () => {
    const { repo, account } = await seedAccount();
    const bridge = createManualMarketingPublicationBridge({
      repository: repo,
      loadHumanReview: async () => reviewFixture("cand_fill"),
      persistManualReviewPublication: async ({ manualPublication }) => ({
        ...reviewFixture("cand_fill", "manually_published"),
        manualPublication,
      }),
    });
    const first = await bridge.recordManualMarketingPublication({
      candidateId: "cand_fill",
      socialAccountId: account.id,
      externalUrl: "https://example.com/fill",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    const second = await bridge.recordManualMarketingPublication({
      candidateId: "cand_fill",
      socialAccountId: account.id,
      externalUrl: "https://example.com/fill",
      externalPostId: "filled_later",
      publishedAt: "2026-09-11T12:00:00.000Z",
    });
    expect(second.publication.id).toBe(first.publication.id);
    expect(second.publication.externalPostId).toBe("filled_later");
    expect(second.updated).toBe(true);
  });
});
