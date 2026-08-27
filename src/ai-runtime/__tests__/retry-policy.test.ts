import { describe, expect, it } from "vitest";

import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  backoffMsForAttempt,
  computeNextAvailableAt,
  mapErrorToDeferReason,
  shouldRetryJob,
} from "@/ai-runtime/scheduler/retry-policy";
import { DEFAULT_MAX_JOB_ATTEMPTS, RETRY_BACKOFF_MS } from "@/ai-runtime/scheduler/constants";

const NOW = new Date("2026-08-27T03:00:00.000Z");

describe("retry policy", () => {
  it("respects retryAfterMs when present", () => {
    const error = new RuntimeError("QUOTA_EXHAUSTED", "quota", true, 45_000);
    const next = computeNextAvailableAt({ error, attempts: 1, now: NOW });
    expect(next.toISOString()).toBe("2026-08-27T03:00:45.000Z");
  });

  it("uses configured backoff when retryAfterMs is absent", () => {
    const error = new RuntimeError("PROVIDER_ERROR", "upstream", true);
    expect(backoffMsForAttempt(1)).toBe(RETRY_BACKOFF_MS[0]);
    expect(backoffMsForAttempt(2)).toBe(RETRY_BACKOFF_MS[1]);
    const next = computeNextAvailableAt({ error, attempts: 2, now: NOW });
    expect(next.toISOString()).toBe("2026-08-27T03:00:15.000Z");
  });

  it("does not retry non-retryable errors", () => {
    const auth = new RuntimeError("AUTH_ERROR", "bad key", false);
    const invalid = new RuntimeError("INVALID_REQUEST", "bad", false);
    expect(shouldRetryJob(auth, 1, DEFAULT_MAX_JOB_ATTEMPTS)).toBe(false);
    expect(shouldRetryJob(invalid, 1, DEFAULT_MAX_JOB_ATTEMPTS)).toBe(false);
  });

  it("stops retrying after max attempts", () => {
    const error = new RuntimeError("QUOTA_EXHAUSTED", "quota", true, 1_000);
    expect(shouldRetryJob(error, DEFAULT_MAX_JOB_ATTEMPTS, DEFAULT_MAX_JOB_ATTEMPTS)).toBe(false);
  });

  it("maps error codes to safe defer reasons", () => {
    expect(mapErrorToDeferReason("QUOTA_EXHAUSTED")).toBe("quota");
    expect(mapErrorToDeferReason("RATE_LIMIT")).toBe("rate_limit");
    expect(mapErrorToDeferReason("TIMEOUT")).toBe("timeout");
    expect(mapErrorToDeferReason("PROVIDER_ERROR")).toBe("provider_unavailable");
  });
});
