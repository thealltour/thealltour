import type { AgentId, RuntimeRequestSource } from "@/ai-runtime/domain/agent";
import type { RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { RuntimeJobStatus } from "@/ai-runtime/domain/job";
import type { RuntimePriority } from "@/ai-runtime/domain/priority";
import type { RuntimeRequest, RuntimeMessage, RuntimeRoutingHints } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";

/**
 * Input for normalizing caller-built Agent context into a RuntimeRequest.
 * Factory does NOT build prompts, retrieve context, or select provider/model.
 */
export interface RuntimeRequestFactoryInput {
  agentId: AgentId;
  source: RuntimeRequestSource;
  workload: WorkloadClass;
  priority: RuntimePriority;
  messages: RuntimeMessage[];

  /** Organizational trace — preserved when provided by caller. */
  correlationId?: string;
  parentRequestId?: string;

  conversationId?: string;
  roomId?: string;
  handoffId?: string;
  cronJobId?: string;
  departmentId?: string;

  expectedOutputTokens?: number;
  deadlineAt?: string;
  routing?: RuntimeRoutingHints;
}

export type RuntimeRequestFactoryOptions = {
  now?: () => Date;
  /** Override for tests — defaults to new logical inference request id per call. */
  createRequestId?: () => string;
};

/** Result returned immediately after enqueue — not the LLM completion. */
export interface RuntimeSubmission {
  jobId: string;
  requestId: string;
  status: RuntimeJobStatus;
}

/** Future consumer-facing result (persistent store not implemented in STEP 2-5.4A). */
export interface RuntimeExecutionResult {
  requestId: string;
  jobId?: string;
  status: RuntimeJobStatus;
  response?: RuntimeResponse;
  error?: {
    code: RuntimeErrorCode;
    retryable: boolean;
    retryAfterMs?: number;
  };
}

/**
 * Submit-only contract for async execution paths (cron, background orchestration).
 * Interactive paths may use `executeAndWait` / `awaitCompletion`.
 */
export interface RuntimeExecutor {
  submit(request: RuntimeRequest): Promise<RuntimeSubmission>;
  getSubmission(jobId: string): RuntimeSubmission | undefined;
  awaitCompletion(
    submission: RuntimeSubmission,
    options?: RuntimeAwaitOptions,
  ): Promise<RuntimeExecutionResult>;
  executeAndWait(
    request: RuntimeRequest,
    options?: RuntimeAwaitOptions,
  ): Promise<RuntimeExecutionResult>;
}

export type RuntimeAwaitOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => Date;
  /** Injectable sleep for tests (default: setTimeout). */
  sleep?: (ms: number) => Promise<void>;
};

/** @deprecated Use RuntimeExecutor — interactive methods are now on the base interface. */
export interface RuntimeInteractiveExecutor extends RuntimeExecutor {
  executeInteractive?(request: RuntimeRequest): Promise<RuntimeExecutionResult>;
}

export type IntegrationExecutionMode = "ASYNC_SAFE" | "INTERACTIVE_WAIT" | "CALLBACK_REQUIRED";

export type IntegrationPathClassification =
  | "RUNTIME_CANDIDATE"
  | "KEEP_DIRECT"
  | "NON_LLM"
  | "UNCLEAR";
