import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SHORT_VIDEO_BRIEF_CONTRACT,
} from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  createInMemoryShortformVideoRenderJobRepository,
  enqueueShortformVideoRenderJob,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";
import {
  loadShortformVideoWorkerConfig,
  type ShortformVideoWorkerConfig,
} from "@/lib/marketing/assets/shortform/worker/config";
import {
  createDefaultShortformVideoRenderExecutor,
  DisabledShortformVideoRenderExecutor,
} from "@/lib/marketing/assets/shortform/worker/executor";
import { FakeShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/worker/fakeExecutor";
import { buildShortformWorkerHealthReport } from "@/lib/marketing/assets/shortform/worker/health";
import { processShortformVideoRenderQueue } from "@/lib/marketing/assets/shortform/worker/processQueue";
import {
  assertSafeShortformJobId,
  cleanupSuccessfulShortformJobWorkspace,
  createShortformJobWorkspace,
  resolveShortformWorkspaceRoot,
} from "@/lib/marketing/assets/shortform/worker/workspace";
import { SHORTFORM_WORKER_STORAGE_POLICY_V1 } from "@/lib/marketing/assets/shortform/storagePolicy";

const BRIEF_SHA = createHash("sha256").update("sv7-brief").digest("hex");
const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempWorkspace() {
  // Must not use /tmp (SV-1 bulk-media prohibition). Prefer gitignored local cache.
  const base = join(process.cwd(), "node_modules", ".cache", "sv7-workspace");
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, "ws-"));
  tempRoots.push(root);
  return root;
}

function baseConfig(overrides?: Partial<ShortformVideoWorkerConfig>): ShortformVideoWorkerConfig {
  return {
    enabled: true,
    executionMode: "production",
    workerId: "test-worker",
    workspaceRoot: tempWorkspace(),
    maxJobsPerRun: 1,
    leaseMs: 60_000,
    allowFakeExecutor: false,
    ...overrides,
  };
}

async function seedJob(repo: ShortformVideoRenderJobRepository, candidateId = "cmc_sv7") {
  return enqueueShortformVideoRenderJob({
    repository: repo,
    candidateId,
    businessDateKst: "2026-09-11",
    briefContract: SHORT_VIDEO_BRIEF_CONTRACT,
    briefSha256: BRIEF_SHA,
    scenes: [
      {
        sceneId: "scene-001",
        factualVisualRequired: true,
        generatedVideoAllowed: false,
        pick: {
          sourceId: "src_1",
          rightsKind: "provider_license",
          factualMatch: "probable",
          origin: "pexels",
        },
      },
    ],
    scenePicks: [
      {
        sceneId: "scene-001",
        sourceId: "src_1",
        origin: "pexels",
        rightsKind: "provider_license",
        factualMatch: "probable",
        mediaType: "video",
      },
    ],
  });
}

function readyCapacity(workspaceRoot: string) {
  return async () => ({
    workspaceRoot,
    rootPathProbed: workspaceRoot,
    rootFreeBytes: 200 * 1024 * 1024 * 1024,
    rootTotalBytes: 500 * 1024 * 1024 * 1024,
    workspaceUsedBytes: 0,
    decision: {
      status: "READY" as const,
      allowClaimNewJobs: true,
      cleanupRecommended: false,
      workspaceOverBudget: false,
      reasons: [],
    },
  });
}

function blockedCapacity(workspaceRoot: string) {
  return async () => ({
    workspaceRoot,
    rootPathProbed: workspaceRoot,
    rootFreeBytes: SHORTFORM_WORKER_STORAGE_POLICY_V1.blockNewJobsBelowFreeBytes - 1,
    rootTotalBytes: 500 * 1024 * 1024 * 1024,
    workspaceUsedBytes: 0,
    decision: {
      status: "BLOCK_NEW_JOB" as const,
      allowClaimNewJobs: false,
      cleanupRecommended: true,
      workspaceOverBudget: false,
      reasons: ["root_free_below_block_threshold"],
    },
  });
}

describe("SV-7 worker gates", () => {
  it("defaults to disabled and does not claim", async () => {
    const config = loadShortformVideoWorkerConfig({});
    expect(config.enabled).toBe(false);
    expect(config.executionMode).toBe("disabled");
    expect(config.maxJobsPerRun).toBe(1);

    const repo = createInMemoryShortformVideoRenderJobRepository();
    const claimSpy = vi.spyOn(repo, "claimNext");
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ enabled: false, workspaceRoot: tempWorkspace() }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor(),
      probeCapacity: readyCapacity(tempWorkspace()),
    });
    expect(result.skippedReason).toBe("worker_disabled");
    expect(claimSpy).not.toHaveBeenCalled();
    expect(result.claimCalls).toBe(0);
  });

  it("does not claim when executor is not ready", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo);
    const claimSpy = vi.spyOn(repo, "claimNext");
    const ws = tempWorkspace();
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new DisabledShortformVideoRenderExecutor(),
      probeCapacity: readyCapacity(ws),
    });
    expect(result.skippedReason).toBe("executor_not_ready");
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it("production default executor is unready (no claim without SV-8)", () => {
    const executor = createDefaultShortformVideoRenderExecutor({ executionMode: "production" });
    expect(executor.isReady()).toBe(false);
    expect(executor.readinessReason()).toMatch(/sv8/i);
  });

  it("blocks claim when storage decision disallows new jobs", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo);
    const claimSpy = vi.spyOn(repo, "claimNext");
    const ws = tempWorkspace();
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor(),
      probeCapacity: blockedCapacity(ws),
    });
    expect(result.skippedReason).toBe("storage_blocked");
    expect(claimSpy).not.toHaveBeenCalled();
  });

  it("exits cleanly on empty queue", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    const ws = tempWorkspace();
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor(),
      probeCapacity: readyCapacity(ws),
    });
    expect(result.skippedReason).toBe("empty_queue");
    expect(result.claimed).toBe(0);
  });
});

