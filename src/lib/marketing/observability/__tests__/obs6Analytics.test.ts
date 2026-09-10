vi.mock("server-only", () => ({}));

import { describe, expect, it, vi, beforeEach } from "vitest";

import { MARKETING_ATTR } from "@/lib/marketing/observability/attributes";
import { createMarketingSpanId, createMarketingTraceId } from "@/lib/marketing/observability/ids";
import {
  aggregateMarketingObservabilityAnalytics,
} from "@/lib/marketing/observability/viewer/analytics/aggregate";
import {
  isMarketingObsAnalyticsRange,
  resolveMarketingObsAnalyticsWindow,
} from "@/lib/marketing/observability/viewer/analytics/range";
import { medianMs, p95Ms, sampledRate } from "@/lib/marketing/observability/viewer/analytics/stats";
import type {
  AnalyticsSpanInput,
  AnalyticsTraceInput,
} from "@/lib/marketing/observability/viewer/analytics/types";

vi.mock("@/lib/apiAuth", () => ({
  requireAdminPermission: vi.fn(),
}));

vi.mock("@/lib/marketing/observability/viewer/analytics/serverRepository", () => ({
  createServerMarketingObsAnalyticsRepository: vi.fn(),
}));

import { requireAdminPermission } from "@/lib/apiAuth";
import { createServerMarketingObsAnalyticsRepository } from "@/lib/marketing/observability/viewer/analytics/serverRepository";
import { GET as getAnalytics } from "@/app/api/admin/marketing-observability/analytics/route";

function trace(
  partial: Partial<AnalyticsTraceInput> & Pick<AnalyticsTraceInput, "traceId" | "status">,
): AnalyticsTraceInput {
  return {
    traceType: "marketing_production",
    startedAt: "2026-09-10T10:00:00.000Z",
    endedAt: partial.status === "running" ? null : "2026-09-10T10:01:00.000Z",
    durationMs: partial.status === "running" ? null : 60_000,
    attributes: {},
    ...partial,
  };
}

function span(
  partial: Partial<AnalyticsSpanInput> &
    Pick<AnalyticsSpanInput, "spanId" | "traceId" | "stage" | "name">,
): AnalyticsSpanInput {
  return {
    kind: "agent",
    attempt: 1,
    status: "ok",
    otelStatusCode: "OK",
    startedAt: "2026-09-10T10:00:10.000Z",
    endedAt: "2026-09-10T10:00:40.000Z",
    durationMs: 30_000,
    attributes: {},
    errorClass: null,
    errorCode: null,
    errorMessage: null,
    ...partial,
  };
}

describe("OBS-6 range + stats", () => {
  it("allowlists ranges and defaults to 7d", () => {
    expect(isMarketingObsAnalyticsRange("7d")).toBe(true);
    expect(isMarketingObsAnalyticsRange("24h")).toBe(true);
    expect(isMarketingObsAnalyticsRange("custom")).toBe(false);
    const w = resolveMarketingObsAnalyticsWindow("nope", Date.parse("2026-09-10T12:00:00.000Z"));
    expect(w.range).toBe("7d");
    const day = resolveMarketingObsAnalyticsWindow("24h", Date.parse("2026-09-10T12:00:00.000Z"));
    expect(Date.parse(day.endIso) - Date.parse(day.startIso)).toBe(24 * 60 * 60 * 1000);
  });

  it("computes median and p95", () => {
    expect(medianMs([10, 20, 30])).toBe(20);
    expect(p95Ms([10, 20, 30, 40, 50])).toBeGreaterThanOrEqual(40);
    expect(sampledRate(0, 0).rate).toBeNull();
  });
});

