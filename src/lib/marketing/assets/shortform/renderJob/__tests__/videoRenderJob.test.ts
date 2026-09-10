import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS,
  SHORTFORM_VIDEO_RENDER_JOB_CONTRACT,
  SHORTFORM_VIDEO_RENDER_PROFILE_V1,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";
import {
  isEphemeralCleanupEligibleAfterReady,
  SHORTFORM_RENDER_CLEANUP_ORDERING_STEPS,
} from "@/lib/marketing/assets/shortform/renderJob/cleanupOrdering";
import { ShortformVideoRenderJobError } from "@/lib/marketing/assets/shortform/renderJob/errors";
import {
  buildQueuedShortformVideoRenderJob,
  buildShortformVideoRenderInputSnapshot,
  createInMemoryShortformVideoRenderJobRepository,
  enqueueShortformVideoRenderJob,
  ownershipFromShortformRenderClaim,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import { buildShortformVideoRenderLogicalRunKey } from "@/lib/marketing/assets/shortform/renderJob/logicalRunKey";
import { sanitizeShortformVideoRenderErrorSummary } from "@/lib/marketing/assets/shortform/renderJob/sanitize";
import {
  validateShortformRenderEnqueueInput,
} from "@/lib/marketing/assets/shortform/renderJob/validateEnqueue";

const BRIEF_SHA = createHash("sha256").update("brief-v1").digest("hex");

function picks(sourceId = "src_1") {
  return [
    {
      sceneId: "scene-001",
      sourceId,
      origin: "pexels",
      rightsKind: "provider_license",
      factualMatch: "probable",
      mediaType: "video",
    },
  ];
}

function scenes(overrides?: Partial<Parameters<typeof validateShortformRenderEnqueueInput>[0]["scenes"][0]>) {
  return [
    {
      sceneId: "scene-001",
      factualVisualRequired: true,
      generatedVideoAllowed: false,
      pick: {
        sourceId: "src_1",
        rightsKind: "provider_license",
        factualMatch: "probable",
        origin: "pexels",
        mediaType: "video",
      },
      ...overrides,
    },
  ];
}

describe("SV-6 renderability validation", () => {
  it("accepts valid picks including photo_motion", () => {
    expect(
      validateShortformRenderEnqueueInput({
        scenes: scenes({
          factualVisualRequired: false,
          pick: {
            sourceId: "img_1",
            rightsKind: "provider_license",
            factualMatch: "generic",
            origin: "photo_motion",
            mediaType: "image",
          },
        }),
      }).ok,
    ).toBe(true);
  });

  it("blocks missing pick, unknown rights, factual-invalid, generated plan", () => {
    expect(validateShortformRenderEnqueueInput({ scenes: scenes({ pick: null }) }).ok).toBe(false);
    expect(
      validateShortformRenderEnqueueInput({
        scenes: scenes({
          pick: {
            sourceId: "x",
            rightsKind: "unknown",
            factualMatch: "probable",
            origin: "pexels",
          },
        }),
      }).ok,
    ).toBe(false);
    expect(
      validateShortformRenderEnqueueInput({
        scenes: scenes({
          pick: {
            sourceId: "x",
            rightsKind: "provider_license",
            factualMatch: "generic",
            origin: "pexels",
          },
        }),
      }).ok,
    ).toBe(false);
    const generated = validateShortformRenderEnqueueInput({
      scenes: scenes({
        factualVisualRequired: false,
        pick: {
          sourceId: "plan",
          rightsKind: "generated",
          factualMatch: "generic",
          origin: "generated_video_plan",
        },
      }),
    });
    expect(generated.ok).toBe(false);
    if (!generated.ok) {
      expect(generated.issues[0]!.code).toBe("GENERATED_VIDEO_PLAN_UNSUPPORTED");
    }
  });
});

describe("SV-6 enqueue + idempotency", () => {
  it("enqueues QUEUED job and dedupes same logical input", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const first = await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_sv6",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks(),
    });
    expect(first.created).toBe(true);
    expect(first.job.status).toBe("QUEUED");
    expect(first.job.contract).toBe(SHORTFORM_VIDEO_RENDER_JOB_CONTRACT);
    expect(first.job.renderProfile).toBe(SHORTFORM_VIDEO_RENDER_PROFILE_V1);
    expect(first.job.maxAttempts).toBe(DEFAULT_SHORTFORM_VIDEO_RENDER_MAX_ATTEMPTS);

    const second = await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_sv6",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks(),
    });
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
  });

  it("creates a new logical run when selection changes", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const a = await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_sv6b",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks("src_a"),
    });
    const b = await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_sv6b",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes({
        pick: {
          sourceId: "src_b",
          rightsKind: "provider_license",
          factualMatch: "probable",
          origin: "pexels",
        },
      }),
      scenePicks: picks("src_b"),
    });
    expect(a.job.logicalRunKey).not.toBe(b.job.logicalRunKey);
    expect(b.created).toBe(true);
  });

  it("blocks enqueue for generated_video_plan", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await expect(
      enqueueShortformVideoRenderJob({
        repository: repo,
        candidateId: "cmc_block",
        businessDateKst: "2026-09-11",
        briefContract: "short-video-brief-v1",
        briefSha256: BRIEF_SHA,
        scenes: scenes({
          factualVisualRequired: false,
          pick: {
            sourceId: "plan",
            rightsKind: "generated",
            factualMatch: "generic",
            origin: "generated_video_plan",
          },
        }),
        scenePicks: [
          {
            sceneId: "scene-001",
            sourceId: "plan",
            origin: "generated_video_plan",
            rightsKind: "generated",
            factualMatch: "generic",
            mediaType: "generated_video_plan",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "JOB_NOT_RENDERABLE_YET" });
  });
});

