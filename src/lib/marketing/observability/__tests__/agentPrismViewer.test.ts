vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";
import { openTelemetrySpanAdapter } from "@evilmartians/agent-prism-data";

import {
  MARKETING_SPAN_CONTRACT,
  MARKETING_TRACE_CONTRACT,
  type MarketingSpan,
  type MarketingTrace,
} from "@/lib/marketing/observability/types";
import { isValidTraceId } from "@/lib/marketing/observability/ids";
import { createMarketingTraceId, createMarketingSpanId } from "@/lib/marketing/observability/ids";
import { presentBusinessStatus } from "@/lib/marketing/observability/viewer/businessStatus";
import { marketingSpanDisplayName } from "@/lib/marketing/observability/viewer/displayLabels";
import { buildSpanDetailGroups } from "@/lib/marketing/observability/viewer/detailsGroups";
import {
  marketingTraceToOtlpDocument,
  VIEWER_OTLP_ATTR,
} from "@/lib/marketing/observability/viewer/otlpDocument";
import { marketingTraceToAgentPrismSpans } from "@/lib/marketing/observability/viewer/agentPrismBridge";
import { marketingSpanKindDisplay } from "@/lib/marketing/observability/viewer/spanKindDisplay";
import { MARKETING_ATTR } from "@/lib/marketing/observability/attributes";

function span(partial: Partial<MarketingSpan> & Pick<MarketingSpan, "name" | "stage" | "kind">): MarketingSpan {
  return {
    contract: MARKETING_SPAN_CONTRACT,
    spanId: partial.spanId ?? createMarketingSpanId(),
    traceId: partial.traceId ?? createMarketingTraceId(),
    parentSpanId: partial.parentSpanId ?? null,
    name: partial.name,
    kind: partial.kind,
    actorType: partial.actorType ?? "system",
    actorId: partial.actorId ?? null,
    stage: partial.stage,
    attempt: partial.attempt ?? 1,
    status: partial.status ?? "ok",
    otelStatusCode: partial.otelStatusCode ?? "OK",
    startedAt: partial.startedAt ?? "2026-09-10T08:00:00.000Z",
    endedAt: partial.endedAt ?? "2026-09-10T08:00:10.000Z",
    durationMs: partial.durationMs ?? 10_000,
    attributes: partial.attributes ?? {},
    error: partial.error ?? null,
  };
}

