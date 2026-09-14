vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import type { DailyMarketingRun } from "@/lib/marketing/cron/daily/types";
import { collectMorningReviewDegradations } from "@/lib/marketing/review/morningReview/collectDegradations";
import type { MorningChannelReviewView } from "@/lib/marketing/review/morningReview/types";

function run(overrides: Partial<DailyMarketingRun> = {}): DailyMarketingRun {
  return {
    status: "completed",
    degraded: false,
    researchStatus: "complete",
    metadata: {},
    ...overrides,
  } as unknown as DailyMarketingRun;
}

function channel(overrides: Partial<MorningChannelReviewView> = {}): MorningChannelReviewView {
  return {
    channel: "threads",
    label: "Threads",
    status: "needs_review",
    statusLabel: "검토 필요",
    title: null,
    body: "본문",
    aiTitle: null,
    aiBody: "본문",
    source: "ai",
    validationWarnings: [],
    ...overrides,
  } as MorningChannelReviewView;
}

describe("collectMorningReviewDegradations", () => {
  it("reports nothing for a healthy run", () => {
    expect(
      collectMorningReviewDegradations({
        run: run(),
        channelReviews: [channel()],
        researchLimitations: [],
      }),
    ).toEqual([]);
  });

  it("flags a deterministic_fallback slate as critical", () => {
    const out = collectMorningReviewDegradations({
      run: run({ metadata: { curationMode: "deterministic_fallback" } as never }),
      channelReviews: [channel()],
      researchLimitations: [],
    });

    const hit = out.find((item) => item.code === "manager_deterministic_fallback");
    expect(hit?.severity).toBe("critical");
    expect(hit?.detail).toContain("deterministic_fallback");
  });

  it("flags channels whose composer fell back", () => {
    const out = collectMorningReviewDegradations({
      run: run(),
      channelReviews: [
        channel({
          label: "네이버 밴드",
          validationWarnings: ["degraded:fallback_generated — regeneration required before approval"],
        }),
        channel(),
      ],
      researchLimitations: [],
    });

    const hit = out.find((item) => item.code === "channel_composer_fallback");
    expect(hit?.severity).toBe("critical");
    expect(hit?.message).toContain("1개");
    expect(hit?.detail).toContain("네이버 밴드");
  });

  it("flags weak marketing value verdicts as a warning", () => {
    const out = collectMorningReviewDegradations({
      run: run(),
      channelReviews: [
        channel({
          marketingValue: {
            verdict: "needs_improvement",
            overallScore: 0.4,
            reasons: [],
            improvementHints: [],
          },
        }),
      ],
      researchLimitations: [],
    });

    const hit = out.find((item) => item.code === "channel_value_weak");
    expect(hit?.severity).toBe("warning");
    expect(hit?.detail).toContain("needs_improvement");
  });

  it("surfaces research limitations, run degradation, and semantic degradation together", () => {
    const out = collectMorningReviewDegradations({
      run: run({
        degraded: true,
        researchStatus: "degraded",
        metadata: { semanticSoftDemotion: { mode: "hypothetical" } } as never,
      }),
      channelReviews: [channel()],
      researchLimitations: ["no_official_sources_in_inspected_sample", "search_failed:policy:gov"],
    });

    expect(out.map((item) => item.code)).toEqual([
      "research_limited",
      "run_degraded",
      "semantic_infra_degraded",
    ]);
    expect(out[0]?.detail).toContain("no_official_sources_in_inspected_sample");
  });

  it("does not flag semantic degradation when demotion was fully applied", () => {
    const out = collectMorningReviewDegradations({
      run: run({ metadata: { semanticSoftDemotion: { mode: "applied" } } as never }),
      channelReviews: [channel()],
      researchLimitations: [],
    });
    expect(out.some((item) => item.code === "semantic_infra_degraded")).toBe(false);
  });

  it("orders critical degradations before warnings", () => {
    const out = collectMorningReviewDegradations({
      run: run({
        degraded: true,
        metadata: { curationMode: "deterministic_fallback" } as never,
      }),
      channelReviews: [channel({ validationWarnings: ["degraded:generation_failed"] })],
      researchLimitations: ["search_failed:policy:gov"],
    });

    const firstWarningIndex = out.findIndex((item) => item.severity === "warning");
    const lastCriticalIndex = out.reduce(
      (acc, item, index) => (item.severity === "critical" ? index : acc),
      -1,
    );
    expect(lastCriticalIndex).toBeLessThan(firstWarningIndex);
  });
});
