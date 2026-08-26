import type { RuntimeRequest } from "@/ai-runtime/domain/request";

export const RUNTIME_JOB_STATUSES = [
  "queued",
  "reserved",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RuntimeJobStatus = (typeof RUNTIME_JOB_STATUSES)[number];

/**
 * Scheduler-facing job envelope. Domain only — no queue implementation here.
 * `availableAt` is when the job may run again after quota / retry-after.
 */
export interface RuntimeJob {
  id: string;
  request: RuntimeRequest;
  status: RuntimeJobStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  availableAt?: string;
  lastError?: string;
}
