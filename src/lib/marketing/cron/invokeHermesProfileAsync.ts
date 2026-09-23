import { spawn } from "node:child_process";

import type { EnvBag } from "@/lib/envBag";
import {
  assertHermesSpawnSyncSuccess,
  type HermesSpawnSyncResultLike,
} from "@/lib/marketing/cron/hermesSpawnFailure";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";

/**
 * Async Hermes profile oneshot for request handlers.
 * Prefer this over spawnSync — sync spawn freezes the Next.js event loop
 * (UI busy lock + navigation hang for the whole process).
 */
export function invokeHermesProfileAsync(
  profile: string,
  prompt: string,
  timeoutMs: number,
  env: EnvBag = process.env,
): Promise<string> {
  const hermesBin = resolveHermesExecutable(env);
  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    // Merge onto process.env so spawn's ProcessEnv (NODE_ENV required) stays satisfied
    // when callers pass partial EnvBag overrides in tests.
    const spawnEnv: NodeJS.ProcessEnv = Object.assign({}, process.env, env, {
      HERMES_HOME: env.HERMES_HOME ?? "/home/ysh/.hermes",
    });
    const child = spawn(
      hermesBin,
      ["-p", profile, "--yolo", "--ignore-rules", "-z", prompt],
      {
        shell: false,
        env: spawnEnv,
      },
    );

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
          assertHermesSpawnSyncSuccess(profile, result, timeoutMs);
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
          resolve(assertHermesSpawnSyncSuccess(profile, result, timeoutMs));
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}
