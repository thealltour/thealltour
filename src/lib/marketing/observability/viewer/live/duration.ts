/**
 * Browser-local live duration — do not heartbeat duration into DB/Realtime.
 * Uses startedAt until endedAt arrives.
 */
export function computeLiveDurationMs(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!startedAt) return null;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return null;
  const end = endedAt ? Date.parse(endedAt) : nowMs;
  if (!Number.isFinite(end)) return null;
  return Math.max(0, end - start);
}

export function formatLiveDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
