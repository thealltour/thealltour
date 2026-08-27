import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import type { RuntimeRouter } from "@/ai-runtime/router";
import {
  DEFAULT_MAX_JOB_ATTEMPTS,
  MAX_CONCURRENT_RUNTIME_JOBS,
  SCHEDULER_RECENT_JOBS_LIMIT,
} from "@/ai-runtime/scheduler/constants";
import { createInMemoryRuntimeJobStore } from "@/ai-runtime/scheduler/job-store";
import { executeJobWithRouter } from "@/ai-runtime/scheduler/execution";
import {
  isJobDeferred,
  isJobRunnable,
  pickNextRunnableJob,
} from "@/ai-runtime/scheduler/priority-queue";
import {
  computeNextAvailableAt,
  mapErrorToDeferReason,
  shouldRetryJob,
} from "@/ai-runtime/scheduler/retry-policy";
import type {
  RunAvailableOptions,
  RuntimeJobListFilter,
  RuntimeJobStore,
  RuntimeScheduler,
  SchedulerJob,
  SchedulerRecentJobDto,
  SchedulerSnapshot,
} from "@/ai-runtime/scheduler/types";
import type { RuntimeObservabilityRecorder } from "@/ai-runtime/observability/persistence";

export type RuntimeSchedulerDependencies = {
  router: RuntimeRouter;
  context: ProviderExecutionContext;
  store?: RuntimeJobStore;
  now?: () => Date;
  maxConcurrentJobs?: number;
  maxAttempts?: number;
  /** Best-effort shared telemetry — never blocks execution. */
  observability?: RuntimeObservabilityRecorder;
};

let jobSequence = 0;

function nextJobId(requestId: string): string {
  jobSequence += 1;
  return `job:${requestId}:${jobSequence}`;
}

function toRecentJobDto(job: SchedulerJob): SchedulerRecentJobDto {
  return {
    jobId: job.id,
    agentId: job.request.agentId,
    source: job.request.source,
    workload: job.request.workload,
    priority: job.request.priority,
    status: job.status,
    attempts: job.attempts,
    queuedAt: job.queuedAt,
    availableAt: job.availableAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    lastErrorCode: job.lastErrorCode,
    deferReason: job.deferReason,
    correlationId: job.request.metadata?.correlationId,
    cronJobId: job.request.metadata?.cronJobId,
  };
}

function jobObsFields(job: SchedulerJob) {
  return {
    jobId: job.id,
    requestId: job.request.id,
    correlationId: job.request.metadata?.correlationId,
    agentId: job.request.agentId,
    source: job.request.source,
    workload: job.request.workload,
    priority: job.request.priority,
    attemptCount: job.attempts,
    metadata: {
      cronJobId: job.request.metadata?.cronJobId,
      departmentId: job.request.metadata?.departmentId,
    },
  };
}

export class InMemoryRuntimeScheduler implements RuntimeScheduler {
  private readonly router: RuntimeRouter;
  private readonly context: ProviderExecutionContext;
  private readonly store: RuntimeJobStore;
  private readonly nowFn: () => Date;
  private readonly maxConcurrentJobs: number;
  private readonly maxAttempts: number;
  private readonly observability?: RuntimeObservabilityRecorder;
  private running = 0;

  constructor(deps: RuntimeSchedulerDependencies) {
    this.router = deps.router;
    this.context = deps.context;
    this.store = deps.store ?? createInMemoryRuntimeJobStore();
    this.nowFn = deps.now ?? (() => new Date());
    this.maxConcurrentJobs = deps.maxConcurrentJobs ?? MAX_CONCURRENT_RUNTIME_JOBS;
    this.maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_JOB_ATTEMPTS;
    this.observability = deps.observability;
  }

  private now(): Date {
    return this.nowFn();
  }

  runningCount(): number {
    return this.running;
  }