describe("OBS-4 AgentPrism viewer adapters", () => {
  it("maps MarketingSpan → OTLP document with hierarchy", () => {
    const traceId = createMarketingTraceId();
    const root = span({
      traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
      status: "ok",
    });
    const child = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.content_strategist",
      kind: "agent",
      stage: "content_strategist",
      actorType: "hermes_bot",
      actorId: "content-strategist",
      attempt: 2,
      status: "ok",
      attributes: { [MARKETING_ATTR.CHANNEL]: "threads" },
    });
    const trace: MarketingTrace = {
      contract: MARKETING_TRACE_CONTRACT,
      traceId,
      traceType: "marketing_production",
      status: "completed",
      startedAt: root.startedAt,
      endedAt: child.endedAt,
      spans: [root, child],
    };

    const doc = marketingTraceToOtlpDocument(trace);
    const otlpSpans = doc.resourceSpans[0]!.scopeSpans[0]!.spans;
    expect(otlpSpans).toHaveLength(2);
    expect(otlpSpans[1]!.name).toBe("Content Strategist #2");
    expect(otlpSpans[1]!.parentSpanId).toBe(root.spanId);
    expect(otlpSpans[0]!.status.code).toBe("STATUS_CODE_OK");

    const tree = openTelemetrySpanAdapter.convertRawDocumentsToSpans(doc as never);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children?.length).toBe(1);
    expect(tree[0]!.children?.[0]?.title).toContain("Content Strategist");
  });

  it("keeps revision_required as warning, not system error", () => {
    expect(presentBusinessStatus("revision_required", "OK").visual).toBe("warning");
    expect(presentBusinessStatus("revision_required", "OK").isTechnicalError).toBe(false);
    expect(presentBusinessStatus("blocked", "OK").visual).toBe("warning");
    expect(presentBusinessStatus("error", "ERROR").visual).toBe("error");
    expect(presentBusinessStatus("error", "ERROR").isTechnicalError).toBe(true);

    const traceId = createMarketingTraceId();
    const root = span({
      traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
    });
    const cs1 = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.content_strategist",
      kind: "agent",
      stage: "content_strategist",
      attempt: 1,
      status: "ok",
    });
    const val1 = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.completeness_validator",
      kind: "validation",
      stage: "completeness_validator",
      attempt: 1,
      status: "revision_required",
      otelStatusCode: "OK",
      attributes: { [MARKETING_ATTR.COMPLETENESS_STATUS]: "revision_required" },
    });
    const cs2 = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.content_strategist",
      kind: "agent",
      stage: "content_strategist",
      attempt: 2,
      status: "ok",
    });
    const val2 = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.completeness_validator",
      kind: "validation",
      stage: "completeness_validator",
      attempt: 2,
      status: "ok",
    });
    const ga = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.governance_auditor",
      kind: "agent",
      stage: "governance_auditor",
      status: "ok",
    });

    const trace: MarketingTrace = {
      contract: MARKETING_TRACE_CONTRACT,
      traceId,
      traceType: "marketing_production",
      status: "completed",
      startedAt: root.startedAt,
      endedAt: ga.endedAt,
      spans: [root, cs1, val1, cs2, val2, ga],
    };

    const tree = marketingTraceToAgentPrismSpans(trace);
    const flat: typeof tree = [];
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        flat.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    const validators = flat.filter((n) => String(n.title).includes("Completeness"));
    expect(validators.length).toBe(2);
    const rev = validators.find((n) => n.status === "warning");
    expect(rev).toBeTruthy();
    expect(validators.some((n) => n.status === "error")).toBe(false);
    expect(flat.filter((n) => String(n.title).includes("Content Strategist")).length).toBe(2);
  });

  it("marks technical CS failure as error and strips IO", () => {
    const traceId = createMarketingTraceId();
    const root = span({
      traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
      status: "error",
      otelStatusCode: "ERROR",
    });
    const cs = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.content_strategist",
      kind: "agent",
      stage: "content_strategist",
      status: "error",
      otelStatusCode: "ERROR",
      error: { class: "invocation_failed", message: "Bearer [redacted] boom" },
      attributes: {
        "input.value": "SHOULD_NOT_SURFACE",
        "output.value": "SHOULD_NOT_SURFACE",
        api_key: "nope",
      },
    });
    const trace: MarketingTrace = {
      contract: MARKETING_TRACE_CONTRACT,
      traceId,
      traceType: "marketing_production",
      status: "failed",
      startedAt: root.startedAt,
      endedAt: cs.endedAt,
      spans: [root, cs],
    };

    const doc = marketingTraceToOtlpDocument(trace);
    const payload = JSON.stringify(doc);
    expect(payload).not.toMatch(/SHOULD_NOT_SURFACE/);
    expect(payload).not.toMatch(/api_key/);

    const tree = marketingTraceToAgentPrismSpans(trace);
    expect(tree[0]?.status).toBe("error");
    expect(tree[0]?.children?.[0]?.status).toBe("error");
    expect(tree[0]?.children?.[0]?.input).toBeUndefined();
    expect(tree[0]?.children?.[0]?.output).toBeUndefined();
  });

  it("omits missing optional attributes from details (no invented zeros)", () => {
    const s = span({
      name: "marketing.manager",
      kind: "agent",
      stage: "marketing_manager",
      attributes: {},
    });
    const groups = buildSpanDetailGroups(s, null);
    const quality = groups.find((g) => g.id === "quality");
    expect(quality).toBeUndefined();
    const execution = groups.find((g) => g.id === "execution");
    expect(execution?.rows.some((r) => r.label === "Status")).toBe(true);
  });

  it("validates canonical trace ids", () => {
    expect(isValidTraceId("0".repeat(32))).toBe(false);
    expect(isValidTraceId(createMarketingTraceId())).toBe(true);
    expect(marketingSpanDisplayName("marketing.human_review_boundary")).toBe("Human Review");
  });

  it("maps TheAllTour span kinds to distinct semantic badges", () => {
    expect(marketingSpanKindDisplay("agent").label).toBe("AGENT");
    expect(marketingSpanKindDisplay("orchestration").label).toBe("ORCHESTRATION");
    expect(marketingSpanKindDisplay("deterministic").label).toBe("DETERMINISTIC");
    expect(marketingSpanKindDisplay("validation").label).toBe("VALIDATION");
    expect(marketingSpanKindDisplay("human_boundary").label).toBe("HUMAN BOUNDARY");
    expect(marketingSpanKindDisplay("tool").label).toBe("TOOL");

    const traceId = createMarketingTraceId();
    const root = span({
      traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
    });
    const human = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.human_review_boundary",
      kind: "human_boundary",
      stage: "human_review",
      actorType: "human",
    });
    const validator = span({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.completeness_validator",
      kind: "validation",
      stage: "completeness_validator",
      actorType: "typescript_staff",
    });
    const tree = marketingTraceToAgentPrismSpans({
      contract: MARKETING_TRACE_CONTRACT,
      traceId,
      traceType: "marketing_production",
      status: "completed",
      startedAt: root.startedAt,
      endedAt: human.endedAt,
      spans: [root, human, validator],
    });
    const flat: Array<{ title: string; type: string; metadata?: Record<string, unknown> }> = [];
    const walk = (nodes: typeof tree) => {
      for (const n of nodes) {
        flat.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    const humanNode = flat.find((n) => String(n.title).includes("Human Review"));
    const valNode = flat.find((n) => String(n.title).includes("Completeness"));
    expect(humanNode?.type).toBe("guardrail");
    expect(humanNode?.metadata?.marketingKindLabel).toBe("HUMAN BOUNDARY");
    expect(valNode?.type).toBe("event");
    expect(valNode?.metadata?.marketingKindLabel).toBe("VALIDATION");
    expect(humanNode?.type).not.toBe("agent_invocation");
    expect(valNode?.type).not.toBe("tool_execution");
  });

  it("documents that start-only durable probes leave RUNNING orphans", async () => {
    const { createInMemoryMarketingTraceStore } = await import(
      "@/lib/marketing/observability/persistence/inMemoryStore"
    );
    const { createPersistentMarketingTraceRecorder } = await import(
      "@/lib/marketing/observability/persistence/persistentRecorder"
    );
    const store = createInMemoryMarketingTraceStore();
    const recorder = createPersistentMarketingTraceRecorder({ store });
    const { traceId } = recorder.startTrace({
      traceType: "marketing_production",
      correlation: { productionRequestId: "factory-probe-regression" },
    });
    await recorder.flush();
    const row = await store.getTraceRow(traceId);
    expect(row?.status).toBe("running");
    expect(row?.ended_at).toBeNull();
    // Smoke must not create such orphans — assert helper source no longer startTraces via factory probe.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const smoke = readFileSync(join(process.cwd(), "scripts/obs3-scoped-durable-smoke.ts"), "utf8");
    expect(smoke).not.toMatch(/productionRequestId:\s*`\$\{FIXTURE_PR\}-factory/);
    expect(smoke).not.toMatch(/resolveMarketingTraceRecorder\(\)[\s\S]{0,80}?\.startTrace\(/);
  });

  it("preserves raw span name in OTLP attributes for display mapping", () => {
    const s = span({
      name: "marketing.evidence_pack",
      kind: "deterministic",
      stage: "evidence_pack",
    });
    const doc = marketingTraceToOtlpDocument({
      contract: MARKETING_TRACE_CONTRACT,
      traceId: s.traceId,
      traceType: "marketing_production",
      status: "completed",
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      spans: [s],
    });
    const otlp = doc.resourceSpans[0]!.scopeSpans[0]!.spans[0]!;
    expect(otlp.name).toBe("Evidence Pack Builder");
    const raw = otlp.attributes.find((a) => a.key === VIEWER_OTLP_ATTR.RAW_NAME);
    expect(raw?.value.stringValue).toBe("marketing.evidence_pack");
  });
});
