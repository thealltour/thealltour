import type { RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { RuntimeJobStatus } from "@/ai-runtime/domain/job";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { SchedulerJob } from "@/ai-runtime/scheduler/types";
import type { RuntimeExecutionResult } from "@/ai-runtime/integration/types";

const TERMINAL_STATUSES = new Set<RuntimeJobStatus>(["completed", "failed", "cancelled"]);

export function isTerminalJobStatus(status: RuntimeJobStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function schedulerJobToExecutionResult(job: SchedulerJob): RuntimeExecutionResult {
  if (job.status === "completed" && job.completion) {
    const response: RuntimeResponse = {
      requestId: job.completion.requestId,
      providerId: job.completion.providerId,
      modelId: job.completion.modelId,
      content: job.completion.content,
      usage: job.completion.usage,
      latencyMs: job.completion.latencyMs,
      routing: {
        attempts: [],
        fallbackUsed: false,
      },
    };
    return {
      requestId: job.request.id,
      jobId: job.id,
      status: "completed",
      response,
    };
  }

  if (job.status === "failed" || job.status === "cancelled") {
    const code = (job.lastErrorCode ?? "RUNTIME_ERROR") as RuntimeErrorCode;
    return {
      requestId: job.request.id,
      jobId: job.id,
      status: job.status,
      error: {
        code,
        retryable: code === "TIMEOUT" || code === "QUOTA_EXHAUSTED" || code === "RATE_LIMIT",
      },
    };
  }

  return {
    requestId: job.request.id,
    jobId: job.id,
    status: job.status,
  };
}

export function timeoutExecutionResult(requestId: string, jobId?: string): RuntimeExecutionResult {
  return {
    requestId,
    jobId,
    status: "failed",
    error: {
      code: "TIMEOUT",
      retryable: true,
    },
  };
}
