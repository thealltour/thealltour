/**
 * Display-only stale RUNNING policy.
 * Does NOT mutate DB status. Avoid hard-coding fixture names.
 */

/** Default: running longer than 30 minutes without terminal end → stale display. */
export const DEFAULT_STALE_RUNNING_MS = 30 * 60 * 1000;

export type StaleRunningAssessment = {
  isStale: boolean;
  /** UI label when stale; null when not. */
  label: string | null;
  ageMs: number | null;
};

export function assessStaleRunning(input: {
  status: string;
  startedAt: string;
  endedAt?: string | null;
  nowMs?: number;
  thresholdMs?: number;
}): StaleRunningAssessment {
  const now = input.nowMs ?? Date.now();
  const threshold = input.thresholdMs ?? DEFAULT_STALE_RUNNING_MS;
  if (input.status !== "running" || input.endedAt) {
    return { isStale: false, label: null, ageMs: null };
  }
  const start = Date.parse(input.startedAt);
  if (!Number.isFinite(start)) {
    return { isStale: false, label: null, ageMs: null };
  }
  const ageMs = Math.max(0, now - start);
  if (ageMs < threshold) {
    return { isStale: false, label: null, ageMs };
  }
  return {
    isStale: true,
    label: "오래된 실행",
    ageMs,
  };
}

export function marketingTraceStatusDisplayLabel(
  status: string,
  stale: StaleRunningAssessment | null | undefined,
): string {
  if (status === "running" && stale?.isStale) {
    return "STALE";
  }
  switch (status) {
    case "completed":
      return "COMPLETED";
    case "failed":
      return "FAILED";
    case "partial":
      return "PARTIAL";
    case "running":
      return "RUNNING";
    default:
      return status.toUpperCase();
  }
}
