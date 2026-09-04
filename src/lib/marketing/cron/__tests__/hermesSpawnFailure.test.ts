import { describe, expect, it } from "vitest";

import {
  assertHermesSpawnSyncSuccess,
  formatHermesProfileFailure,
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

  it("resolveMarketingCronHermesTimeoutMs keeps 180s default and honors env", () => {
    expect(resolveMarketingCronHermesTimeoutMs({}, 180_000)).toBe(180_000);
    expect(resolveMarketingCronHermesTimeoutMs({ MARKETING_CRON_HERMES_TIMEOUT_MS: "240000" })).toBe(
      240_000,
    );
    expect(resolveMarketingCronHermesTimeoutMs({ MARKETING_CRON_HERMES_TIMEOUT_MS: "50" })).toBe(
      180_000,
    );
  });
});
