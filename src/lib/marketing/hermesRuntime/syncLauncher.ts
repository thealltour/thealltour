/**
 * Sync Marketing Hermes oneshot adapter.
 *
 * Reuses the same credential / argv / binary resolution as the async launcher.
 * Prefer this over copying spawnSync + token loaders into acceptance/e2e scripts.
 */

import { spawnSync } from "node:child_process";

import type { EnvBag } from "@/lib/envBag";
import {
  assertHermesSpawnSyncSuccess,
  type HermesSpawnSyncResultLike,
} from "@/lib/marketing/cron/hermesSpawnFailure";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";
import { buildHermesProfileSpawnEnv } from "@/lib/marketing/hermesRuntime/credentials";
import { buildHermesProfileArgv } from "@/lib/marketing/hermesRuntime/launcher";
import { requireMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";

export type InvokeMarketingHermesAgentSyncInput = {
  profileId: string;
  prompt: string;
  /** Overrides contract.runtime.timeoutMs when set. */
  timeoutMs?: number;
  env?: EnvBag;
};

/**
 * Blocking Hermes `-p` oneshot with gateway token injection.
 * Domain JSON/materialize stays in the caller.
 */
export function invokeMarketingHermesAgentSync(
  input: InvokeMarketingHermesAgentSyncInput,
): string {
  const contract = requireMarketingHermesRuntimeContract(input.profileId);
  const env = input.env ?? process.env;
  const timeoutMs = input.timeoutMs ?? contract.runtime.timeoutMs;
  const hermesBin = resolveHermesExecutable(env);
  const spawnEnv = buildHermesProfileSpawnEnv(env);

  const raw = spawnSync(hermesBin, buildHermesProfileArgv(contract.profileId, input.prompt), {
    encoding: "utf8",
    env: spawnEnv,
    timeout: timeoutMs,
  });

  const timedOut =
    raw.error != null &&
    typeof raw.error === "object" &&
    "code" in raw.error &&
    String((raw.error as { code?: string }).code) === "ETIMEDOUT";

  const result: HermesSpawnSyncResultLike = {
    status: timedOut ? null : raw.status,
    signal: timedOut ? "SIGTERM" : raw.signal,
    error: timedOut
      ? (Object.assign(new Error("spawn hermes ETIMEDOUT"), {
          code: "ETIMEDOUT",
        }) as Error & { code?: string })
      : raw.error,
    stderr: raw.stderr,
    stdout: raw.stdout,
  };

  return assertHermesSpawnSyncSuccess(contract.profileId, result, timeoutMs);
}
