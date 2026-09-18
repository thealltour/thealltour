/**
 * Classify Node spawnSync failures for Hermes profile oneshots.
 * Timeout must never be reported as "exited null".
 */

import { spawn } from "node:child_process";

export type HermesSpawnSyncResultLike = {
  status: number | null;
  signal: NodeJS.Signals | string | null;
  error?: (Error & { code?: string | number }) | null;
  stderr?: string | null;
  stdout?: string | null;
};

export function resolveMarketingCronHermesTimeoutMs(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  fallbackMs = 300_000,
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

/** Hermes sometimes exits 0 while returning a transport/config error as the "response". */
const HERMES_FALSE_SUCCESS_BODY_RE =
  /^(HTTP\s+\d{3}\b|No LLM provider configured|No models provided|unauthorized|agent failed:)/i;

export function isHermesFalseSuccessBody(stdout: string | null | undefined): boolean {
  const text = (stdout ?? "").trim();
  if (!text) return true;
  return HERMES_FALSE_SUCCESS_BODY_RE.test(text);
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
  const stdout = result.stdout ?? "";
  if (isHermesFalseSuccessBody(stdout)) {
    const detail = spawnDetailTail(result) || stdout.trim() || "empty stdout";
    throw new Error(
      `${profile} returned no usable model output (${detail.slice(0, 240)}). Check ~/.hermes/profiles/${profile}/config.yaml model provider.`,
    );
  }
  return stdout;
}

/**
 * Non-blocking Hermes profile oneshot — keeps Next.js event loop free during long CS calls.
 * Prefer this over spawnSync in HTTP request handlers (channel-regenerate, etc.).
 */
export function spawnHermesProfileAsync(input: {
  hermesBin: string;
  profile: string;
  prompt: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}): Promise<string> {
  const { hermesBin, profile, prompt, timeoutMs } = input;
  const env = input.env ?? process.env;

  return new Promise((resolve, reject) => {
    const child = spawn(hermesBin, ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt], {
      env: { ...env, HERMES_HOME: env.HERMES_HOME ?? "/home/ysh/.hermes" },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5_000).unref?.();
      finish(() => reject(new Error(`${profile} timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.on("error", (error) => {
      finish(() =>
        reject(
          new Error(
            formatHermesProfileFailure(profile, { status: null, signal: null, error, stderr, stdout }, timeoutMs),
          ),
        ),
      );
    });
    child.on("close", (status, signal) => {
      finish(() => {
        try {
          resolve(
            assertHermesSpawnSyncSuccess(
              profile,
              { status, signal, stdout, stderr },
              timeoutMs,
            ),
          );
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/** Default attempts for a single Hermes profile invoke (initial + 2 retries). */
export const HERMES_INVOKE_MAX_ATTEMPTS_DEFAULT = 3;

/**
 * Transport failures worth retrying — the gateway/provider was momentarily unavailable.
 * Config errors (ENOENT/EACCES) and model refusals are NOT retried: a second identical
 * call would fail identically and only burn the run's wall-clock budget.
 */
const RETRYABLE_FAILURE_PATTERNS: RegExp[] = [
  /timed out after \d+ms/i,
  /terminated by signal (SIGKILL|SIGTERM|SIGABRT)/i,
  /\b(ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|EPIPE|EAGAIN|ENETUNREACH|EHOSTUNREACH)\b/,
  /socket hang up|fetch failed|network error|connection (closed|reset)/i,
  /\b(429|500|502|503|504)\b/,
  /rate.?limit|too many requests|overloaded|temporarily unavailable|service unavailable/i,
  /upstream|deadline exceeded|stream (closed|ended) unexpectedly/i,
];

const NON_RETRYABLE_FAILURE_PATTERNS: RegExp[] = [
  /\b(ENOENT|EACCES|EPERM|ENOTDIR)\b/,
  /spawn failed/i,
  /\b(401|403)\b|unauthorized|forbidden|invalid api key|permission denied/i,
  /no (llm )?provider configured|no models provided|returned no usable model output|channel_editor_hermes_config_missing/i,
];

export function isRetryableHermesFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return false;
  if (NON_RETRYABLE_FAILURE_PATTERNS.some((pattern) => pattern.test(message))) return false;
  return RETRYABLE_FAILURE_PATTERNS.some((pattern) => pattern.test(message));
}

export type HermesInvokeRetryAttempt = {
  profile: string;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  elapsedMs: number;
  message: string;
};

export type InvokeHermesProfileWithRetryInput = {
  hermesBin: string;
  profile: string;
  prompt: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  maxAttempts?: number;
  /**
   * Wall-clock ceiling across all attempts. A retry is skipped when the remaining
   * budget cannot fit another full timeout, so a slow profile cannot multiply the
   * run duration past the systemd/lease window.
   */
  totalBudgetMs?: number;
  baseBackoffMs?: number;
  onRetry?: (attempt: HermesInvokeRetryAttempt) => void;
  /** Injectable for tests. */
  spawn?: (input: {
    hermesBin: string;
    profile: string;
    prompt: string;
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
  }) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });

/**
 * Non-blocking Hermes profile invoke with bounded retry and exponential backoff.
 * Use this for every production cron/queue path — a single transient gateway blip
 * used to abort the whole daily run.
 */
export async function invokeHermesProfileWithRetry(
  input: InvokeHermesProfileWithRetryInput,
): Promise<string> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? HERMES_INVOKE_MAX_ATTEMPTS_DEFAULT);
  const totalBudgetMs = input.totalBudgetMs ?? Math.floor(input.timeoutMs * 2.5);
  const baseBackoffMs = input.baseBackoffMs ?? 2_000;
  const spawnProfile = input.spawn ?? spawnHermesProfileAsync;
  const sleep = input.sleep ?? defaultSleep;
  const now = input.now ?? (() => Date.now());

  const startedAt = now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await spawnProfile({
        hermesBin: input.hermesBin,
        profile: input.profile,
        prompt: input.prompt,
        timeoutMs: input.timeoutMs,
        env: input.env,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      if (!isRetryableHermesFailure(error)) break;

      // Budget is measured against spawn time only; backoff is bounded to a few
      // seconds and is negligible next to a multi-minute profile timeout.
      const elapsedMs = now() - startedAt;
      if (elapsedMs + input.timeoutMs > totalBudgetMs) break;
      const delayMs = baseBackoffMs * 2 ** (attempt - 1);

      input.onRetry?.({
        profile: input.profile,
        attempt,
        maxAttempts,
        delayMs,
        elapsedMs,
        message: error instanceof Error ? error.message : String(error),
      });
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${input.profile} failed with unknown error`);
}
