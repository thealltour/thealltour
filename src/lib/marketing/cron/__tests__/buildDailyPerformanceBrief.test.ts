import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/marketing/context/sources/metricCountSource", () => ({
  fetchInquiryCount: vi.fn(),
  fetchBookingCount: vi.fn(),
  fetchThreadMarketingPostCount: vi.fn(),
  fetchAnalyticsEventCount: vi.fn(),
}));

vi.mock("@/lib/marketing/context/sources/analyticsSource", () => ({
  fetchAiPublicationRows: vi.fn(),
  fetchAiFeedbackRows: vi.fn(),
}));

vi.mock("@/lib/marketing/context/sources/memorySource", () => ({
  fetchAiMemoryRows: vi.fn(),
}));

import {
  fetchAnalyticsEventCount,
  fetchBookingCount,
  fetchInquiryCount,
  fetchThreadMarketingPostCount,
} from "@/lib/marketing/context/sources/metricCountSource";
import { fetchAiFeedbackRows, fetchAiPublicationRows } from "@/lib/marketing/context/sources/analyticsSource";
import { fetchAiMemoryRows } from "@/lib/marketing/context/sources/memorySource";
import { buildDailyPerformanceBrief } from "@/lib/marketing/cron/buildDailyPerformanceBrief";
import { MEMORY_RETRIEVAL_FAILED_ITEM } from "@/lib/marketing/cron/performanceBriefArtifact";

const NOW = new Date("2026-08-25T06:30:00.000Z");

async function stubSources(input: {
  inquiries?: number;
  bookings?: number;
  threadPosts?: number;
  analyticsEvents?: number;
  publications?: unknown[];
  feedback?: unknown[];
  memory?: unknown[] | Error;
}) {
  vi.mocked(fetchInquiryCount).mockResolvedValue(input.inquiries ?? 0);
  vi.mocked(fetchBookingCount).mockResolvedValue(input.bookings ?? 0);
  vi.mocked(fetchThreadMarketingPostCount).mockResolvedValue(input.threadPosts ?? 0);
  vi.mocked(fetchAnalyticsEventCount).mockResolvedValue(input.analyticsEvents ?? 0);
  vi.mocked(fetchAiPublicationRows).mockResolvedValue((input.publications ?? []) as never);
  vi.mocked(fetchAiFeedbackRows).mockResolvedValue((input.feedback ?? []) as never);
  if (input.memory instanceof Error) {
    vi.mocked(fetchAiMemoryRows).mockRejectedValue(input.memory);
  } else {
    vi.mocked(fetchAiMemoryRows).mockResolvedValue((input.memory ?? []) as never);
  }
}

describe("buildDailyPerformanceBrief dataAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is partial when internal metrics exist and SNS metrics are missing", async () => {
    await stubSources({ analyticsEvents: 3 });
    const brief = await buildDailyPerformanceBrief({ now: NOW });
    expect(brief.snsDirectCollection).toBe(false);
    expect(brief.dataAvailability).toBe("partial");
    expect(brief.confirmedMetrics.some((m) => m.metricType === "analytics_events" && m.value === 3)).toBe(true);
    expect(brief.missingItems.some((item) => /Instagram impressions/i.test(item))).toBe(true);
    expect(brief.managerEvidence).toContain("analytics_events=3");
  });

  it("continues as partial when memory retrieval fails but DB evidence exists", async () => {
    await stubSources({ analyticsEvents: 3, memory: new Error("provider_error") });
    const brief = await buildDailyPerformanceBrief({ now: NOW });
    expect(brief.dataAvailability).toBe("partial");
    expect(brief.missingItems).toContain(MEMORY_RETRIEVAL_FAILED_ITEM);
    expect(brief.confirmedMetrics.some((m) => m.metricType === "analytics_events" && m.value === 3)).toBe(true);
    expect(brief.confirmedMetrics.some((m) => m.metricType === "performance_memory_rows")).toBe(false);
  });

  it("is unavailable when no internal performance data and no SNS data exist", async () => {
    await stubSources({});
    const brief = await buildDailyPerformanceBrief({ now: NOW });
    expect(brief.dataAvailability).toBe("unavailable");
    expect(brief.snsDirectCollection).toBe(false);
    expect(brief.managerEvidence).toEqual([]);
  });
});
