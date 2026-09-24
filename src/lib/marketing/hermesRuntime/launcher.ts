/**
 * Unified Marketing Hermes launcher (Phase 1).
 *
 * Responsibilities: registry lookup, binary resolution, argv, HERMES_HOME,
 * gateway token inject, timeout, spawn, stdout/stderr, transport exit handling,
 * optional transport retry (contract-owned).
 *
 * Not responsible: JSON schema, materialize, fingerprints, editorial repair,
 * artifact persistence, business fallback.
 */

import { spawn } from "node:child_process";

import type { EnvBag } from "@/lib/envBag";
import {
  assertHermesSpawnSyncSuccess,
  HERMES_INVOKE_MAX_ATTEMPTS_DEFAULT,
  isRetryableHermesFailure,
  type HermesInvokeRetryAttempt,
  type HermesSpawnSyncResultLike,
} from "@/lib/marketing/cron/hermesSpawnFailure";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";
import {
  buildHermesProfileSpawnEnv,
  DEFAULT_HERMES_HOME,
} from "@/lib/marketing/hermesRuntime/credentials";
import type { MarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/contract";
import { requireMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";

export type MarketingHermesSpawnOnceFn = (input: {
  hermesBin: string;
  profileId: string;
  prompt: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}) => Promise<string>;

/** Test-only seam — production code must not set this. */
export const marketingHermesLauncherTestHooks: {
  spawnOnce: MarketingHermesSpawnOnceFn | null;
} = {
  spawnOnce: null,
};

export type InvokeMarketingHermesAgentInput = {
  profileId: string;
  prompt: string;
  /** Overrides contract.runtime.timeoutMs when set. */
  timeoutMs?: number;
  env?: EnvBag;
  /**
   * When true, apply contract.failurePolicy.transportRetries via a single
   * retry loop owned by this launcher. Callers must not wrap this path in
   * another transport retry (no multiplicative retries).
   *
   * Default false — preserves API/operator single-attempt behavior.
   */
  withTransportRetry?: boolean;
  /** Override max attempts when withTransportRetry is true (tests / rare ops). */
  transportMaxAttempts?: number;
  totalBudgetMs?: number;
  baseBackoffMs?: number;
  onTransportRetry?: (attempt: HermesInvokeRetryAttempt) => void;
  /** Injectable for tests. */
  spawnOnce?: MarketingHermesSpawnOnceFn;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });

export function buildHermesProfileArgv(profileId: string, prompt: string): string[] {
  return ["-p", profileId, "--yolo", "--ignore-rules", "-z", prompt];
}

/**
 * Single Hermes `-p` oneshot with gateway token injection.
 * Domain layers must not wrap this for transport retry when also using
 * `withTransportRetry` on {@link invokeMarketingHermesAgent}.
 */
export function spawnMarketingHermesProfileOnce(input: {
  hermesBin: string;
  profileId: string;
  prompt: string;
  timeoutMs: number;
  env?: EnvBag;
}): Promise<string> {
  const { hermesBin, profileId, prompt, timeoutMs } = input;
  const spawnEnv = buildHermesProfileSpawnEnv(input.env ?? process.env);

  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const child = spawn(hermesBin, buildHermesProfileArgv(profileId, prompt), {
      shell: false,
      env: spawnEnv,
    });

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 5_000).unref?.();
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      finish(() => {
        const result: HermesSpawnSyncResultLike = {
          status: null,
          signal: null,
          error: error as Error & { code?: string | number },
          stderr,
          stdout,
        };
        try {
          assertHermesSpawnSyncSuccess(profileId, result, timeoutMs);
          resolve(stdout);
        } catch (err) {
          reject(err);
        }
      });
    });
    child.on("close", (code, signal) => {
      finish(() => {
        const result: HermesSpawnSyncResultLike = {
          status: timedOut ? null : code,
          signal: timedOut ? "SIGTERM" : signal,
          error: timedOut
            ? (Object.assign(new Error("spawn hermes ETIMEDOUT"), {
                code: "ETIMEDOUT",
              }) as Error & { code?: string })
            : null,
          stderr,
          stdout,
        };
        try {
          resolve(assertHermesSpawnSyncSuccess(profileId, result, timeoutMs));
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

async function invokeWithTransportRetry(input: {
  contract: MarketingHermesRuntimeContract;
  hermesBin: string;
  prompt: string;
  timeoutMs: number;
  env: EnvBag;
  maxAttempts: number;
  totalBudgetMs: number;
  baseBackoffMs: number;
  onTransportRetry?: (attempt: HermesInvokeRetryAttempt) => void;
  spawnOnce: (input: {
    hermesBin: string;
    profileId: string;
    prompt: string;
    timeoutMs: number;
    env: NodeJS.ProcessEnv;
  }) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}): Promise<string> {
  const profileId = input.contract.profileId;
  const startedAt = input.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    try {
      return await input.spawnOnce({
        hermesBin: input.hermesBin,
        profileId,
        prompt: input.prompt,
        timeoutMs: input.timeoutMs,
        env: buildHermesProfileSpawnEnv(input.env),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= input.maxAttempts) break;
      if (!isRetryableHermesFailure(error)) break;

      const elapsedMs = input.now() - startedAt;
      if (elapsedMs + input.timeoutMs > input.totalBudgetMs) break;
      const delayMs = input.baseBackoffMs * 2 ** (attempt - 1);

      input.onTransportRetry?.({
        profile: profileId,
        attempt,
        maxAttempts: input.maxAttempts,
        delayMs,
        elapsedMs,
        message: error instanceof Error ? error.message : String(error),
      });
      await input.sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${profileId} failed with unknown error`);
}

/**
 * Canonical Marketing Hermes invoke.
 * Looks up the runtime contract, injects gateway credentials, and spawns once
 * (or with contract-owned transport retry when requested).
 */
export async function invokeMarketingHermesAgent(
  input: InvokeMarketingHermesAgentInput,
): Promise<string> {
  const contract = requireMarketingHermesRuntimeContract(input.profileId);
  const env = input.env ?? process.env;
  const timeoutMs = input.timeoutMs ?? contract.runtime.timeoutMs;
  const hermesBin = resolveHermesExecutable(env);
  const spawnOnce: MarketingHermesSpawnOnceFn =
    input.spawnOnce ??
    marketingHermesLauncherTestHooks.spawnOnce ??
    ((args) =>
      spawnMarketingHermesProfileOnce({
        hermesBin: args.hermesBin,
        profileId: args.profileId,
        prompt: args.prompt,
        timeoutMs: args.timeoutMs,
        env: args.env,
      }));

  if (!input.withTransportRetry) {
    return spawnOnce({
      hermesBin,
      profileId: contract.profileId,
      prompt: input.prompt,
      timeoutMs,
      env: buildHermesProfileSpawnEnv(env),
    });
  }

  const maxAttempts = Math.max(
    1,
    input.transportMaxAttempts ??
      contract.failurePolicy.transportRetries ??
      HERMES_INVOKE_MAX_ATTEMPTS_DEFAULT,
  );

  return invokeWithTransportRetry({
    contract,
    hermesBin,
    prompt: input.prompt,
    timeoutMs,
    env,
    maxAttempts,
    totalBudgetMs: input.totalBudgetMs ?? Math.floor(timeoutMs * 2.5),
    baseBackoffMs: input.baseBackoffMs ?? 2_000,
    onTransportRetry: input.onTransportRetry,
    spawnOnce,
    sleep: input.sleep ?? defaultSleep,
    now: input.now ?? (() => Date.now()),
  });
}

/** Re-export for callers that only need home default. */
export { DEFAULT_HERMES_HOME };
