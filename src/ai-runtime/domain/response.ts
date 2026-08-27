import type { TokenUsage, CostUsage } from "@/ai-runtime/domain/usage";

export const RUNTIME_FINISH_REASONS = [
  "stop",
  "length",
  "tool_call",
  "content_filter",
  "error",
  "unknown",
] as const;

export type RuntimeFinishReason = (typeof RUNTIME_FINISH_REASONS)[number];

export const RUNTIME_ROUTE_ATTEMPT_RESULTS = [
  "success",
  "rate_limited",
  "quota_exhausted",
  "timeout",
  "provider_error",
  "rejected",
] as const;

export type RuntimeRouteAttemptResult = (typeof RUNTIME_ROUTE_ATTEMPT_RESULTS)[number];

export interface RuntimeRouteAttempt {
  providerId: string;
  modelId: string;
  startedAt: string;
  result: RuntimeRouteAttemptResult;
  /** Safe routing detail (no prompt/secrets). */
  detail?: string;
}

export interface RuntimeRoutingResult {
  attempts: RuntimeRouteAttempt[];
  fallbackUsed: boolean;
  queueWaitMs?: number;
}

/**
 * Normalized completion for one RuntimeRequest after routing/adapters run.
 * providerId/modelId appear here (after selection), not on the request.
 */
export interface RuntimeResponse {
  requestId: string;
  providerId: string;
  modelId: string;
  content: string;
  usage: TokenUsage;
  cost?: CostUsage;
  latencyMs: number;
  finishReason?: RuntimeFinishReason;
  routing: RuntimeRoutingResult;
  rawMetadata?: Record<string, unknown>;
}