  async enqueue(request: RuntimeRequest): Promise<SchedulerJob> {
    this.store.pruneTerminal(this.now());

    const existing = this.store.findActiveByRequestId(request.id);
    if (existing) {
      return existing;
    }

    const job: SchedulerJob = {
      id: nextJobId(request.id),
      request,
      status: "queued",
      queuedAt: this.now().toISOString(),
      attempts: 0,
    };

    this.store.save(job);
    this.observability?.jobEnqueued({
      ...jobObsFields(job),
      status: "queued",
      occurredAt: job.queuedAt,
    });
    return job;
  }

  async cancel(jobId: string): Promise<void> {
    const job = this.store.get(jobId);
    if (!job) return;
    if (job.status === "running") return;
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return;
    }

    job.status = "cancelled";
    job.completedAt = this.now().toISOString();
    this.store.save(job);
    this.observability?.jobCancelled({
      ...jobObsFields(job),
      status: "cancelled",
      occurredAt: job.completedAt,
    });
  }

  getJob(jobId: string): SchedulerJob | undefined {
    return this.store.get(jobId);
  }

  listJobs(filter?: RuntimeJobListFilter): SchedulerJob[] {
    return this.store.list(filter);
  }

  snapshot(now = this.now()): SchedulerSnapshot {
    const jobs = this.store.list();
    const hourAgo = now.getTime() - 60 * 60 * 1000;

    let queued = 0;
    let runnable = 0;
    let deferred = 0;
    let running = 0;
    let completedLastHour = 0;
    let failedLastHour = 0;
    let cancelled = 0;

    for (const job of jobs) {
      if (job.status === "queued") {
        queued += 1;
        if (isJobRunnable(job, now)) runnable += 1;
        if (isJobDeferred(job, now)) deferred += 1;
      } else if (job.status === "running" || job.status === "reserved") {
        running += 1;
      } else if (job.status === "cancelled") {
        cancelled += 1;
      } else if (job.status === "completed") {
        const completedAt = job.completedAt ? Date.parse(job.completedAt) : 0;
        if (completedAt >= hourAgo) completedLastHour += 1;
      } else if (job.status === "failed") {
        const completedAt = job.completedAt ? Date.parse(job.completedAt) : 0;
        if (completedAt >= hourAgo) failedLastHour += 1;
      }
    }

    const recent = this.store
      .list({ limit: SCHEDULER_RECENT_JOBS_LIMIT })
      .map(toRecentJobDto);

    return {
      queued,
      runnable,
      deferred,
      running,
      completedLastHour,
      failedLastHour,
      cancelled,
      recent,
    };
  }

  private claimNext(): SchedulerJob | undefined {
    if (this.running >= this.maxConcurrentJobs) return undefined;

    const candidate = pickNextRunnableJob(
      this.store.list({ status: "queued" }),
      this.now(),
    );
    if (!candidate) return undefined;

    candidate.status = "running";
    candidate.startedAt = this.now().toISOString();
    candidate.attempts += 1;
    this.store.save(candidate);
    this.running += 1;
    this.observability?.jobStarted({
      ...jobObsFields(candidate),
      status: "running",
      occurredAt: candidate.startedAt,
    });
    return candidate;
  }

  private finalizeRunning(job: SchedulerJob): SchedulerJob {
    this.running = Math.max(0, this.running - 1);
    this.store.save(job);
    return job;
  }

  private async executeClaimedJob(job: SchedulerJob): Promise<SchedulerJob> {
    const outcome = await executeJobWithRouter({
      job,
      router: this.router,
      context: this.context,
    });

    const now = this.now();

    if (outcome.kind === "success") {
      job.status = "completed";
      job.completedAt = now.toISOString();
      job.lastError = undefined;
      job.lastErrorCode = undefined;
      job.deferReason = undefined;
      job.result = {
        providerId: outcome.response.providerId,
        modelId: outcome.response.modelId,
        latencyMs: outcome.response.latencyMs,
      };
      job.completion = {
        requestId: outcome.response.requestId,
        providerId: outcome.response.providerId,
        modelId: outcome.response.modelId,
        content: outcome.response.content,
        usage: outcome.response.usage,
        latencyMs: outcome.response.latencyMs,
        finishReason: outcome.response.finishReason,
        ...(outcome.response.toolCalls?.length
          ? { toolCalls: outcome.response.toolCalls }
          : {}),
        routing: outcome.response.routing,
      };
      const completed = this.finalizeRunning(job);
      this.observability?.jobCompleted({
        ...jobObsFields(completed),
        status: "completed",
        providerId: outcome.response.providerId,
        modelId: outcome.response.modelId,
        latencyMs: outcome.response.latencyMs,
        inputTokens: outcome.response.usage.inputTokens,
        outputTokens: outcome.response.usage.outputTokens,
        totalTokens: outcome.response.usage.totalTokens,
        usageMissing: outcome.response.rawMetadata?.usageMissing === true,
        fallbackUsed: outcome.response.routing?.fallbackUsed,
        occurredAt: completed.completedAt,
      });
      return completed;
    }

    const error = outcome.error;
    job.lastErrorCode = error.code;
    job.lastError = error.code;

    if (shouldRetryJob(error, job.attempts, this.maxAttempts)) {
      job.status = "queued";
      job.startedAt = undefined;
      job.deferReason = mapErrorToDeferReason(error.code);
      const nextAvailable = computeNextAvailableAt({
        error,
        attempts: job.attempts,
        now,
      });
      job.availableAt = nextAvailable.toISOString();
      const deferred = this.finalizeRunning(job);
      this.observability?.jobDeferred({
        ...jobObsFields(deferred),
        status: "queued",
        errorCode: error.code,
        retryable: error.retryable,
        metadata: {
          ...jobObsFields(deferred).metadata,
          deferReason: deferred.deferReason,
          availableAt: deferred.availableAt,
        },
        occurredAt: now.toISOString(),
      });
      return deferred;
    }

    job.status = "failed";
    job.completedAt = now.toISOString();
    job.deferReason = undefined;
    const failed = this.finalizeRunning(job);
    this.observability?.jobFailed({
      ...jobObsFields(failed),
      status: "failed",
      errorCode: error.code,
      retryable: error.retryable,
      occurredAt: failed.completedAt,
    });
    return failed;
  }

  async runNext(): Promise<SchedulerJob | undefined> {
    const job = this.claimNext();
    if (!job) return undefined;
    return this.executeClaimedJob(job);
  }

  async runAvailable(options: RunAvailableOptions = {}): Promise<SchedulerJob[]> {
    const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
    const completed: SchedulerJob[] = [];

    while (completed.length < limit) {
      const batch: Promise<SchedulerJob>[] = [];

      while (
        batch.length + completed.length < limit &&
        this.running + batch.length < this.maxConcurrentJobs
      ) {
        const job = this.claimNext();
        if (!job) break;
        batch.push(this.executeClaimedJob(job));
      }

      if (batch.length === 0) break;

      const settled = await Promise.all(batch);
      completed.push(...settled);

      const hasRunnable = this.store.list({ status: "queued" }).some((job) => isJobRunnable(job, this.now()));
      if (!hasRunnable) break;
    }

    return completed;
  }
}

export function createRuntimeScheduler(deps: RuntimeSchedulerDependencies): InMemoryRuntimeScheduler {
  return new InMemoryRuntimeScheduler(deps);
}

let defaultScheduler: InMemoryRuntimeScheduler | null = null;

export function getDefaultRuntimeScheduler(): InMemoryRuntimeScheduler {
  if (!defaultScheduler) {
    throw new Error(
      "Default runtime scheduler is not initialized. Call initializeDefaultRuntimeScheduler() first.",
    );
  }
  return defaultScheduler;
}

export function initializeDefaultRuntimeScheduler(
  deps: RuntimeSchedulerDependencies,
): InMemoryRuntimeScheduler {
  defaultScheduler = createRuntimeScheduler(deps);
  return defaultScheduler;
}

export function resetDefaultRuntimeSchedulerForTests(): void {
  defaultScheduler = null;
  jobSequence = 0;
}
