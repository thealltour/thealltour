/**
 * PUB-3: production CredentialStore + Threads canary account binding tests.
 * No live Graph API calls in this suite.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS,
  assertNoRawCredentialMaterial,
  assertThreadsCredentialMatchesAccount,
  createInMemorySocialRepository,
  createMarketingPublicationOrchestrator,
  createRuntimeEnvCredentialStore,
  createThreadsMarketingCanaryCredentialReference,
  createThreadsMarketingPublicationAdapter,
  ensureThreadsMarketingCanaryAccount,
  inspectThreadsMarketingRuntimeSecrets,
  isMarketingPublicationSideEffectAllowed,
  THREADS_MARKETING_CANARY_STORE_HANDLE,
} from "@/lib/marketing/social";
import { preflightThreadsAuth } from "@/lib/threads/threadsAuthPreflight";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import { HUMAN_MARKETING_REVIEW_CONTRACT } from "@/lib/marketing/review/types";

function approvedReview(candidateId: string): HumanMarketingReview {
  const now = new Date().toISOString();
  return {
    contract: HUMAN_MARKETING_REVIEW_CONTRACT,
    reviewId: "hmr_pub3",
    candidateId,
    runId: "run_pub3",
    status: "approved_for_manual_publish",
    originalDraft: { title: "t", body: "preflight only", channel: "threads" },
    currentDraft: { title: "t", body: "preflight only", channel: "threads" },
    humanNotes: null,
    rejectionReason: null,
    deferredUntil: null,
    manualPublication: null,
    reviewedBy: "tester",
    governanceReviewedDraftBody: "preflight only",
    humanEditedAfterGovernance: false,
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    manuallyPublishedAt: null,
  };
}

describe("PUB-3 Threads credential store + account binding", () => {
  it("A: valid Threads CredentialReference resolves from runtime env", async () => {
    const store = createRuntimeEnvCredentialStore({
      env: {
        THREADS_ACCESS_TOKEN: "test-access-token-value",
        THREADS_USER_ID: "1234567890123456",
      },
    });
    const ref = createThreadsMarketingCanaryCredentialReference();
    const resolved = await store.resolve(ref);
    expect(resolved.kind).toBe("adapter_credential");
    expect(resolved.material.accessToken).toBe("test-access-token-value");
    expect(resolved.material.userId).toBe("1234567890123456");
  });

  it("B: missing secret fails closed", async () => {
    const store = createRuntimeEnvCredentialStore({
      env: {
        THREADS_USER_ID: "1234567890123456",
      },
    });
    const ref = createThreadsMarketingCanaryCredentialReference();
    await expect(store.resolve(ref)).rejects.toThrow(/missing runtime secrets/);
  });

  it("C: invalid reference fails closed", async () => {
    const store = createRuntimeEnvCredentialStore({
      env: {
        THREADS_ACCESS_TOKEN: "tok",
        THREADS_USER_ID: "123",
      },
    });
    await expect(
      store.resolve({
        kind: "credential_reference",
        storeHandle: "unknown-handle-xyz",
        provider: "meta",
        family: "oauth2_user",
      }),
    ).rejects.toThrow(/unknown storeHandle/);
  });

  it("D: adapter obtains credential only via CredentialStore material", async () => {
    const publish = vi.fn(async () => ({
      id: "media-1",
      permalink: "https://threads.net/@x/post/1",
      creationId: "c1",
    }));
    const adapter = createThreadsMarketingPublicationAdapter({ publish });
    const store = createRuntimeEnvCredentialStore({
      env: {
        THREADS_ACCESS_TOKEN: "adapter-token",
        THREADS_USER_ID: "999",
      },
    });
    const credential = await store.resolve(createThreadsMarketingCanaryCredentialReference());
    await adapter.publish(
      {
        provider: "meta",
        channel: "threads",
        socialAccountId: "sa_1",
        marketingPost: { body: "hello canary" },
      },
      { credential },
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hello canary",
        auth: { accessToken: "adapter-token", userId: "999" },
      }),
    );
    // Adapter path must not consult env itself for the marketing canary.
    expect(process.env.THREADS_ACCESS_TOKEN).not.toBe("adapter-token");
  });

  it("E: secret is not persisted on SocialPublication / domain objects", async () => {
    const repo = createInMemorySocialRepository();
    const bound = await ensureThreadsMarketingCanaryAccount(repo, {
      threadsUserId: "1234567890123456",
      displayName: "Canary",
    });
    assertNoRawCredentialMaterial(bound.account);
    assertNoRawCredentialMaterial(bound.grant);
    assertNoRawCredentialMaterial(bound.credentialRef);
    expect(JSON.stringify(bound)).not.toMatch(/accessToken|access_token|THREADS_ACCESS_TOKEN/);
  });

  it("F: account binding resolves correct provider identity", async () => {
    const repo = createInMemorySocialRepository();
    const bound = await ensureThreadsMarketingCanaryAccount(repo, {
      threadsUserId: "1234567890123456",
    });
    expect(bound.created).toBe(true);
    expect(bound.account.channel).toBe("threads");
    expect(bound.account.provider).toBe("meta");
    expect(bound.account.externalIdentityId).toBe("1234567890123456");
    expect(bound.credentialRef.storeHandle).toBe(THREADS_MARKETING_CANARY_STORE_HANDLE);

    const auth = await repo.resolveAccountAuthorization(bound.account.id);
    expect(auth.usable).toBe(true);
    if (!auth.usable) throw new Error("expected usable");
    expect(auth.resolved.identity.externalId).toBe("1234567890123456");
    expect(auth.resolved.credentialRef.storeHandle).toBe(THREADS_MARKETING_CANARY_STORE_HANDLE);

    const again = await ensureThreadsMarketingCanaryAccount(repo, {
      threadsUserId: "1234567890123456",
    });
    expect(again.created).toBe(false);
    expect(again.account.id).toBe(bound.account.id);
  });

  it("G: unrelated account cannot use the credential identity", async () => {
    const store = createRuntimeEnvCredentialStore({
      env: {
        THREADS_ACCESS_TOKEN: "tok",
        THREADS_USER_ID: "111",
      },
    });
    const credential = await store.resolve(createThreadsMarketingCanaryCredentialReference());
    expect(() =>
      assertThreadsCredentialMatchesAccount(credential.material, "222"),
    ).toThrow(/cross-account denied/);
    expect(() =>
      assertThreadsCredentialMatchesAccount(credential.material, "111"),
    ).not.toThrow();
  });

  it("H: live side-effect gate still denies publishing", async () => {
    const repo = createInMemorySocialRepository();
    const bound = await ensureThreadsMarketingCanaryAccount(repo, {
      threadsUserId: "1234567890123456",
    });
    const publish = vi.fn(async () => ({
      id: "should-not-run",
      permalink: null,
      creationId: "x",
    }));
    const adapter = createThreadsMarketingPublicationAdapter({ publish });
    const store = createRuntimeEnvCredentialStore({
      env: {
        THREADS_ACCESS_TOKEN: "tok",
        THREADS_USER_ID: "1234567890123456",
      },
    });

    const orchestrator = createMarketingPublicationOrchestrator({
      repository: repo,
      loadApprovedHumanReview: async (candidateId) => approvedReview(candidateId),
    });
    const prepared = await orchestrator.prepare({
      candidateId: "cand_pub3",
      socialAccountId: bound.account.id,
      channel: "threads",
      text: "preflight only",
    });
    const executed = await orchestrator.execute({
      publicationId: prepared.publication.id,
      adapter,
      credentialStore: store,
      credentialRef: bound.credentialRef,
      text: "preflight only",
      sideEffectPolicy: DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS,
    });
    expect(executed.outcome).toBe("side_effects_denied");
    expect(publish).not.toHaveBeenCalled();
    expect(
      isMarketingPublicationSideEffectAllowed(DEFAULT_MARKETING_PUBLICATION_SIDE_EFFECTS, {
        channel: "threads",
        socialAccountId: bound.account.id,
        publicationId: prepared.publication.id,
      }),
    ).toBe(false);
  });

  it("inspectThreadsMarketingRuntimeSecrets reports presence only", () => {
    const missing = inspectThreadsMarketingRuntimeSecrets({});
    expect(missing.runtimeSecretsConfigured).toBe(false);
    expect(missing.missingRuntimeNames).toEqual(["THREADS_ACCESS_TOKEN", "THREADS_USER_ID"]);

    const ok = inspectThreadsMarketingRuntimeSecrets({
      THREADS_ACCESS_TOKEN: "x",
      THREADS_USER_ID: "1",
      THREADS_APP_ID: "2",
      THREADS_APP_SECRET: "3",
    });
    expect(ok.runtimeSecretsConfigured).toBe(true);
    expect(ok.oauthAppConfigured).toBe(true);
  });

  it("auth preflight uses GET profile and never posts", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/1234567890123456");
      expect(url).toContain("fields=id%2Cusername");
      expect(url).not.toContain("threads_publish");
      return new Response(JSON.stringify({ id: "1234567890123456", username: "canary" }), {
        status: 200,
      });
    });
    const result = await preflightThreadsAuth({
      accessToken: "tok",
      userId: "1234567890123456",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(result.remoteAuthVerified).toBe(true);
    expect(result.accountIdentityValid).toBe(true);
    expect(result.username).toBe("canary");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
