/** Matches Marketing Cron Hermes timeout (`HERMES_TIMEOUT_MS` in cron-daily-marketing-plan.ts). */
export const DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS = 180_000;

/** Poll interval while waiting for in-memory scheduler job completion. */
export const RUNTIME_COMPLETION_POLL_INTERVAL_MS = 25;

export const AI_RUNTIME_MARKETING_CRON_ENABLED_ENV = "AI_RUNTIME_MARKETING_CRON_ENABLED";