describe("SV-6 claim / lease / attempts / completion", () => {
  it("claims oldest eligible and respects active lease", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const now = new Date("2026-09-11T00:00:00.000Z");
    await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_1",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks("s1"),
      now,
    });
    await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_2",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks("s2"),
      now: new Date(now.getTime() + 1000),
    });

    const first = await repo.claimNext({ workerId: "mini-pc-a", now, leaseMs: 60_000 });
    expect(first?.status).toBe("RUNNING");
    expect(first?.attemptCount).toBe(1);
    expect(first?.claimedBy).toBe("mini-pc-a");
    expect(first?.leaseExpiresAt).toBeTruthy();

    const blocked = await repo.claimNext({
      workerId: "mini-pc-b",
      now: new Date(now.getTime() + 1000),
      leaseMs: 60_000,
    });
    // second job still claimable
    expect(blocked?.candidateId).toBe("cmc_2");

    const stillLocked = await repo.claimNext({
      workerId: "mini-pc-c",
      now: new Date(now.getTime() + 1000),
      leaseMs: 60_000,
    });
    expect(stillLocked).toBeNull();
  });

  it("reclaims expired lease and stops after max attempts", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const t0 = new Date("2026-09-11T01:00:00.000Z");
    const { job } = await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_lease",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks(),
      maxAttempts: 2,
      now: t0,
    });

    const c1 = await repo.claimNext({ workerId: "w1", now: t0, leaseMs: 1000 });
    expect(c1?.attemptCount).toBe(1);

    const mid = await repo.claimNext({
      workerId: "w2",
      now: new Date(t0.getTime() + 500),
      leaseMs: 1000,
    });
    expect(mid).toBeNull();

    const c2 = await repo.claimNext({
      workerId: "w2",
      now: new Date(t0.getTime() + 2000),
      leaseMs: 1000,
    });
    expect(c2?.attemptCount).toBe(2);
    expect(c2?.logicalRunKey).toBe(job.logicalRunKey);

    const c3 = await repo.claimNext({
      workerId: "w3",
      now: new Date(t0.getTime() + 5000),
      leaseMs: 1000,
    });
    expect(c3).toBeNull();
  });

  it("marks READY with output path and blocks invalid transitions", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const now = new Date("2026-09-11T02:00:00.000Z");
    await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_ready",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks(),
      now,
    });
    const claimed = await repo.claimNext({ workerId: "w", now, leaseMs: 60_000 });
    expect(claimed).toBeTruthy();
    const ownership = ownershipFromShortformRenderClaim(claimed!);

    const noPath = await repo.markReady({
      logicalRunKey: claimed!.logicalRunKey,
      outputArtifactPath: "  ",
      ownership,
      now,
    });
    expect(noPath.ok).toBe(false);

    const ready = await repo.markReady({
      logicalRunKey: claimed!.logicalRunKey,
      outputArtifactPath: "final/shortform.mp4",
      ownership,
      now,
    });
    expect(ready.ok).toBe(true);
    if (ready.ok) {
      expect(ready.job.status).toBe("READY");
      expect(ready.job.outputArtifactPath).toBe("final/shortform.mp4");
    }

    const reopen = await repo.markFailed({
      logicalRunKey: claimed!.logicalRunKey,
      error: "nope",
      ownership,
      now,
    });
    expect(reopen.ok).toBe(false);
    if (!reopen.ok) {
      expect(reopen.reason).toBe("terminal");
    }
  });

  it("marks FAILED with sanitized bounded error and supports requeue", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const now = new Date("2026-09-11T03:00:00.000Z");
    await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_fail",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks(),
      now,
    });
    const claimed = await repo.claimNext({ workerId: "w", now, leaseMs: 60_000 });
    const ownership = ownershipFromShortformRenderClaim(claimed!);
    const failed = await repo.markFailed({
      logicalRunKey: claimed!.logicalRunKey,
      errorCode: "network timeout",
      error: new Error("Bearer secret-token failed\nstack"),
      ownership,
      now,
    });
    expect(failed.ok).toBe(true);
    if (failed.ok) {
      expect(failed.job.status).toBe("FAILED");
      expect(failed.job.errorSummary).not.toMatch(/secret-token/);
      expect(failed.job.errorSummary!.length).toBeLessThanOrEqual(400);
      expect(failed.job.errorCode).toBe("NETWORK_TIMEOUT");
    }

    const requeued = await repo.requeueFailed({ logicalRunKey: claimed!.logicalRunKey, now });
    expect(requeued.status).toBe("QUEUED");
    expect(requeued.attemptCount).toBe(0);
  });
});

