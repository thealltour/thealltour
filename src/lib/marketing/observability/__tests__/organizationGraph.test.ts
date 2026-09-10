import { describe, expect, it } from "vitest";

import { createMarketingSpanId, createMarketingTraceId } from "@/lib/marketing/observability/ids";
import type { MarketingSpanDto, MarketingTraceDetailDto } from "@/lib/marketing/observability/viewer/dto";
import { computeLiveDurationMs } from "@/lib/marketing/observability/viewer/live/duration";
import {
  buildMarketingOrganizationGraphModel,
  getDefaultVisibleEdges,
  getDefaultVisibleNodes,
  MARKETING_ORG_V21_NODES,
  orgExecutionStateLabel,
  orgNodeKindLabel,
} from "@/lib/marketing/observability/viewer/organization";

function span(
  partial: Partial<MarketingSpanDto> & Pick<MarketingSpanDto, "spanId" | "traceId" | "stage" | "name">,
): MarketingSpanDto {
  return {
    parentSpanId: null,
    kind: "agent",
    actorType: "agent",
    actorId: null,
    attempt: 1,
    status: "ok",
    otelStatusCode: "OK",
    startedAt: "2026-09-10T10:00:00.000Z",
    endedAt: "2026-09-10T10:00:10.000Z",
    durationMs: 10_000,
    attributes: {},
    error: null,
    ...partial,
  };
}

function detail(spans: MarketingSpanDto[]): MarketingTraceDetailDto {
  const traceId = spans[0]?.traceId ?? createMarketingTraceId();
  return {
    trace: {
      traceId,
      traceType: "marketing_production",
      status: "running",
      startedAt: "2026-09-10T10:00:00.000Z",
      endedAt: null,
      durationMs: null,
      productionRequestId: "pr-1",
      logicalRunKey: null,
      assignmentId: null,
      candidateId: null,
      reviewId: null,
      spanCount: spans.length,
      agendaSlateId: null,
      agendaCandidateId: null,
      rootSpanId: spans[0]?.spanId ?? null,
    },
    spans,
  };
}

describe("OBS-7 organization topology", () => {
  it("exposes Core + workflow by default without planned agents", () => {
    const nodes = getDefaultVisibleNodes(false);
    expect(nodes.some((n) => n.id === "marketing_manager")).toBe(true);
    expect(nodes.some((n) => n.id === "content_strategist")).toBe(true);
    expect(nodes.some((n) => n.id === "evidence_pack")).toBe(true);
    expect(nodes.some((n) => n.kind === "planned_agent")).toBe(false);
    expect(getDefaultVisibleNodes(true).some((n) => n.id === "channel_producer")).toBe(true);
    expect(getDefaultVisibleEdges(true).some((e) => e.planned)).toBe(true);
  });

  it("labels node kinds distinctly", () => {
    expect(orgNodeKindLabel("core_agent")).toBe("CORE AGENT");
    expect(orgNodeKindLabel("planned_agent")).toBe("PLANNED");
    expect(orgNodeKindLabel("validation")).toBe("VALIDATION");
  });
});

