import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  assertSafePerformanceBrief,
  computePerformanceDataAvailability,
  formatDailyPerformanceBriefMarkdown,
  previousSeoulDayPeriod,
  readLatestPerformanceBrief,
  writeLatestPerformanceBrief,
  type DailyPerformanceBriefArtifact,
} from "@/lib/marketing/cron/performanceBriefArtifact";

function sampleBrief(
  overrides: Partial<DailyPerformanceBriefArtifact> = {},
): DailyPerformanceBriefArtifact {
  return {
    version: 1,
    generatedAt: "2026-08-25T00:00:00.000Z",
    timezone: "Asia/Seoul",
    period: { start: "2026-08-24T00:00:00.000+09:00", end: "2026-08-24T23:59:59.999+09:00" },
    productId: "98a889e9-fbc4-41e3-8302-0d2b042fbe0a",
    channel: "threads",
    sourcesChecked: ["inquiries", "ai_feedback"],
    availableChannels: ["threads"],
    confirmedMetrics: [{ metricType: "inquiries", value: 3, source: "inquiries" }],
    missingItems: ["Instagram impressions (no SNS collector)"],
    notableChanges: [],
    managerEvidence: ["inquiries=3 (DB count, no interpretation)"],
    dataAvailability: "partial",
    snsDirectCollection: false,
    ...overrides,
  };
}

describe("performance brief artifact", () => {
  it("computes availability without inventing metrics", () => {
    expect(computePerformanceDataAvailability({ confirmedMetrics: [], missingItems: [] })).toBe("unavailable");
    expect(
      computePerformanceDataAvailability({
        confirmedMetrics: [{ metricType: "inquiries", value: 1, source: "inquiries" }],
        missingItems: ["Instagram impressions (no SNS collector)"],
      }),
    ).toBe("partial");
    expect(
      computePerformanceDataAvailability({
        confirmedMetrics: [{ metricType: "inquiries", value: 1, source: "inquiries" }],
        missingItems: [],
      }),
    ).toBe("available");
  });

  it("atomically writes a single latest file and rejects PII keys", () => {
    const dir = mkdtempSync(join(tmpdir(), "perf-brief-"));
    const path = join(dir, "latest-performance-brief.json");
    try {
      writeLatestPerformanceBrief(sampleBrief(), path);
      const loaded = readLatestPerformanceBrief(path);
      expect(loaded?.dataAvailability).toBe("partial");
      expect(loaded?.snsDirectCollection).toBe(false);
      expect(JSON.parse(readFileSync(path, "utf8")).version).toBe(1);
      expect(() =>
        assertSafePerformanceBrief({
          ...sampleBrief(),
          email: "user@example.com",
        }),
      ).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("formats markdown with no-data wording", () => {
    const md = formatDailyPerformanceBriefMarkdown(
      sampleBrief({
        confirmedMetrics: [],
        dataAvailability: "unavailable",
        managerEvidence: [],
      }),
    );
    expect(md).toContain("Daily Performance Brief");
    expect(md).toContain("data availability: unavailable");
    expect(md).toContain("SNS direct collection: false");
  });

  it("uses Asia/Seoul previous calendar day", () => {
    const period = previousSeoulDayPeriod(new Date("2026-08-25T06:30:00.000Z"));
    expect(period.start).toBe("2026-08-24T00:00:00.000+09:00");
    expect(period.end).toBe("2026-08-24T23:59:59.999+09:00");
  });
});
