import { RuntimeError, type RuntimeErrorCode } from "@/ai-runtime/domain/error";
import {
  DEFAULT_MAX_JOB_ATTEMPTS,
  RETRY_BACKOFF_MS,
} from "@/ai-runtime/scheduler/constants";
import type { SafeDeferReason } from "@/ai-runtime/scheduler/types";

const RETRYABLE_CODES = new Set<RuntimeErrorCode>([
  "QUOTA_EXHAUSTED",
  "RATE_LIMIT",
  "TIMEOUT",
  "PROVIDER_ERROR",
  "MODEL_UNAVAILABLE",
]);

export function mapErrorToDeferReason(code: RuntimeErrorCode): SafeDeferReason {
  switch (code) {
    case "QUOTA_EXHAUSTED":
      return "quota";
    case "RATE_LIMIT":
      return "rate_limit";
    case "TIMEOUT":
      return "timeout";
    case "MODEL_UNAVAILABLE":
    case "PROVIDER_ERROR":
      return "provider_unavailable";
    default:
      return "unknown";
  }
}

export function isRetryableRuntimeError(error: RuntimeError): boolean {
  if (!error.retryable) return false;
  return RETRYABLE_CODES.has(error.code);
}

export function shouldRetryJob(
  error: RuntimeError,
  attempts: number,
  maxAttempts: number = DEFAULT_MAX_JOB_ATTEMPTS,
): boolean {
  if (attempts >= maxAttempts) return false;
  return isRetryableRuntimeError(error);
}

export function backoffMsForAttempt(attempt: number): number {
  const index = Math.max(0, attempt - 1);
  if (index < RETRY_BACKOFF_MS.length) {
    return RETRY_BACKOFF_MS[index]!;
  }
  return RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]!;
}

export function computeNextAvailableAt(input: {
  error: RuntimeError;
  attempts: number;
  now: Date;
}): Date {
  if (input.error.retryAfterMs != null && input.error.retryAfterMs > 0) {
    return new Date(input.now.getTime() + input.error.retryAfterMs);
  }
  return new Date(input.now.getTime() + backoffMsForAttempt(input.attempts));
}
