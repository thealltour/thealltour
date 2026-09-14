import { describe, expect, it } from "vitest";

import {
  assertHermesSpawnSyncSuccess,
  formatHermesProfileFailure,
  invokeHermesProfileWithRetry,
  isRetryableHermesFailure,
  resolveMarketingCronHermesTimeoutMs,
} from "@/lib/marketing/cron/hermesSpawnFailure";

describe("hermesSpawnFailure classification", () => {
  it("A: timeout is reported explicitly, not exited null", () => {
    const message = formatHermesProfileFailure(
      "marketing-manager",
      {
        status: null,
        signal: "SIGTERM",
        error: Object.assign(new Error("spawnSync hermes ETIMEDOUT"), { code: "ETIMEDOUT" }),
        stderr: "",
        stdout: "",
      },
      180_000,
    );
    expect(message).toBe("marketing-manager timed out after 180000ms");
    expect(message).not.toContain("exited null");
  });

  it("B: non-timeout nonzero exit remains distinguished", () => {
    const message = formatHermesProfileFailure(
      "marketing-manager",
      {
        status: 1,
        signal: null,
        error: null,
        stderr: "model refused",
        stdout: "",
      },
      180_000,
    );
    expect(message).toBe("marketing-manager exited 1: model refused");
    expect(message).not.toContain("timed out");
  });

  it("signal termination without ETIMEDOUT is classified as signal", () => {
    const message = formatHermesProfileFailure(
      "marketing-manager",
      { status: null, signal: "SIGKILL", error: null, stderr: "killed", stdout: "" },
      180_000,
    );
    expect(message).toBe("marketing-manager terminated by signal SIGKILL: killed");
  });

  it("spawn error without status is classified as spawn failed", () => {
    const message = formatHermesProfileFailure(
      "marketing-manager",
      {
        status: null,
        signal: null,
        error: Object.assign(new Error("spawn hermes ENOENT"), { code: "ENOENT" }),
        stderr: "",
        stdout: "",
      },
      180_000,
    );
    expect(message).toContain("spawn failed");
    expect(message).toContain("ENOENT");
  });

  it("assertHermesSpawnSyncSuccess throws timeout wording", () => {
    expect(() =>
      assertHermesSpawnSyncSuccess(
        "marketing-manager",
        {
          status: null,
          signal: "SIGTERM",
          error: Object.assign(new Error("spawnSync hermes ETIMEDOUT"), { code: "ETIMEDOUT" }),
        },
        180_000,
      ),
    ).toThrow("marketing-manager timed out after 180000ms");
  });

  it("resolveMarketingCronHermesTimeoutMs defaults to 300s and honors env", () => {
    expect(resolveMarketingCronHermesTimeoutMs({}, 180_000)).toBe(180_000);
    expect(resolveMarketingCronHermesTimeoutMs({})).toBe(300_000);
    expect(resolveMarketingCronHermesTimeoutMs({ MARKETING_CRON_HERMES_TIMEOUT_MS: "240000" })).toBe(
      240_000,
    );
    expect(resolveMarketingCronHermesTimeoutMs({ MARKETING_CRON_HERMES_TIMEOUT_MS: "50" })).toBe(
      300_000,
    );
  });
});

describe("isRetryableHermesFailure", () => {
  it("retries transport-level failures", () => {
    for (const message of [
      "marketing-manager timed out after 300000ms",
      "content-strategist terminated by signal SIGKILL: killed",
      "content-strategist exited 1: ECONNRESET",
      "governance-auditor exited 1: upstream returned 503",
      "content-strategist exited 1: 429 rate limit exceeded",
      "content-strategist exited 1: socket hang up",
    ]) {
      expect(isRetryableHermesFailure(new Error(message))).toBe(true);
    }
  });

  it("does not retry config errors, auth errors, or model refusals", () => {
    for (const message of [
      "marketing-manager spawn failed: spawn hermes ENOENT",
      "content-strategist exited 1: EACCES permission denied",
      "content-strategist exited 1: 401 unauthorized",
      "content-strategist exited 1: model refused to answer",
      "content-strategist exited 2: invalid prompt",
    ]) {
      expect(isRetryableHermesFailure(new Error(message))).toBe(false);
    }
  });
});

describe("invokeHermesProfileWithRetry", () => {
  const base = {
    hermesBin: "/usr/bin/hermes",
    profile: "content-strategist",
    prompt: "hello",
    timeoutMs: 1_000,
    sleep: async () => {},
  };

  it("returns the first successful attempt without retrying", async () => {
    let calls = 0;
    const output = await invokeHermesProfileWithRetry({
      ...base,
      spawn: async () => {
        calls += 1;
        return "ok";
      },
    });
    expect(output).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries a transient failure then succeeds", async () => {
    let calls = 0;
    const retries: number[] = [];
    const output = await invokeHermesProfileWithRetry({
      ...base,
      onRetry: (attempt) => retries.push(attempt.attempt),
      spawn: async () => {
        calls += 1;
        if (calls === 1) throw new Error("content-strategist exited 1: 503 service unavailable");
        return "recovered";
      },
    });
    expect(output).toBe("recovered");
    expect(calls).toBe(2);
    expect(retries).toEqual([1]);
  });

  it("stops immediately on a non-retryable failure", async () => {
    let calls = 0;
    await expect(
      invokeHermesProfileWithRetry({
        ...base,
        spawn: async () => {
          calls += 1;
          throw new Error("marketing-manager spawn failed: spawn hermes ENOENT");
        },
      }),
    ).rejects.toThrow("ENOENT");
    expect(calls).toBe(1);
  });

  it("gives up after maxAttempts and rethrows the last failure", async () => {
    let calls = 0;
    await expect(
      invokeHermesProfileWithRetry({
        ...base,
        maxAttempts: 3,
        spawn: async () => {
          calls += 1;
          throw new Error(`content-strategist timed out after 1000ms`);
        },
      }),
    ).rejects.toThrow("timed out after 1000ms");
    expect(calls).toBe(3);
  });

  it("skips a retry that cannot fit the remaining wall-clock budget", async () => {
    let calls = 0;
    let clock = 0;
    await expect(
      invokeHermesProfileWithRetry({
        ...base,
        timeoutMs: 1_000,
        totalBudgetMs: 1_500,
        now: () => clock,
        spawn: async () => {
          calls += 1;
          clock += 1_000;
          throw new Error("content-strategist timed out after 1000ms");
        },
      }),
    ).rejects.toThrow("timed out");
    expect(calls).toBe(1);
  });
});