describe("OBS-7 execution overlay", () => {
  it("Case A — static organization with no trace stays idle", () => {
    const model = buildMarketingOrganizationGraphModel({ showPlanned: false, detail: null });
    expect(model.nodeOverlays.marketing_manager?.state).toBe("idle");
    expect(model.nodes.every((n) => n.kind !== "planned_agent")).toBe(true);
  });

  it("Case B/C — happy + live CS running marks visited/active/waiting", () => {
    const traceId = createMarketingTraceId();
    const model = buildMarketingOrganizationGraphModel({
      detail: detail([
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "marketing_manager",
          name: "marketing.manager",
          status: "ok",
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "deliverable_requirements",
          name: "marketing.deliverable_requirements",
          kind: "deterministic",
          status: "ok",
          durationMs: 100,
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "evidence_pack",
          name: "marketing.evidence_pack",
          kind: "deterministic",
          status: "ok",
          durationMs: 100,
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "content_strategist",
          name: "marketing.content_strategist",
          status: "running",
          endedAt: null,
          durationMs: null,
          startedAt: "2026-09-10T10:00:20.000Z",
        }),
      ]),
      nowMs: Date.parse("2026-09-10T10:00:38.400Z"),
    });
    expect(model.nodeOverlays.marketing_manager?.state).toBe("ok");
    expect(model.nodeOverlays.evidence_pack?.state).toBe("ok");
    expect(model.nodeOverlays.content_strategist?.state).toBe("running");
    expect(model.nodeOverlays.content_strategist?.activeStartedAt).toBe("2026-09-10T10:00:20.000Z");
    expect(model.nodeOverlays.content_strategist?.durationMs).toBeNull();
    expect(
      computeLiveDurationMs(
        model.nodeOverlays.content_strategist!.activeStartedAt!,
        null,
        Date.parse("2026-09-10T10:00:38.400Z"),
      ),
    ).toBe(18_400);
    expect(model.nodeOverlays.completeness_validator?.state).toBe("waiting");
    expect(model.edgeOverlays.ev_to_cs?.visit).toBe("visited");
    expect(["active", "visited"]).toContain(model.edgeOverlays.cs_to_cv?.visit);
  });

  it("Case D — revision_required is not technical_error and keeps attempts", () => {
    const traceId = createMarketingTraceId();
    const model = buildMarketingOrganizationGraphModel({
      detail: detail([
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "content_strategist",
          name: "marketing.content_strategist",
          attempt: 1,
          status: "ok",
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "completeness_validator",
          name: "marketing.completeness_validator",
          attempt: 1,
          status: "revision_required",
          otelStatusCode: "OK",
          kind: "validation",
        }),
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "content_strategist",
          name: "marketing.content_strategist",
          attempt: 2,
          status: "running",
          endedAt: null,
          durationMs: null,
        }),
      ]),
      nowMs: Date.parse("2026-09-10T10:01:00.000Z"),
    });
    expect(model.nodeOverlays.completeness_validator?.state).toBe("revision_required");
    expect(model.nodeOverlays.completeness_validator?.technicalError).toBe(false);
    expect(orgExecutionStateLabel("revision_required")).toBe("REVISION");
    expect(model.nodeOverlays.content_strategist?.attemptLabels).toEqual(
      expect.arrayContaining(["#1", "#2"]),
    );
    expect(model.nodeOverlays.content_strategist?.state).toBe("running");
  });

  it("Case E — technical ERROR maps to technical_error", () => {
    const traceId = createMarketingTraceId();
    const model = buildMarketingOrganizationGraphModel({
      detail: detail([
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "content_strategist",
          name: "marketing.content_strategist",
          status: "error",
          otelStatusCode: "ERROR",
          error: { class: "invocation_failure", message: "timeout", pipelineFailureCode: null },
        }),
      ]),
    });
    expect(model.nodeOverlays.content_strategist?.state).toBe("technical_error");
    expect(model.nodeOverlays.content_strategist?.technicalError).toBe(true);
    expect(JSON.stringify(model)).not.toMatch(/sk-|SECRET|prompt_text/i);
  });

  it("Case F — planned agents are distinct from idle core", () => {
    const model = buildMarketingOrganizationGraphModel({ showPlanned: true });
    const cp = model.nodes.find((n) => n.id === "channel_producer");
    expect(cp?.kind).toBe("planned_agent");
    expect(orgNodeKindLabel(cp!.kind)).toBe("PLANNED");
    expect(MARKETING_ORG_V21_NODES.some((n) => n.id === "creative_director")).toBe(true);
  });

  it("Governance BLOCK stays business blocked, not technical_error", () => {
    const traceId = createMarketingTraceId();
    const model = buildMarketingOrganizationGraphModel({
      detail: detail([
        span({
          spanId: createMarketingSpanId(),
          traceId,
          stage: "governance_auditor",
          name: "marketing.governance_auditor",
          status: "blocked",
          otelStatusCode: "OK",
        }),
      ]),
    });
    expect(model.nodeOverlays.governance_auditor?.state).toBe("blocked");
    expect(model.nodeOverlays.governance_auditor?.technicalError).toBe(false);
  });
});