describe("OBS-6 aggregate acceptance", () => {
  const nowMs = Date.parse("2026-09-10T12:00:00.000Z");

  it("Case A/C — mixed runs: completion, technical failure, business outcomes separated", () => {
    const tOk = createMarketingTraceId();
    const tRev = createMarketingTraceId();
    const tGa = createMarketingTraceId();
    const tFail = createMarketingTraceId();

    const traces = [
      trace({ traceId: tOk, status: "completed", durationMs: 40_000 }),
      trace({ traceId: tRev, status: "completed", durationMs: 80_000 }),
      trace({ traceId: tGa, status: "completed", durationMs: 50_000 }),
      trace({
        traceId: tFail,
        status: "failed",
        durationMs: 20_000,
        endedAt: "2026-09-10T10:00:20.000Z",
      }),
    ];

    const spans = [
      span({
        spanId: createMarketingSpanId(),
        traceId: tOk,
        stage: "completeness_validator",
        name: "marketing.completeness_validator",
        status: "ok",
        attributes: {
          [MARKETING_ATTR.COMPLETENESS_STATUS]: "pass",
          [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]: ["a", "b"],
          [MARKETING_ATTR.REQ_DESTINATION_COVERED]: ["a", "b"],
          [MARKETING_ATTR.REQ_DESTINATION_MISSING]: [],
        },
      }),
      span({
        spanId: createMarketingSpanId(),
        traceId: tOk,
        stage: "governance_auditor",
        name: "marketing.governance_auditor",
        attributes: { [MARKETING_ATTR.GOVERNANCE_DECISION]: "ALLOW", [MARKETING_ATTR.GOVERNANCE_RISK_SCORE]: 0.1 },
      }),
      // revision path
      span({
        spanId: createMarketingSpanId(),
        traceId: tRev,
        stage: "content_strategist",
        name: "marketing.content_strategist",
        attempt: 1,
        durationMs: 30_000,
      }),
      span({
        spanId: createMarketingSpanId(),
        traceId: tRev,
        stage: "completeness_validator",
        name: "marketing.completeness_validator",
        attempt: 1,
        status: "revision_required",
        attributes: {
          [MARKETING_ATTR.COMPLETENESS_STATUS]: "fail",
          [MARKETING_ATTR.COMPLETENESS_FAILURE_CODES]: ["missing_destination_coverage"],
          [MARKETING_ATTR.REVISION_REASON]: "missing_destination_coverage",
          [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]: ["a", "b"],
          [MARKETING_ATTR.REQ_DESTINATION_COVERED]: ["a"],
          [MARKETING_ATTR.REQ_DESTINATION_MISSING]: ["b"],
        },
      }),
      span({
        spanId: createMarketingSpanId(),
        traceId: tRev,
        stage: "content_strategist",
        name: "marketing.content_strategist",
        attempt: 2,
        durationMs: 25_000,
      }),
      span({
        spanId: createMarketingSpanId(),
        traceId: tRev,
        stage: "completeness_validator",
        name: "marketing.completeness_validator",
        attempt: 2,
        status: "ok",
        attributes: { [MARKETING_ATTR.COMPLETENESS_STATUS]: "pass" },
      }),
      // GA REVIEW — business, not technical
      span({
        spanId: createMarketingSpanId(),
        traceId: tGa,
        stage: "governance_auditor",
        name: "marketing.governance_auditor",
        status: "ok",
        attributes: { [MARKETING_ATTR.GOVERNANCE_DECISION]: "REVIEW", [MARKETING_ATTR.GOVERNANCE_RISK_SCORE]: 0.6 },
      }),
      span({
        spanId: createMarketingSpanId(),
        traceId: tGa,
        stage: "completeness_validator",
        name: "marketing.completeness_validator",
        attributes: { [MARKETING_ATTR.COMPLETENESS_STATUS]: "pass" },
      }),
      // technical fail
      span({
        spanId: createMarketingSpanId(),
        traceId: tFail,
        stage: "content_strategist",
        name: "marketing.content_strategist",
        status: "error",
        otelStatusCode: "ERROR",
        errorClass: "invocation_failure",
        errorMessage: "Hermes timeout",
        durationMs: 15_000,
      }),
    ];

    const dto = aggregateMarketingObservabilityAnalytics({
      range: "7d",
      startAt: "2026-09-03T12:00:00.000Z",
      endAt: "2026-09-10T12:00:00.000Z",
      traces,
      spans,
      nowMs,
    });

    expect(dto.overview.totalRuns).toBe(4);
    expect(dto.overview.completed).toBe(3);
    expect(dto.overview.failed).toBe(1);
    expect(dto.overview.completionRate.numerator).toBe(3);
    expect(dto.overview.completionRate.denominator).toBe(4);
    // technical: only failed trace (revision_required + REVIEW not included)
    expect(dto.overview.technicalFailureRate.numerator).toBe(1);
    expect(dto.governance.review).toBe(1);
    expect(dto.governance.allow).toBe(1);
    expect(dto.quality.firstPassCompleteness.numerator).toBe(2); // tOk + tGa first pass; tRev fail on attempt1
    expect(dto.quality.firstPassCompleteness.denominator).toBe(3);
    expect(dto.revision.runsWithRevision).toBeGreaterThanOrEqual(1);
    expect(dto.revision.csAttempt2Rate.numerator).toBe(1);
    expect(dto.reliability.topErrors[0]?.errorClass).toBe("invocation_failure");
  });

  it("Case B — missing attributes stay N/A (not coerced to 0 averages)", () => {
    const tid = createMarketingTraceId();
    const dto = aggregateMarketingObservabilityAnalytics({
      range: "7d",
      startAt: "a",
      endAt: "b",
      traces: [trace({ traceId: tid, status: "completed" })],
      spans: [
        span({
          spanId: createMarketingSpanId(),
          traceId: tid,
          stage: "evidence_pack",
          name: "marketing.evidence_pack",
          attributes: {}, // no evidence keys
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId: tid,
          stage: "governance_auditor",
          name: "marketing.governance_auditor",
          attributes: { [MARKETING_ATTR.GOVERNANCE_DECISION]: "ALLOW" }, // no risk score
        }),
      ],
      nowMs,
    });
    expect(dto.evidence.avgAvailable).toBeNull();
    expect(dto.evidence.runsWithEvidenceMetrics).toBe(0);
    expect(dto.governance.avgRiskScore).toBeNull();
    expect(dto.runtimeUsage.totalInputTokens).toBeNull();
  });

  it("Case D — fixture exclusion via marketing.fixture", () => {
    const prod = createMarketingTraceId();
    const fix = createMarketingTraceId();
    const dto = aggregateMarketingObservabilityAnalytics({
      range: "7d",
      startAt: "a",
      endAt: "b",
      traces: [
        trace({ traceId: prod, status: "completed" }),
        trace({
          traceId: fix,
          status: "completed",
          attributes: { "marketing.fixture": "obs3_durable_smoke" },
        }),
      ],
      spans: [
        span({
          spanId: createMarketingSpanId(),
          traceId: prod,
          stage: "marketing_manager",
          name: "marketing.manager",
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId: fix,
          stage: "marketing_manager",
          name: "marketing.manager",
          attributes: { "marketing.fixture": "obs3_durable_smoke" },
        }),
      ],
      nowMs,
    });
    expect(dto.excludedFixtureTraceCount).toBe(1);
    expect(dto.includedTraceCount).toBe(1);
    expect(dto.overview.totalRuns).toBe(1);
  });

  it("Case E — nested tool spans do not inflate CS duration contribution", () => {
    const tid = createMarketingTraceId();
    const dto = aggregateMarketingObservabilityAnalytics({
      range: "7d",
      startAt: "a",
      endAt: "b",
      traces: [trace({ traceId: tid, status: "completed" })],
      spans: [
        span({
          spanId: createMarketingSpanId(),
          traceId: tid,
          stage: "content_strategist",
          name: "marketing.content_strategist",
          durationMs: 30_000,
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId: tid,
          stage: "other",
          name: "tool.nested",
          kind: "tool",
          durationMs: 30_000,
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId: tid,
          stage: "evidence_pack",
          name: "marketing.evidence_pack",
          durationMs: 10_000,
        }),
      ],
      nowMs,
    });
    const cs = dto.stages.find((s) => s.stage === "content_strategist")!;
    const ev = dto.stages.find((s) => s.stage === "evidence_pack")!;
    expect(cs.duration.medianMs).toBe(30_000);
    // contribution uses only bottleneck stages: 30k / (30k+10k) = 75%
    expect(cs.timeContributionPct).toBeCloseTo(75, 0);
    expect(ev.timeContributionPct).toBeCloseTo(25, 0);
  });

  it("distinguishes evidence available=0 from missing attribute", () => {
    const zero = createMarketingTraceId();
    const missing = createMarketingTraceId();
    const dto = aggregateMarketingObservabilityAnalytics({
      range: "7d",
      startAt: "a",
      endAt: "b",
      traces: [
        trace({ traceId: zero, status: "completed" }),
        trace({ traceId: missing, status: "completed" }),
      ],
      spans: [
        span({
          spanId: createMarketingSpanId(),
          traceId: zero,
          stage: "evidence_pack",
          name: "marketing.evidence_pack",
          attributes: {
            [MARKETING_ATTR.EVIDENCE_AVAILABLE]: 0,
            [MARKETING_ATTR.EVIDENCE_ALLOWED]: 0,
          },
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId: missing,
          stage: "evidence_pack",
          name: "marketing.evidence_pack",
          attributes: {},
        }),
      ],
      nowMs,
    });
    expect(dto.evidence.runsWithEvidenceMetrics).toBe(1);
    expect(dto.evidence.evidenceAvailableZero).toBe(1);
    expect(dto.evidence.avgAvailable).toBe(0);
  });

  it("governance BLOCK is not technical failure", () => {
    const tid = createMarketingTraceId();
    const dto = aggregateMarketingObservabilityAnalytics({
      range: "7d",
      startAt: "a",
      endAt: "b",
      traces: [trace({ traceId: tid, status: "completed" })],
      spans: [
        span({
          spanId: createMarketingSpanId(),
          traceId: tid,
          stage: "governance_auditor",
          name: "marketing.governance_auditor",
          status: "blocked",
          otelStatusCode: "OK",
          attributes: { [MARKETING_ATTR.GOVERNANCE_DECISION]: "BLOCK" },
        }),
      ],
      nowMs,
    });
    expect(dto.governance.block).toBe(1);
    expect(dto.overview.technicalFailureRate.numerator).toBe(0);
  });
});

