import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildDraft,
  buildTestCandidate,
  NOW,
} from "@/lib/marketing/assets/__tests__/fixtures";
import { maybeGenerateShortformBriefAndResolve } from "@/lib/marketing/assets/shortform/dailyShortformBridge";
import {
  evaluateShortformRenderReady,
  maybeEnqueueShortformRenderAfterPick,
} from "@/lib/marketing/assets/shortform/renderReady";
import { reconcileDailyShortformBridgeForCandidate } from "@/lib/marketing/assets/shortform/reconcileDailyShortformBridge";
import { createInMemoryShortformVideoRenderJobRepository, ownershipFromShortformRenderClaim } from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import { SHORTFORM_FINAL_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/production/paths";
import { createInMemoryMarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/inMemorySourceCatalogRepository";
import { createInMemoryDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { assertShortformReadyForManualPublish } from "@/lib/marketing/review/assertShortformReadyForManualPublish";
import { HumanReviewPolicyError } from "@/lib/marketing/review/transitions";

const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "cg3-render-ready-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

async function prepareShortformPackage(input?: {
  candidateId?: string;
  businessDateKst?: string;
}) {
  const assetRoot = tempRoot();
  const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
  const jobRepo = createInMemoryShortformVideoRenderJobRepository();
  const candidateRepo = createInMemoryDailyMarketingRunRepository();
  const candidate = buildTestCandidate({
    candidateId: input?.candidateId ?? "cmc_cg3_render",
    businessDateKst: input?.businessDateKst ?? "2026-09-11",
    draft: buildDraft({
      body: "Hook line for travelers.\n\nSecond scene with official guidance.",
    }),
  });
  await candidateRepo.saveCandidate(candidate);

  const bridge = await maybeGenerateShortformBriefAndResolve({
    candidate,
    assetRoot,
    catalog,
    env: {
      MARKETING_ASSET_ROOT: assetRoot,
      PEXELS_API_KEY: "",
      PIXABAY_API_KEY: "",
    },
    now: NOW,
  });
  expect(bridge.shortVideoBriefPersisted).toBe(true);
  expect(bridge.packageRoot).toBeTruthy();

  process.env.MARKETING_ASSET_ROOT = assetRoot;

  return { assetRoot, catalog, jobRepo, candidateRepo, candidate, packageRoot: bridge.packageRoot! };
}

describe("CG-3 render-ready + auto-enqueue", () => {
  beforeEach(() => {
    process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET = "cg3-test-secret";
  });

  it("A: one of two required scenes picked → no RenderJob", async () => {
    const { catalog, jobRepo, candidateRepo, candidate, assetRoot, packageRoot } =
      await prepareShortformPackage({ candidateId: "cmc_cg3_a" });

    const ready0 = await evaluateShortformRenderReady({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
    });
    expect(ready0.shortformIntended).toBe(true);
    expect(ready0.requiredSceneCount).toBeGreaterThanOrEqual(2);
    expect(ready0.renderReady).toBe(false);

    const sceneId = ready0.brief!.scenes[0]!.sceneId;
    const source = await catalog.registerSource({
      sourceKind: "own",
      
      mediaType: "video",
      rightsKind: "owned",
      managedRelativePath: "library/internal/cg3-a.mp4",
      metadata: { factualMatch: "confirmed", pickOrigin: "internal_catalog" },
    });
    await catalog.setScenePick({
      sourceId: source.id,
      candidateId: candidate.candidateId,
      sceneKey: sceneId,
    });

    const afterOne = await maybeEnqueueShortformRenderAfterPick({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
    });
    expect(afterOne.enqueued).toBe(false);
    expect(afterOne.job).toBeNull();
    expect((await jobRepo.listForCandidate(candidate.candidateId)).length).toBe(0);
    expect(existsSync(join(packageRoot, "context/short-video-brief.json"))).toBe(true);
  });

  it("B+C+D+E: final pick enqueues exactly one job; repeats and concurrent-safe", async () => {
    const { catalog, jobRepo, candidateRepo, candidate, assetRoot } =
      await prepareShortformPackage({ candidateId: "cmc_cg3_b" });

    const eval0 = await evaluateShortformRenderReady({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
    });

    for (const scene of eval0.brief!.scenes) {
      const source = await catalog.registerSource({
        sourceKind: "own",
        
        mediaType: "video",
        rightsKind: "owned",
        managedRelativePath: `library/internal/cg3-b-${scene.sceneId}.mp4`,
        metadata: { factualMatch: "confirmed", pickOrigin: "internal_catalog" },
      });
      await catalog.setScenePick({
        sourceId: source.id,
        candidateId: candidate.candidateId,
        sceneKey: scene.sceneId,
      });
    }

    const first = await maybeEnqueueShortformRenderAfterPick({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      now: NOW,
    });
    expect(first.enqueued).toBe(true);
    expect(first.created).toBe(true);
    expect(first.job?.status).toBe("QUEUED");

    const second = await maybeEnqueueShortformRenderAfterPick({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      now: NOW,
    });
    expect(second.enqueued).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job?.jobId).toBe(first.job?.jobId);

    const [concurrentA, concurrentB] = await Promise.all([
      maybeEnqueueShortformRenderAfterPick({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
        now: NOW,
      }),
      maybeEnqueueShortformRenderAfterPick({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
        now: NOW,
      }),
    ]);
    expect(concurrentA.job?.jobId).toBe(first.job?.jobId);
    expect(concurrentB.job?.jobId).toBe(first.job?.jobId);
    expect((await jobRepo.listForCandidate(candidate.candidateId)).length).toBe(1);
  });

  it("F: existing FAILED equivalent job requires operator requeue (no silent replace)", async () => {
    const { catalog, jobRepo, candidateRepo, candidate, assetRoot } =
      await prepareShortformPackage({ candidateId: "cmc_cg3_f" });

    const eval0 = await evaluateShortformRenderReady({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
    });
    for (const scene of eval0.brief!.scenes) {
      const source = await catalog.registerSource({
        sourceKind: "own",
        
        mediaType: "video",
        rightsKind: "owned",
        managedRelativePath: `library/internal/cg3-f-${scene.sceneId}.mp4`,
        metadata: { factualMatch: "confirmed", pickOrigin: "internal_catalog" },
      });
      await catalog.setScenePick({
        sourceId: source.id,
        candidateId: candidate.candidateId,
        sceneKey: scene.sceneId,
      });
    }

    const queued = await maybeEnqueueShortformRenderAfterPick({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      now: NOW,
    });
    expect(queued.job).toBeTruthy();

    const claimed = await jobRepo.claimNext({
      workerId: "cg3-test-worker",
      now: NOW,
    });
    expect(claimed).toBeTruthy();
    const ownership = ownershipFromShortformRenderClaim(claimed!);
    await jobRepo.markFailed({
      logicalRunKey: claimed!.logicalRunKey,
      ownership,
      errorCode: "TEST_FAIL",
      error: "forced failure",
      now: new Date(NOW.getTime() + 1000),
    });

    const afterFail = await maybeEnqueueShortformRenderAfterPick({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      now: new Date(NOW.getTime() + 2000),
    });
    expect(afterFail.enqueued).toBe(false);
    expect(afterFail.skippedReason).toBe("failed_requires_requeue");
    expect(afterFail.job?.status).toBe("FAILED");
    expect((await jobRepo.listForCandidate(candidate.candidateId)).length).toBe(1);

    const requeued = await jobRepo.requeueFailed({
      logicalRunKey: afterFail.job!.logicalRunKey,
      now: new Date(NOW.getTime() + 3000),
    });
    expect(requeued.status).toBe("QUEUED");
    expect(requeued.jobId).toBe(afterFail.job!.jobId);
  });
});

describe("CG-3 approval gate", () => {
  beforeEach(() => {
    process.env.SHORTFORM_CANDIDATE_SELECTION_SECRET = "cg3-test-secret";
  });

  it("rejects shortform approval until READY + durable final; allows when ready", async () => {
    const { catalog, jobRepo, candidateRepo, candidate, assetRoot, packageRoot } =
      await prepareShortformPackage({ candidateId: "cmc_cg3_gate" });

    await expect(
      assertShortformReadyForManualPublish({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
      }),
    ).rejects.toBeInstanceOf(HumanReviewPolicyError);

    const eval0 = await evaluateShortformRenderReady({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
    });
    for (const scene of eval0.brief!.scenes) {
      const source = await catalog.registerSource({
        sourceKind: "own",
        
        mediaType: "video",
        rightsKind: "owned",
        managedRelativePath: `library/internal/cg3-g-${scene.sceneId}.mp4`,
        metadata: { factualMatch: "confirmed", pickOrigin: "internal_catalog" },
      });
      await catalog.setScenePick({
        sourceId: source.id,
        candidateId: candidate.candidateId,
        sceneKey: scene.sceneId,
      });
    }

    const enq = await maybeEnqueueShortformRenderAfterPick({
      candidateId: candidate.candidateId,
      candidate,
      catalog,
      jobRepository: jobRepo,
      repository: candidateRepo,
      env: { MARKETING_ASSET_ROOT: assetRoot },
      now: NOW,
    });
    expect(enq.job?.status).toBe("QUEUED");
    await expect(
      assertShortformReadyForManualPublish({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
      }),
    ).rejects.toThrow(/대기/);

    const claimed = await jobRepo.claimNext({ workerId: "cg3-gate", now: NOW });
    await expect(
      assertShortformReadyForManualPublish({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
      }),
    ).rejects.toThrow(/진행/);

    const ownership = ownershipFromShortformRenderClaim(claimed!);
    await jobRepo.markReady({
      logicalRunKey: claimed!.logicalRunKey,
      ownership,
      outputArtifactPath: SHORTFORM_FINAL_RELATIVE_PATH,
      now: new Date(NOW.getTime() + 1000),
    });

    await expect(
      assertShortformReadyForManualPublish({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
      }),
    ).rejects.toThrow(/산출물/);

    mkdirSync(join(packageRoot, "reel/final"), { recursive: true });
    writeFileSync(join(packageRoot, SHORTFORM_FINAL_RELATIVE_PATH), Buffer.from("fake-mp4"));

    await expect(
      assertShortformReadyForManualPublish({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
        env: { MARKETING_ASSET_ROOT: assetRoot },
      }),
    ).resolves.toBeUndefined();
  });

  it("non-shortform candidate skips gate", async () => {
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const jobRepo = createInMemoryShortformVideoRenderJobRepository();
    const candidateRepo = createInMemoryDailyMarketingRunRepository();
    const candidate = buildTestCandidate({
      candidateId: "cmc_cg3_nonsf",
      contentAssignment: {
        ...buildTestCandidate().contentAssignment,
        formatHints: [{ format: "threads_text", score: 1, rationale: "text" }],
      },
      contentPlan: {
        ...buildTestCandidate().contentPlan!,
        recommendedFormats: [{ format: "threads_text", score: 1, rationale: "text" }],
      },
    });
    await candidateRepo.saveCandidate(candidate);
    await expect(
      assertShortformReadyForManualPublish({
        candidateId: candidate.candidateId,
        candidate,
        catalog,
        jobRepository: jobRepo,
        repository: candidateRepo,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("CG-3 reconciliation", () => {
  it("idempotently backfills bridge for existing candidate", async () => {
    const assetRoot = tempRoot();
    const catalog = createInMemoryMarketingMediaSourceCatalogRepository();
    const candidate = buildTestCandidate({ candidateId: "cmc_cg3_reconcile" });
    const first = await reconcileDailyShortformBridgeForCandidate({
      candidate,
      assetRoot,
      env: { MARKETING_ASSET_ROOT: assetRoot, PEXELS_API_KEY: "", PIXABAY_API_KEY: "" },
      now: NOW,
    });
    expect(first.shortformIntended).toBe(true);
    expect(first.shortVideoBriefPersisted).toBe(true);

    const second = await reconcileDailyShortformBridgeForCandidate({
      candidate,
      assetRoot,
      env: { MARKETING_ASSET_ROOT: assetRoot, PEXELS_API_KEY: "", PIXABAY_API_KEY: "" },
      now: NOW,
    });
    expect(second.shortformIntended).toBe(true);
    expect(["committed", "reused", "skipped"].includes(second.outcome)).toBe(true);
    void catalog;
  });
});