describe("SV-6 cleanup ordering + sanitize + migration SQL", () => {
  it("documents cleanup only after READY durability", () => {
    expect(SHORTFORM_RENDER_CLEANUP_ORDERING_STEPS.at(-1)).toBe("ephemeral_cleanup_eligible");
    expect(
      isEphemeralCleanupEligibleAfterReady({
        jobStatus: "READY",
        durableFinalPersisted: true,
        manifestCommitted: true,
      }),
    ).toBe(true);
    expect(
      isEphemeralCleanupEligibleAfterReady({
        jobStatus: "RUNNING",
        durableFinalPersisted: true,
        manifestCommitted: true,
      }),
    ).toBe(false);
  });

  it("bounds error summary and redacts secret-like fragments", () => {
    const summary = sanitizeShortformVideoRenderErrorSummary(
      "Authorization: abc PEXELS_API_KEY=xyz " + "x".repeat(500),
    );
    expect(summary).not.toMatch(/PEXELS_API_KEY=xyz/);
    expect(summary.length).toBeLessThanOrEqual(400);
  });

  it("logical run key is stable for same inputs", () => {
    const snapshot = buildShortformVideoRenderInputSnapshot({
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenePicks: picks(),
    });
    const a = buildShortformVideoRenderLogicalRunKey({
      candidateId: "cmc",
      briefSha256: snapshot.briefSha256,
      selectionHash: snapshot.selectionHash,
    });
    const b = buildShortformVideoRenderLogicalRunKey({
      candidateId: "cmc",
      briefSha256: snapshot.briefSha256,
      selectionHash: snapshot.selectionHash,
    });
    expect(a).toBe(b);
    expect(buildQueuedShortformVideoRenderJob({
      candidateId: "cmc",
      businessDateKst: "2026-09-11",
      snapshot,
    }).logicalRunKey).toBe(a);
  });

  it("migration SQL contains table, RLS, SKIP LOCKED claim, lease, unique logical key", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260911060000_shortform_video_render_jobs.sql"),
      "utf8",
    );
    expect(sql).toContain("create table if not exists public.shortform_video_render_jobs");
    expect(sql).toContain("uq_shortform_video_render_jobs_logical_run_key");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("claim_shortform_video_render_job");
    expect(sql).toMatch(/for update skip locked/i);
    expect(sql).toContain("lease_expires_at");
    expect(sql).toContain("finalize_shortform_video_render_job_ready");
    expect(sql).toContain("revoke all on public.shortform_video_render_jobs from anon, authenticated");
  });

  it("throws typed error on cancel from READY", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const now = new Date();
    await enqueueShortformVideoRenderJob({
      repository: repo,
      candidateId: "cmc_cancel",
      businessDateKst: "2026-09-11",
      briefContract: "short-video-brief-v1",
      briefSha256: BRIEF_SHA,
      scenes: scenes(),
      scenePicks: picks(),
      now,
    });
    const claimed = await repo.claimNext({ workerId: "w", now, leaseMs: 60_000 });
    await repo.markReady({
      logicalRunKey: claimed!.logicalRunKey,
      outputArtifactPath: "final/out.mp4",
      ownership: ownershipFromShortformRenderClaim(claimed!),
      now,
    });
    await expect(repo.cancel({ logicalRunKey: claimed!.logicalRunKey })).rejects.toBeInstanceOf(
      ShortformVideoRenderJobError,
    );
  });
});