describe("OBS-6 analytics API", () => {
  beforeEach(() => {
    vi.mocked(requireAdminPermission).mockReset();
    vi.mocked(createServerMarketingObsAnalyticsRepository).mockReset();
  });

  it("rejects unauthorized", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({
      ok: false,
      res: Response.json({ message: "forbidden" }, { status: 403 }),
    } as never);
    const res = await getAnalytics(
      new Request("http://localhost/api/admin/marketing-observability/analytics?range=7d"),
    );
    expect(res.status).toBe(403);
  });

  it("validates range allowlist", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({ ok: true, session: {} } as never);
    const res = await getAnalytics(
      new Request("http://localhost/api/admin/marketing-observability/analytics?range=90d"),
    );
    expect(res.status).toBe(400);
  });

  it("returns aggregate DTO without raw prompts", async () => {
    vi.mocked(requireAdminPermission).mockResolvedValue({ ok: true, session: {} } as never);
    vi.mocked(createServerMarketingObsAnalyticsRepository).mockResolvedValue({
      getSummary: async () =>
        aggregateMarketingObservabilityAnalytics({
          range: "7d",
          startAt: "2026-09-03T00:00:00.000Z",
          endAt: "2026-09-10T00:00:00.000Z",
          traces: [],
          spans: [],
        }),
    } as never);
    const res = await getAnalytics(
      new Request("http://localhost/api/admin/marketing-observability/analytics?range=7d"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overview).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/system prompt|SECRET|sk-/i);
  });
});
