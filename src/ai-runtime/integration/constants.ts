/** Matches Marketing Cron Hermes timeout (`HERMES_TIMEOUT_MS` in cron-daily-marketing-plan.ts). */
export const DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS = 180_000;

/** Poll interval while waiting for in-memory scheduler job completion. */
export const RUNTIME_COMPLETION_POLL_INTERVAL_MS = 25;

export const AI_RUNTIME_MARKETING_CRON_ENABLED_ENV = "AI_RUNTIME_MARKETING_CRON_ENABLED";

/** When true/1 and Supabase is configured, Cron/Runtime write shared observability events. */
export const AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED_ENV =
  "AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED";

/** Bearer token for Hermes → Runtime OpenAI-compatible inference gateway (localhost/LAN only). */
export const AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV = "AI_RUNTIME_INFERENCE_GATEWAY_TOKEN";

/** Logical model alias Hermes may send; Runtime maps to workload routing. */
export const HERMES_INFERENCE_ALIAS_AUTO = "theallcloud/auto";

/**
 * Spike-only alias: same workload as `theallcloud/auto`, but forces the first
 * Router candidate to fail before provider inference so live fallback is exercised.
 * Honored only when agentId is runtime-spike (gateway spike path).
 */
export const HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE = "theallcloud/auto-fallback-spike";

/**
 * Optional process env to force the same first-candidate failure for all
 * runtime-spike gateway requests (Desktop alias is preferred for scoped E2E).
 */
export const AI_RUNTIME_SPIKE_FORCE_FALLBACK_ENV = "AI_RUNTIME_SPIKE_FORCE_FALLBACK";

/** Attempt.detail when spike controlled failure skips the first candidate. */
export const SPIKE_FORCE_FALLBACK_DETAIL = "spike_force_fallback";

/** Agent id used exclusively by the Hermes inference gateway spike. */
export const RUNTIME_SPIKE_AGENT_ID = "runtime-spike";

/** Observability tag embedded in correlationId for spike requests. */
export const HERMES_INFERENCE_INTEGRATION = "hermes-inference-boundary";
