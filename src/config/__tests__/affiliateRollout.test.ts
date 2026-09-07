import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAffiliateRolloutBucket,
  getPlannerAffiliateRolloutPercent,
  isPlannerAffiliateEnabledForKey,
  isPlannerAffiliateMasterEnabled,
  resolveAffiliateRolloutIdentity,
} from "@/config/affiliateRollout";
import {
  ENABLE_PLANNER_AFFILIATE_ROUTER,
  PLANNER_AFFILIATE_ROLLOUT_PERCENT_DEFAULT,
} from "@/config/featureFlags";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PR-9G affiliate rollout helpers", () => {
  it("committed defaults: master false, percent default 0", () => {
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
    expect(PLANNER_AFFILIATE_ROLLOUT_PERCENT_DEFAULT).toBe(0);
    expect(isPlannerAffiliateMasterEnabled({})).toBe(false);
    expect(getPlannerAffiliateRolloutPercent({})).toBe(0);
  });

  it("master false + percent 100 → false", () => {
    expect(
      isPlannerAffiliateEnabledForKey("any-key", {
        masterEnabled: false,
        percent: 100,
      }),
    ).toBe(false);
  });

  it("master true + percent 0 → false", () => {
    expect(
      isPlannerAffiliateEnabledForKey("any-key", {
        masterEnabled: true,
        percent: 0,
      }),
    ).toBe(false);
  });

  it("master true + percent 100 → true", () => {
    expect(
      isPlannerAffiliateEnabledForKey("any-key", {
        masterEnabled: true,
        percent: 100,
      }),
    ).toBe(true);
  });

  it("master true + percent 5 is deterministic for a key", () => {
    const key = "anon-stable-key-pr9g-canary";
    const bucket = getAffiliateRolloutBucket(key);
    const enabled = isPlannerAffiliateEnabledForKey(key, {
      masterEnabled: true,
      percent: 5,
    });
    expect(enabled).toBe(bucket < 5);
    expect(getAffiliateRolloutBucket(key)).toBe(bucket);
  });

  it("same key is stable across calls", () => {
    const key = "stable-anonymous-key-aaaa";
    const a = getAffiliateRolloutBucket(key);
    const b = getAffiliateRolloutBucket(key);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it("invalid percent → 0 (never 100)", () => {
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "" })).toBe(0);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "abc" })).toBe(0);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "-1" })).toBe(0);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "101" })).toBe(0);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "5.5" })).toBe(0);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "100" })).toBe(100);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "0" })).toBe(0);
    expect(getPlannerAffiliateRolloutPercent({ PLANNER_AFFILIATE_ROLLOUT_PERCENT: "5" })).toBe(5);
  });

  it("bucket matches sha256 first-4-bytes modulo 100 (no Math.random)", () => {
    const key = "hash-contract-key";
    const digest = createHash("sha256").update(key, "utf8").digest();
    const expected = digest.readUInt32BE(0) % 100;
    expect(getAffiliateRolloutBucket(key)).toBe(expected);
  });

  it("distribution sanity ~1000 keys at 5% ≈ 50 ± tolerance", () => {
    let hit = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (
        isPlannerAffiliateEnabledForKey(`dist-key-${i}`, {
          masterEnabled: true,
          percent: 5,
        })
      ) {
        hit += 1;
      }
    }
    // Binomial σ≈√(npq)≈6.9; allow wide band for determinism flake avoidance
    expect(hit).toBeGreaterThanOrEqual(20);
    expect(hit).toBeLessThanOrEqual(80);
  });

  it("identity prefers anonymousKey (user-stable) else session id (session-stable)", () => {
    expect(
      resolveAffiliateRolloutIdentity({
        id: "sess-1",
        anonymousKey: "anon-abc",
      }),
    ).toEqual({ key: "anon-abc", stability: "user-stable" });

    expect(
      resolveAffiliateRolloutIdentity({
        id: "sess-2",
        anonymousKey: "  ",
      }),
    ).toEqual({ key: "sess-2", stability: "session-stable" });

    expect(
      resolveAffiliateRolloutIdentity({
        id: "sess-3",
        anonymousKey: null,
      }),
    ).toEqual({ key: "sess-3", stability: "session-stable" });
  });

  it("env master override works without changing committed constant", () => {
    expect(ENABLE_PLANNER_AFFILIATE_ROUTER).toBe(false);
    expect(
      isPlannerAffiliateMasterEnabled({ ENABLE_PLANNER_AFFILIATE_ROUTER: "true" }),
    ).toBe(true);
    expect(
      isPlannerAffiliateMasterEnabled({ ENABLE_PLANNER_AFFILIATE_ROUTER: "false" }),
    ).toBe(false);
  });
});
