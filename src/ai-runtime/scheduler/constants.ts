/** Control-plane concurrency cap — not provider quota. */
export const MAX_CONCURRENT_RUNTIME_JOBS = 3;

export const DEFAULT_MAX_JOB_ATTEMPTS = 5;

/** Completed/failed/cancelled terminal jobs retained for observability. */
export const JOB_RETENTION_MS = 48 * 60 * 60 * 1000;

export const JOB_STORE_MAX_ENTRIES = 2_000;

export const SCHEDULER_RECENT_JOBS_LIMIT = 20;

/**
 * Backoff when a retryable error has no retryAfterMs.
 * Index by attempt number (1-based); last value repeats.
 */
export const RETRY_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000] as const;

/** After this wait, queued jobs receive a small aging bonus to avoid starvation. */
export const MAX_PRIORITY_WAIT_MS = 5 * 60 * 1000;

/** Added to effective priority weight per aging step (MAX_PRIORITY_WAIT_MS each). */
export const AGING_PRIORITY_BONUS = 12;

export const MAX_AGING_BONUS = 36;

export const ACTIVE_JOB_STATUSES = ["queued", "reserved", "running"] as const;
