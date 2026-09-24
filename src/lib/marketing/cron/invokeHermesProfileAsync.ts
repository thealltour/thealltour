/**
 * Async Hermes profile oneshot for request handlers.
 *
 * Compatibility wrapper over {@link invokeMarketingHermesAgent}.
 * Prefer this over spawnSync — sync spawn freezes the Next.js event loop
 * (UI busy lock + navigation hang for the whole process).
 *
 * Token injection / HERMES_HOME / argv live in the unified Marketing Hermes launcher.
 */

import type { EnvBag } from "@/lib/envBag";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";
import {
  buildHermesProfileSpawnEnv,
  hermesGatewayTokenTestHooks,
  resolveInferenceGatewayTokenForHermesChild,
} from "@/lib/marketing/hermesRuntime/credentials";
import {
  invokeMarketingHermesAgent,
  spawnMarketingHermesProfileOnce,
} from "@/lib/marketing/hermesRuntime/launcher";
import { getMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";

export {
  buildHermesProfileSpawnEnv,
  hermesGatewayTokenTestHooks,
  resolveInferenceGatewayTokenForHermesChild,
};

/**
 * Unregistered profiles (tests / one-offs) still spawn with token inject.
 * Registered marketing profiles go through the unified launcher (single attempt).
 */
export function invokeHermesProfileAsync(
  profile: string,
  prompt: string,
  timeoutMs: number,
  env: EnvBag = process.env,
): Promise<string> {
  if (getMarketingHermesRuntimeContract(profile)) {
    return invokeMarketingHermesAgent({
      profileId: profile,
      prompt,
      timeoutMs,
      env,
      withTransportRetry: false,
    });
  }

  const hermesBin = resolveHermesExecutable(env);
  return spawnMarketingHermesProfileOnce({
    hermesBin,
    profileId: profile,
    prompt,
    timeoutMs,
    env,
  });
}
