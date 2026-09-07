import { createHash } from "node:crypto";
import {
  ENABLE_PLANNER_AFFILIATE_ROUTER,
  PLANNER_AFFILIATE_ROLLOUT_PERCENT_DEFAULT,
} from "@/config/featureFlags";

/**
 * PR-9G percent canary helpers.
 * Gate order: MASTER kill switch → percent → deterministic bucket → eligible session → providers.
 * No Math.random(). No new deps. Invalid percent never treated as 100.
 */

/** MASTER kill switch. Env overrides committed constant for server canary/smoke. */
export function isPlannerAffiliateMasterEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.ENABLE_PLANNER_AFFILIATE_ROUTER;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return ENABLE_PLANNER_AFFILIATE_ROUTER;
}

/**
 * Integer percent 0–100. Missing/blank/invalid/out-of-range → 0 (never 100).
 */
export function getPlannerAffiliateRolloutPercent(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.PLANNER_AFFILIATE_ROLLOUT_PERCENT;
  if (raw === undefined || raw === "") {
    return PLANNER_AFFILIATE_ROLLOUT_PERCENT_DEFAULT;
  }
  if (!/^\d+$/.test(raw.trim())) return 0;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 0;
  return n;
}

/**
 * Stable bucket in [0, 99] from opaque identity key.
 * sha256 → first 4 bytes as uint32 → modulo 100.
 */
export function getAffiliateRolloutBucket(key: string): number {
  const digest = createHash("sha256").update(key, "utf8").digest();
  const n = digest.readUInt32BE(0);
  return n % 100;
}

/**
 * Master + percent gate for a stable identity key.
 * percent >= 100 with master → true; percent <= 0 → false.
 */
export function isPlannerAffiliateEnabledForKey(
  key: string,
  options?: {
    env?: NodeJS.ProcessEnv;
    percent?: number;
    masterEnabled?: boolean;
  },
): boolean {
  const env = options?.env ?? process.env;
  const master =
    options?.masterEnabled ?? isPlannerAffiliateMasterEnabled(env);
  if (!master) return false;

  const percent =
    options?.percent ?? getPlannerAffiliateRolloutPercent(env);
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  return getAffiliateRolloutBucket(key) < percent;
}

export type AffiliateRolloutIdentity = {
  /** Opaque key used for hashing — never log/send to client analytics. */
  key: string;
  /**
   * user-stable: planner_sessions.anonymous_key (same browser anonymous identity).
   * session-stable: planner session id fallback when anonymous key missing.
   */
  stability: "user-stable" | "session-stable";
};

/**
 * Prefer existing server-side anonymous stable key; else plannerSessionId.
 * No new cookies / IP / UA / email / Kakao.
 */
export function resolveAffiliateRolloutIdentity(session: {
  id: string;
  anonymousKey?: string | null;
}): AffiliateRolloutIdentity {
  const anon = session.anonymousKey?.trim();
  if (anon) {
    return { key: anon, stability: "user-stable" };
  }
  return { key: session.id, stability: "session-stable" };
}
