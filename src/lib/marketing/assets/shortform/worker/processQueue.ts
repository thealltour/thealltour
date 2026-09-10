/**
 * SV-7 worker core: claim → workspace → executor → markReady/markFailed.
 * No automatic requeueFailed. No production media execution.
 */

import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import {
  ownershipFromShortformRenderClaim,
} from "@/lib/marketing/assets/shortform/renderJob/inMemoryRepository";
import type { ShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/repository";
import type { ShortformVideoWorkerConfig } from "@/lib/marketing/assets/shortform/worker/config";
import { SHORTFORM_WORKER_CONCURRENCY } from "@/lib/marketing/assets/shortform/worker/config";
import { probeShortformWorkerCapacity } from "@/lib/marketing/assets/shortform/worker/capacityProbe";
import type { ShortformVideoRenderExecutor } from "@/lib/marketing/assets/shortform/worker/executor";
import {
  cleanupSuccessfulShortformJobWorkspace,
  createShortformJobWorkspace,
  hashClaimTokenForMetadata,
  retainFailedShortformJobWorkspace,
  type ShortformJobWorkspace,
} from "@/lib/marketing/assets/shortform/worker/workspace";

export type ShortformWorkerJobResult = {
  jobId: string;
  logicalRunKey: string;
  outcome:
    | "ready"
    | "failed"
    | "lease_lost"
    | "workspace_error"
    | "aborted";
  errorCode?: string | null;
  errorSummary?: string | null;
};

export type ShortformWorkerRunResult = {
  skippedReason:
    | null
    | "worker_disabled"
    | "executor_not_ready"
    | "storage_blocked"
    | "empty_queue"
    | "dry_run";
  claimed: number;
  processed: ShortformWorkerJobResult[];
  claimCalls: number;
  requeueCalls: number;
  concurrency: typeof SHORTFORM_WORKER_CONCURRENCY;
  maxJobsPerRun: number;
};

export type ProcessShortformVideoRenderQueueDeps = {
  config: ShortformVideoWorkerConfig;
  repository: ShortformVideoRenderJobRepository;
  executor: ShortformVideoRenderExecutor;
  signal?: AbortSignal;
  now?: Date;
  /** Test injection for capacity. */
  probeCapacity?: typeof probeShortformWorkerCapacity;
  createWorkspace?: typeof createShortformJobWorkspace;
  cleanupSuccess?: typeof cleanupSuccessfulShortformJobWorkspace;
  retainFailed?: typeof retainFailedShortformJobWorkspace;
};

async function processOneClaimedJob(input: {
  job: ShortformVideoRenderJob;
  deps: ProcessShortformVideoRenderQueueDeps;
}): Promise<ShortformWorkerJobResult> {
  const { job, deps } = input;
  const signal = deps.signal ?? new AbortController().signal;
  let workspace: ShortformJobWorkspace | null = null;

  try {
    const createWorkspace = deps.createWorkspace ?? createShortformJobWorkspace;
    workspace = createWorkspace({
      workspaceRoot: deps.config.workspaceRoot,
      jobId: job.jobId,
      metadata: {
        logicalRunKey: job.logicalRunKey,
        workerId: deps.config.workerId,
        claimTokenHash: hashClaimTokenForMetadata(job.claimToken),
      },
    });
  } catch (error) {
    const ownership = ownershipFromShortformRenderClaim(job);
    await deps.repository.markFailed({
      logicalRunKey: job.logicalRunKey,
      errorCode: "WORKSPACE_CREATE_FAILED",
      error,
      ownership,
      now: deps.now,
    });
    return {
      jobId: job.jobId,
      logicalRunKey: job.logicalRunKey,
      outcome: "workspace_error",
      errorCode: "WORKSPACE_CREATE_FAILED",
    };
  }

  if (signal.aborted) {
    retainFailedShortformJobWorkspace(workspace);
    const ownership = ownershipFromShortformRenderClaim(job);
    await deps.repository.markFailed({
      logicalRunKey: job.logicalRunKey,
      errorCode: "ABORTED",
      error: new Error("aborted_before_execute"),
      ownership,
      now: deps.now,
    });
    return {
      jobId: job.jobId,
      logicalRunKey: job.logicalRunKey,
      outcome: "aborted",
      errorCode: "ABORTED",
    };
  }

  const execution = await deps.executor.execute({
    job,
    workspace,
    signal,
  });

  const ownership = ownershipFromShortformRenderClaim(job);

  if (!execution.ok) {
    const failed = await deps.repository.markFailed({
      logicalRunKey: job.logicalRunKey,
      errorCode: execution.errorCode,
      error: execution.error,
      ownership,
      now: deps.now,
    });
    const retain = deps.retainFailed ?? retainFailedShortformJobWorkspace;
    retain(workspace);
    if (!failed.ok && failed.reason === "ownership_lost") {
      return {
        jobId: job.jobId,
        logicalRunKey: job.logicalRunKey,
        outcome: "lease_lost",
        errorCode: "LEASE_LOST",
      };
    }
    return {
      jobId: job.jobId,
      logicalRunKey: job.logicalRunKey,
      outcome: "failed",
      errorCode: execution.errorCode,
    };
  }

  const ready = await deps.repository.markReady({
    logicalRunKey: job.logicalRunKey,
    outputArtifactPath: execution.outputArtifactPath,
    ownership,
    now: deps.now,
  });

  if (!ready.ok) {
    if (ready.reason === "ownership_lost") {
      const retain = deps.retainFailed ?? retainFailedShortformJobWorkspace;
      retain(workspace);
      return {
        jobId: job.jobId,
        logicalRunKey: job.logicalRunKey,
        outcome: "lease_lost",
        errorCode: "LEASE_LOST",
      };
    }
    const retain = deps.retainFailed ?? retainFailedShortformJobWorkspace;
    retain(workspace);
    return {
      jobId: job.jobId,
      logicalRunKey: job.logicalRunKey,
      outcome: "failed",
      errorCode: ready.reason,
    };
  }

  // Durable READY first — only then ephemeral cleanup eligible.
  const cleanup = deps.cleanupSuccess ?? cleanupSuccessfulShortformJobWorkspace;
  cleanup(workspace);

  return {
    jobId: job.jobId,
    logicalRunKey: job.logicalRunKey,
    outcome: "ready",
  };
}

/**
 * Bounded single-run worker. Never auto-calls requeueFailed.
 */
export async function processShortformVideoRenderQueue(
  deps: ProcessShortformVideoRenderQueueDeps,
): Promise<ShortformWorkerRunResult> {
  const base: ShortformWorkerRunResult = {
    skippedReason: null,
    claimed: 0,
    processed: [],
    claimCalls: 0,
    requeueCalls: 0,
    concurrency: SHORTFORM_WORKER_CONCURRENCY,
    maxJobsPerRun: deps.config.maxJobsPerRun,
  };

  if (!deps.config.enabled) {
    return { ...base, skippedReason: "worker_disabled" };
  }

  if (deps.config.executionMode === "dry_run") {
    return { ...base, skippedReason: "dry_run" };
  }

  if (!deps.executor.isReady()) {
    return { ...base, skippedReason: "executor_not_ready" };
  }

  const probe = deps.probeCapacity ?? probeShortformWorkerCapacity;
  const capacity = await probe({ workspaceRoot: deps.config.workspaceRoot });
  if (!capacity.decision.allowClaimNewJobs) {
    return { ...base, skippedReason: "storage_blocked" };
  }

  let claimed = 0;
  for (let i = 0; i < deps.config.maxJobsPerRun; i += 1) {
    if (deps.signal?.aborted) break;

    base.claimCalls += 1;
    const job = await deps.repository.claimNext({
      workerId: deps.config.workerId,
      leaseMs: deps.config.leaseMs,
      now: deps.now,
    });
    if (!job) {
      if (claimed === 0) {
        return { ...base, skippedReason: "empty_queue" };
      }
      break;
    }

    claimed += 1;
    base.claimed += 1;
    const result = await processOneClaimedJob({ job, deps });
    base.processed.push(result);
  }

  return base;
}
