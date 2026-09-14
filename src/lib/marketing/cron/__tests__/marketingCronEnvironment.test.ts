import { describe, expect, it } from "vitest";

import {
  formatMarketingCronEnvironmentLines,
  inspectMarketingCronEnvironment,
} from "@/lib/marketing/cron/marketingCronEnvironment";

describe("inspectMarketingCronEnvironment", () => {
  it("reports the hermes-cli path and warns when the binary is unresolved", () => {
    const report = inspectMarketingCronEnvironment({
      entryPoint: "cron-daily-marketing-plan",
      env: { HERMES_BIN: "/nonexistent/hermes" },
    });

    expect(report.inferencePath).toBe("hermes-cli");
    expect(report.hermesBinResolvable).toBe(false);
    expect(report.warnings.some((w) => w.includes("hermes binary is not resolvable"))).toBe(true);
  });

  it("does not warn about the hermes binary on the ai-runtime path", () => {
    const report = inspectMarketingCronEnvironment({
      entryPoint: "process-marketing-production-queue",
      env: { AI_RUNTIME_MARKETING_CRON_ENABLED: "true", HERMES_BIN: "/nonexistent/hermes" },
    });

    expect(report.inferencePath).toBe("ai-runtime");
    expect(report.warnings.some((w) => w.includes("hermes binary"))).toBe(false);
  });

  it("warns when research collection and tracing are disabled", () => {
    const report = inspectMarketingCronEnvironment({
      entryPoint: "cron-daily-marketing-plan",
      env: {},
    });

    expect(report.researchCollectionEnabled).toBe(false);
    expect(report.traceEnabled).toBe(false);
    expect(report.warnings.some((w) => w.includes("RESEARCH_COLLECTION_ENABLED"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("MARKETING_TRACE_ENABLED"))).toBe(true);
  });

  it("is clean when both entry points share the documented unit environment", () => {
    const unitEnv = {
      HERMES_BIN: process.execPath,
      HERMES_HOME: "/home/ysh/.hermes",
      RESEARCH_COLLECTION_ENABLED: "true",
      MARKETING_TRACE_ENABLED: "true",
    };

    const agenda = inspectMarketingCronEnvironment({
      entryPoint: "cron-daily-marketing-plan",
      env: unitEnv,
    });
    const queue = inspectMarketingCronEnvironment({
      entryPoint: "process-marketing-production-queue",
      env: unitEnv,
    });

    expect(agenda.warnings).toEqual([]);
    expect(queue.warnings).toEqual([]);
    expect(agenda.inferencePath).toBe(queue.inferencePath);
    expect(agenda.hermesTimeoutMs).toBe(queue.hermesTimeoutMs);
  });

  it("honors an explicit timeout override", () => {
    const report = inspectMarketingCronEnvironment({
      entryPoint: "cron-daily-marketing-plan",
      env: { MARKETING_CRON_HERMES_TIMEOUT_MS: "420000" },
    });
    expect(report.hermesTimeoutMs).toBe(420_000);
  });

  it("formats warnings as WARN lines", () => {
    const lines = formatMarketingCronEnvironmentLines(
      inspectMarketingCronEnvironment({ entryPoint: "test", env: {} }),
    );
    expect(lines[0]).toBe("- entryPoint: test");
    expect(lines.some((line) => line.startsWith("- WARN:"))).toBe(true);
  });
});
