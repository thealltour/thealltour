import type { RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { RuntimeJob, RuntimeJobStatus } from "@/ai-runtime/domain/job";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimePriority } from "@/ai-runtime/domain/priority";
import type { RuntimeRequestSource } from "@/ai-runtime/domain/agent";
import type { TokenUsage } from "@/ai-runtime/domain/usage";
import type { RuntimeFinishReason, RuntimeRoutingResult } from "@/ai-runtime/domain/response";
import type { RuntimeToolCall } from "@/ai-runtime/domain/tools";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";

export type SafeDeferReason =
  | "quota"
  | "rate_limit"
  | "provider_unavailable"
  | "timeout"
  | "unknown";

export type SchedulerJobResult = {
  providerId: string;
  modelId: string;
  latencyMs: number;
};

/** In-memory completion payload for awaitCompletion (not exposed via Admin API). */
export type SchedulerJobCompletion = {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  usage: TokenUsage;
  latencyMs: number;
  finishReason?: RuntimeFinishReason;
  toolCalls?: RuntimeToolCall[];
  routing?: RuntimeRoutingResult;
};

/** Scheduler-extended job envelope (Domain RuntimeJob + safe metadata). */
export interface SchedulerJob extends RuntimeJob {
  lastErrorCode?: RuntimeErrorCode;
  deferReason?: SafeDeferReason;
  result?: SchedulerJobResult;
  completion?: SchedulerJobCompletion;
}

export type RuntimeJobListFilter = {
  status?: RuntimeJobStatus | RuntimeJobStatus[];
  requestId?: string;
  limit?: number;
};

export interface RuntimeJobStore {
  save(job: SchedulerJob): void;
  get(jobId: string): SchedulerJob | undefined;
  findActiveByRequestId(requestId: string): SchedulerJob | undefined;
  list(filter?: RuntimeJobListFilter): SchedulerJob[];
  delete(jobId: string): void;
  clear(): void;
  pruneTerminal(now: Date): void;
}

export type RunAvailableOptions = {
  /** Maximum jobs to execute in this batch (default: unlimited). */
  limit?: number;
};

export interface RuntimeScheduler {
  enqueue(request: RuntimeRequest): Promise<SchedulerJob>;
  runNext(): Promise<SchedulerJob | undefined>;
  runAvailable(options?: RunAvailableOptions): Promise<SchedulerJob[]>;
  cancel(jobId: string): Promise<void>;
  getJob(jobId: string): SchedulerJob | undefined;
  listJobs(filter?: RuntimeJobListFilter): SchedulerJob[];
  snapshot(now?: Date): SchedulerSnapshot;
  runningCount(): number;
}

export type SchedulerSnapshot = {
  queued: number;
  runnable: number;
  deferred: number;
  running: number;
  completedLastHour: number;
  failedLastHour: number;
  cancelled: number;
  recent: SchedulerRecentJobDto[];
};

export type SchedulerRecentJobDto = {
  jobId: string;
  agentId: string;
  source: RuntimeRequestSource;
  workload: WorkloadClass;
  priority: RuntimePriority;
  status: RuntimeJobStatus;
  attempts: number;
  queuedAt: string;
  availableAt?: string;
  startedAt?: string;
  completedAt?: string;
  lastErrorCode?: RuntimeErrorCode;
  deferReason?: SafeDeferReason;
  correlationId?: string;
  cronJobId?: string;
};
