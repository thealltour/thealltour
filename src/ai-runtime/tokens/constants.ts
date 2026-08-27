import type { WorkloadClass } from "@/ai-runtime/domain/workload";

/** Conservative chars-per-token for predominantly ASCII text. */
export const ASCII_CHARS_PER_TOKEN = 3.5;

/** Conservative chars-per-token for non-ASCII (e.g. Korean) text — avoids under-estimation. */
export const NON_ASCII_CHARS_PER_TOKEN = 2.0;

/** Fixed overhead per message (role tags, boundaries). */
export const MESSAGE_BASE_OVERHEAD_TOKENS = 4;

/** Additional overhead by message role. */
export const ROLE_OVERHEAD_TOKENS = {
  system: 2,
  user: 1,
  assistant: 1,
  tool: 6,
} as const;

/** Default safety multiplier applied to raw estimates before reservation. */
export const DEFAULT_SAFETY_MULTIPLIER = 1.2;

/**
 * Workload default output token budgets when `expectedOutputTokens` is absent.
 * Single source of truth — do not duplicate elsewhere.
 */
export const WORKLOAD_DEFAULT_OUTPUT_TOKENS: Record<WorkloadClass, number> = {
  classification: 300,
  extraction: 800,
  summarization: 1500,
  content_draft: 2500,
  reasoning: 2500,
  governance: 2000,
  analysis: 3000,
  manager_decision: 2500,
};

/** Provider-level safety multipliers — all 1.0 until telemetry calibration. */
export const PROVIDER_SAFETY_MULTIPLIER: Record<string, number> = {};

/** Model-level safety multipliers — all 1.0 until telemetry calibration. */
export const MODEL_SAFETY_MULTIPLIER: Record<string, number> = {};

export function resolveProviderSafetyMultiplier(providerId?: string): number {
  if (!providerId) return 1;
  return PROVIDER_SAFETY_MULTIPLIER[providerId] ?? 1;
}

export function resolveModelSafetyMultiplier(modelId?: string): number {
  if (!modelId) return 1;
  return MODEL_SAFETY_MULTIPLIER[modelId] ?? 1;
}