describe("SV-7 worker execution lifecycle", () => {
  it("success path: claim → workspace → markReady → cleanup after READY", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo);
    const requeueSpy = vi.spyOn(repo, "requeueFailed");
    const ws = tempWorkspace();
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor({ behavior: "success", delayMs: 0 }),
      probeCapacity: readyCapacity(ws),
    });
    expect(result.claimed).toBe(1);
    expect(result.processed[0]?.outcome).toBe("ready");
    expect(requeueSpy).not.toHaveBeenCalled();
    expect(result.requeueCalls).toBe(0);
    const jobs = await repo.listForCandidate("cmc_sv7");
    expect(jobs[0]?.status).toBe("READY");
    expect(existsSync(join(ws, "jobs", jobs[0]!.jobId))).toBe(false);
  });

  it("failure path: markFailed, no requeue, retain workspace", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo, "cmc_fail");
    const requeueSpy = vi.spyOn(repo, "requeueFailed");
    const ws = tempWorkspace();
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor({ behavior: "failure", delayMs: 0 }),
      probeCapacity: readyCapacity(ws),
    });
    expect(result.processed[0]?.outcome).toBe("failed");
    expect(requeueSpy).not.toHaveBeenCalled();
    const jobs = await repo.listForCandidate("cmc_fail");
    expect(jobs[0]?.status).toBe("FAILED");
    expect(existsSync(join(ws, "jobs", jobs[0]!.jobId))).toBe(true);
  });

  it("lease lost on markReady does not force overwrite", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo, "cmc_lease");
    const ws = tempWorkspace();
    const originalMarkReady = repo.markReady.bind(repo);
    repo.markReady = async () => ({ ok: false, reason: "ownership_lost", job: null });
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor({ behavior: "success", delayMs: 0 }),
      probeCapacity: readyCapacity(ws),
    });
    expect(result.processed[0]?.outcome).toBe("lease_lost");
    expect(result.processed[0]?.errorCode).toBe("LEASE_LOST");
    void originalMarkReady;
  });

  it("respects maxJobsPerRun=1", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo, "cmc_a");
    await seedJob(repo, "cmc_b");
    const ws = tempWorkspace();
    const result = await processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws, maxJobsPerRun: 1 }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor({ delayMs: 0 }),
      probeCapacity: readyCapacity(ws),
    });
    expect(result.claimed).toBe(1);
    expect(result.claimCalls).toBe(1);
  });

  it("passes abort signal to long-running executor", async () => {
    const repo = createInMemoryShortformVideoRenderJobRepository();
    await seedJob(repo, "cmc_abort");
    const ws = tempWorkspace();
    const abort = new AbortController();
    const run = processShortformVideoRenderQueue({
      config: baseConfig({ workspaceRoot: ws }),
      repository: repo,
      executor: new FakeShortformVideoRenderExecutor({ behavior: "long_running", delayMs: 30_000 }),
      probeCapacity: readyCapacity(ws),
      signal: abort.signal,
    });
    await new Promise((r) => setTimeout(r, 20));
    abort.abort();
    const result = await run;
    expect(["failed", "aborted", "lease_lost"]).toContain(result.processed[0]?.outcome);
  });
});

describe("SV-7 workspace safety + health", () => {
  it("rejects traversal job ids and /tmp bulk roots", () => {
    expect(() => assertSafeShortformJobId("../etc")).toThrow();
    expect(() => assertSafeShortformJobId("a/b")).toThrow();
    expect(() => resolveShortformWorkspaceRoot("/tmp/thealltour-shortform")).toThrow();
    const root = tempWorkspace();
    const ws = createShortformJobWorkspace({
      workspaceRoot: root,
      jobId: "svr_abc",
      metadata: { logicalRunKey: "k", workerId: "w" },
    });
    expect(existsSync(join(ws.stateDir, "job.json"))).toBe(true);
    writeFileSync(join(ws.outputDir, "x.bin"), "x");
    cleanupSuccessfulShortformJobWorkspace(ws);
    expect(existsSync(ws.jobDir)).toBe(false);
  });

  it("health report does not claim and redacts no secrets fields", async () => {
    const ws = tempWorkspace();
    const config = baseConfig({ enabled: false, workspaceRoot: ws });
    const executor = createDefaultShortformVideoRenderExecutor({ executionMode: "disabled" });
    const report = await buildShortformWorkerHealthReport({ config, executor });
    expect(report.enabled).toBe(false);
    expect(report.productionReady).toBe(false);
    expect(report.leaseRenewalSupported).toBe(false);
    expect(report.concurrency).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(/SERVICE_ROLE|API_KEY|secret/i);
  });

  it("default workspace path is not /tmp", () => {
    expect(SHORTFORM_WORKER_STORAGE_POLICY_V1.defaultWorkspacePath).not.toMatch(/^\/tmp/);
    expect(SHORTFORM_WORKER_STORAGE_POLICY_V1.bulkMediaTmpProhibited).toBe(true);
  });
});
