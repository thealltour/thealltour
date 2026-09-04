/**
 * Classify Node spawnSync failures for Hermes profile oneshots.
 * Timeout must never be reported as "exited null".
 */

export type HermesSpawnSyncResultLike = {
  status: number | null;
  signal: NodeJS.Signals | string | null;
  error?: (Error & { code?: string | number }) | null;
  stderr?: string | null;
  stdout?: string | null;
};

export function resolveMarketingCronHermesTimeoutMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  fallbackMs = 180_000,
): number {
  const raw = env.MARKETING_CRON_HERMES_TIMEOUT_MS?.trim();
  if (!raw) return fallbackMs;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1_000) return fallbackMs;
  return Math.floor(parsed);
}

function spawnDetailTail(result: HermesSpawnSyncResultLike, limit = 400): string {
  return (result.stderr || result.stdout || "").trim().slice(0, limit);
}

/**
 * Build a concise operator-safe error message for a failed Hermes profile invoke.
 */
export function formatHermesProfileFailure(
  profile: string,
  result: HermesSpawnSyncResultLike,
  timeoutMs: number,
): string {
  const code =
    result.error && typeof result.error === "object" && "code" in result.error
      ? String(result.error.code ?? "")
      : "";
  const detail = spawnDetailTail(result);

  if (code === "ETIMEDOUT") {
    return `${profile} timed out after ${timeoutMs}ms`;
  }

  if (result.status == null && result.signal) {
    const signal = String(result.signal);
    return detail
      ? `${profile} terminated by signal ${signal}: ${detail}`
      : `${profile} terminated by signal ${signal}`;
  }

  if (result.error && result.status == null && !result.signal) {
    const message = result.error.message?.trim() || "unknown_spawn_error";
    return `${profile} spawn failed: ${message}`;
  }

  if (result.status != null && result.status !== 0) {
    return detail
      ? `${profile} exited ${result.status}: ${detail}`
      : `${profile} exited ${result.status}`;
  }

  // status null without signal/error — still avoid the opaque "exited null" phrasing
  return detail ? `${profile} failed: ${detail}` : `${profile} failed with unknown process status`;
}

export function assertHermesSpawnSyncSuccess(
  profile: string,
  result: HermesSpawnSyncResultLike,
  timeoutMs: number,
): string {
  const ok = result.status === 0 && !result.error && !result.signal;
  if (!ok) {
    throw new Error(formatHermesProfileFailure(profile, result, timeoutMs));
  }
  return result.stdout ?? "";
}
