import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeScheduler } from "@/ai-runtime/scheduler";
import { isJobRunnable } from "@/ai-runtime/scheduler/priority-queue";
import type {
  RuntimeAwaitOptions,
  RuntimeExecutionResult,
  RuntimeExecutor,
  RuntimeSubmission,
} from "@/ai-runtime/integration/types";
import {
  DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS,
  RUNTIME_COMPLETION_POLL_INTERVAL_MS,
} from "@/ai-runtime/integration/constants";
import {
  isTerminalJobStatus,
  schedulerJobToExecutionResult,
  timeoutExecutionResult,
} from "@/ai-runtime/integration/completion";

export type SchedulerRuntimeExecutorDeps = {
  scheduler: RuntimeScheduler;
  defaultTimeoutMs?: number;
  defaultPollIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Thin wrapper — callers enqueue via RuntimeExecutor instead of Scheduler internals.
 */
export class SchedulerRuntimeExecutor implements RuntimeExecutor {
  private readonly scheduler: RuntimeScheduler;
  private readonly defaultTimeoutMs: number;
  private readonly defaultPollIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(deps: SchedulerRuntimeExecutorDeps) {
    this.scheduler = deps.scheduler;
    this.defaultTimeoutMs = deps.defaultTimeoutMs ?? DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS;
    this.defaultPollIntervalMs = deps.defaultPollIntervalMs ?? RUNTIME_COMPLETION_POLL_INTERVAL_MS;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  async submit(request: RuntimeRequest): Promise<RuntimeSubmission> {
    const job = await this.scheduler.enqueue(request);
    return {
      jobId: job.id,
      requestId: request.id,
      status: job.status,
    };
  }

  getSubmission(jobId: string): RuntimeSubmission | undefined {
    const job = this.scheduler.getJob(jobId);
    if (!job) return undefined;
    return {
      jobId: job.id,
      requestId: job.request.id,
      status: job.status,
    };
  }

  async awaitCompletion(
    submission: RuntimeSubmission,
    options: RuntimeAwaitOptions = {},
  ): Promise<RuntimeExecutionResult> {
    const nowFn = options.now ?? (() => new Date());
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const pollIntervalMs = options.pollIntervalMs ?? this.defaultPollIntervalMs;
    const sleep = options.sleep ?? this.sleep;
    const deadline = nowFn().getTime() + timeoutMs;

    while (nowFn().getTime() < deadline) {
      const job = this.scheduler.getJob(submission.jobId);
      if (!job) {
        return timeoutExecutionResult(submission.requestId, submission.jobId);
      }

      if (isTerminalJobStatus(job.status)) {
        return schedulerJobToExecutionResult(job);
      }

      if (job.status === "queued" && isJobRunnable(job, nowFn()) && this.scheduler.runningCount() === 0) {
        await this.scheduler.runNext();
        continue;
      }

      await sleep(pollIntervalMs);
    }

    return timeoutExecutionResult(submission.requestId, submission.jobId);
  }

  async executeAndWait(
    request: RuntimeRequest,
    options: RuntimeAwaitOptions = {},
  ): Promise<RuntimeExecutionResult> {
    const submission = await this.submit(request);
    return this.awaitCompletion(submission, options);
  }
}

export function createRuntimeExecutor(deps: SchedulerRuntimeExecutorDeps): SchedulerRuntimeExecutor {
  return new SchedulerRuntimeExecutor(deps);
}

let defaultExecutor: SchedulerRuntimeExecutor | null = null;

export function initializeDefaultRuntimeExecutor(deps: SchedulerRuntimeExecutorDeps): SchedulerRuntimeExecutor {
  defaultExecutor = createRuntimeExecutor(deps);
  return defaultExecutor;
}

export function getDefaultRuntimeExecutor(): SchedulerRuntimeExecutor {
  if (!defaultExecutor) {
    throw new Error(
      "Default runtime executor is not initialized. Call initializeDefaultRuntimeExecutor() first.",
    );
  }
  return defaultExecutor;
}

export function resetDefaultRuntimeExecutorForTests(): void {
  defaultExecutor = null;
}
