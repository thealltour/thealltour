vi.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";
import {
  MARKETING_ATTR,
  createTestDurableMarketingTraceStack,
  isMarketingTraceEnabled,
  isTerminalSpanStatus,
  isValidSpanId,
  isValidTraceId,
  resolveMarketingTraceRecorder,
  sanitizeAttributesForPersistence,
  createPersistentMarketingTraceRecorder,
  createInMemoryMarketingTraceStore,
} from "@/lib/marketing/observability";
import type { MarketingTraceStore } from "@/lib/marketing/observability/persistence/store";

const NOW = new Date("2026-09-10T08:00:00.000Z");
const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

const officialEvidence: CompactManagerEvidenceRef = {
  evidenceId: "ev-official",
  sourceId: "src-official",
  sourceType: "official_government",
  sourceName: "JNTO",
  isOfficial: true,
  evidenceType: "official_statement",
  url: "https://example.com/official",
  reference: null,
  excerpt: "Japan entry guidance updated for autumn travel.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
};

function allow(overrides: Partial<GovernanceReviewResult> = {}): GovernanceReviewResult {
  return {
    decision: "ALLOW",
    riskScore: 0,
    reasons: ["NO_RISK_SIGNAL"],
    revisionHints: [],
    humanApprovalRequired: false,
    semanticAvailable: true,
    ...overrides,
  };
}

function fourCityHandoff() {
  return prepareManagerToContentHandoff(
    {
      title: "Iberia circuit",
      summary: "Four cities.",
      destinations: ["Madrid", "Barcelona", "Lisbon", "Porto"],
      evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
    },
    { store: createInMemoryContentAssignmentStore(), now: NOW },
  );
}

function coveringDraft(handoff: ReturnType<typeof fourCityHandoff>): ContentStrategistOutput {
  return {
    title: "Iberia circuit",
    body: "Madrid, Barcelona, Lisbon, and Porto this season.",
    channel: "threads",
    agenda: handoff.selectedAgenda.title,
    sourceReferences: ["https://example.com/official"],
    contentPlan: {
      ...handoff.contentPlanScaffold,
      evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
    },
    assignmentId: handoff.contentAssignment.assignmentId,
  };
}

function incompleteDraft(handoff: ReturnType<typeof fourCityHandoff>): ContentStrategistOutput {
  return {
    title: "Madrid only",
    body: "Focus on Madrid.",
    channel: "threads",
    agenda: handoff.selectedAgenda.title,
    sourceReferences: ["https://example.com/official"],
    contentPlan: {
      ...handoff.contentPlanScaffold,
      evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
    },
    assignmentId: handoff.contentAssignment.assignmentId,
  };
}

describe("OBS-3 durable marketing trace storage", () => {
  it("migration declares hex id checks, indexes, and service_role RLS", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260910180000_marketing_observability_traces.sql"),
      "utf8",
    );
    expect(sql).toContain("marketing_observability_traces");
    expect(sql).toContain("marketing_observability_spans");
    expect(sql).toContain("^[0-9a-f]{32}$");
    expect(sql).toContain("^[0-9a-f]{16}$");
    expect(sql).toContain("idx_marketing_obs_traces_production_request_id");
    expect(sql).toContain("idx_marketing_obs_spans_business_status");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("revoke all on public.marketing_observability_traces from anon, authenticated");
    expect(sql).not.toContain("references public.marketing_observability_spans");
  });

  it("rollout gate defaults off and enables only for true/1", () => {
    expect(isMarketingTraceEnabled({})).toBe(false);
    expect(isMarketingTraceEnabled({ MARKETING_TRACE_ENABLED: "false" })).toBe(false);
    expect(isMarketingTraceEnabled({ MARKETING_TRACE_ENABLED: "true" })).toBe(true);
    expect(isMarketingTraceEnabled({ MARKETING_TRACE_ENABLED: "1" })).toBe(true);
    const noop = resolveMarketingTraceRecorder({ env: {} });
    const started = noop.startTrace({ traceType: "marketing_production" });
    expect(isValidTraceId(started.traceId)).toBe(true);
  });

  it("Case A — happy path insert/update and hierarchy readback", async () => {
    const { recorder, readRepo } = createTestDurableMarketingTraceStack();
    const { traceId } = recorder.startTrace({
      traceType: "marketing_production",
      correlation: {
        productionRequestId: "pr-1",
        logicalRunKey: "lr-1",
        assignmentId: "asg-1",
      },
    });
    const root = recorder.startSpan({
      traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
      actorType: "system",
    });
    const child = recorder.startSpan({
      traceId,
      parentSpanId: root.spanId,
      name: "marketing.content_strategist",
      kind: "agent",
      stage: "content_strategist",
      actorType: "hermes_bot",
      actorId: "content-strategist",
      attempt: 1,
    });
    recorder.endSpan({ traceId, spanId: child.spanId, status: "ok", otelStatusCode: "OK" });
    recorder.endSpan({ traceId, spanId: root.spanId, status: "ok", otelStatusCode: "OK" });
    recorder.endTrace({
      traceId,
      status: "completed",
      correlation: { candidateId: "cand-1", reviewId: "hmr-1" },
    });
    await recorder.flush();

    const trace = await readRepo.getTrace(traceId);
    expect(trace?.status).toBe("completed");
    expect(trace?.productionRequestId).toBe("pr-1");
    expect(trace?.candidateId).toBe("cand-1");
    expect(trace?.reviewId).toBe("hmr-1");
    expect(isValidTraceId(trace!.traceId)).toBe(true);

    const spans = await readRepo.listTraceSpans(traceId);
    expect(spans).toHaveLength(2);
    expect(spans.every((s) => isValidSpanId(s.spanId))).toBe(true);
    expect(spans.every((s) => isTerminalSpanStatus(s.status))).toBe(true);
    expect(spans.find((s) => s.spanId === child.spanId)?.parentSpanId).toBe(root.spanId);

    const byPr = await readRepo.findTraceByProductionRequestId("pr-1");
    expect(byPr?.traceId).toBe(traceId);
    const recent = await readRepo.listRecentTraces({ limit: 5, status: "completed" });
    expect(recent.some((t) => t.traceId === traceId)).toBe(true);
  });

  it("Case B — completeness revision persists both CS attempts", async () => {
    const { recorder, readRepo } = createTestDurableMarketingTraceStack();
    const handoff = fourCityHandoff();
    let csCalls = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "cover four cities",
        constraints: [],
        memoryReferences: [],
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentAssignmentId: handoff.contentAssignment.assignmentId,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        now: () => NOW,
        requestDraft: async () => {
          csCalls += 1;
          return csCalls === 1 ? incompleteDraft(handoff) : coveringDraft(handoff);
        },
        requestGovernance: async () => allow(),
        trace: { recorder },
      },
    );
    await recorder.flush();

    expect(result.status).not.toBe("handoff_failed");
    expect(csCalls).toBe(2);
    const traces = await readRepo.listRecentTraces({ limit: 1 });
    const spans = await readRepo.listTraceSpans(traces[0]!.traceId);
    const csSpans = spans.filter((s) => s.stage === "content_strategist");
    expect(csSpans.length).toBeGreaterThanOrEqual(2);
    expect(csSpans.map((s) => s.attempt).sort()).toEqual(expect.arrayContaining([1, 2]));
    const completeness = spans.filter((s) => s.stage === "completeness_validator");
    expect(completeness.some((s) => s.status === "revision_required")).toBe(true);
    expect(spans.every((s) => s.status !== "running")).toBe(true);
  });

  it("Case C — CS invocation ERROR persists sanitized error and no dangling running", async () => {
    const { recorder, readRepo } = createTestDurableMarketingTraceStack();
    const handoff = fourCityHandoff();
    await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "fail",
        constraints: [],
        memoryReferences: [],
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentAssignmentId: handoff.contentAssignment.assignmentId,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        now: () => NOW,
        requestDraft: async () => {
          throw new Error("Bearer sk-secret-token boom");
        },
        requestGovernance: async () => allow(),
        trace: { recorder },
      },
    );
    await recorder.flush();

    const traces = await readRepo.listRecentTraces({ limit: 1 });
    expect(traces[0]?.status).toBe("failed");
    const spans = await readRepo.listTraceSpans(traces[0]!.traceId);
    expect(spans.every((s) => s.status !== "running")).toBe(true);
    const cs = spans.find((s) => s.stage === "content_strategist");
    expect(cs?.status).toBe("error");
    expect(cs?.error?.message ?? "").not.toMatch(/sk-secret/i);
    expect(cs?.error?.message ?? "").toMatch(/\[redacted\]/i);
  });

  it("Case D — recorder DB failure does not change marketing pipeline result", async () => {
    const explodingStore: MarketingTraceStore = {
      async upsertTrace() {
        throw new Error("db unavailable");
      },
      async updateTrace() {
        throw new Error("db unavailable");
      },
      async upsertSpan() {
        throw new Error("db unavailable");
      },
      async updateSpan() {
        throw new Error("db unavailable");
      },
      async getTraceRow() {
        return null;
      },
      async getSpanRow() {
        return null;
      },
      async listSpanRows() {
        return [];
      },
      async findTraceRowByProductionRequestId() {
        return null;
      },
      async listRecentTraceRows() {
        return [];
      },
    };
    const onError = vi.fn();
    const durable = createPersistentMarketingTraceRecorder({ store: explodingStore, onError });
    const handoff = fourCityHandoff();
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "ok despite db",
        constraints: [],
        memoryReferences: [],
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentAssignmentId: handoff.contentAssignment.assignmentId,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        now: () => NOW,
        requestDraft: async () => coveringDraft(handoff),
        requestGovernance: async () => allow(),
        trace: { recorder: durable },
      },
    );
    await durable.flush();

    expect(result.failure).toBeFalsy();
    expect(result.draft?.title).toBe("Iberia circuit");
    expect(onError.mock.calls.length).toBeGreaterThan(0);
  });

  it("sanitizer at persistence boundary drops secrets and truncates overflow", async () => {
    const store = createInMemoryMarketingTraceStore();
    const recorder = createPersistentMarketingTraceRecorder({ store });
    const huge = "x".repeat(20_000);
    const { traceId } = recorder.startTrace({
      traceType: "marketing_production",
      attributes: {
        api_key: "should-drop",
        [MARKETING_ATTR.CHANNEL]: "threads",
        "marketing.payload": huge,
      },
    });
    await recorder.flush();
    const row = await store.getTraceRow(traceId);
    expect(row?.attributes.api_key).toBeUndefined();
    expect(row?.attributes[MARKETING_ATTR.CHANNEL]).toBe("threads");
    const json = JSON.stringify(row?.attributes ?? {});
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(16_384 + 64);

    const sanitized = sanitizeAttributesForPersistence({
      password: "nope",
      ok: "yes",
      blob: "y".repeat(30_000),
    });
    expect(sanitized.rejectedKeys).toContain("password");
    expect(sanitized.attributes.ok).toBe("yes");
  });

  it("idempotent terminal update does not regress to running", async () => {
    const store = createInMemoryMarketingTraceStore();
    const recorder = createPersistentMarketingTraceRecorder({ store });
    const { traceId } = recorder.startTrace({ traceType: "marketing_production" });
    const { spanId } = recorder.startSpan({
      traceId,
      name: "s",
      kind: "internal",
      stage: "content_strategist",
      actorType: "system",
    });
    recorder.endSpan({ traceId, spanId, status: "ok" });
    recorder.endTrace({ traceId, status: "completed" });
    await recorder.flush();

    await store.upsertSpan({
      ...(await store.getSpanRow(traceId, spanId))!,
      business_status: "running",
      ended_at: null,
    });
    await store.upsertTrace({
      ...(await store.getTraceRow(traceId))!,
      status: "running",
      ended_at: null,
    });

    const span = await store.getSpanRow(traceId, spanId);
    const trace = await store.getTraceRow(traceId);
    expect(span?.business_status).toBe("ok");
    expect(trace?.status).toBe("completed");

    recorder.endSpan({ traceId, spanId, status: "ok" });
    recorder.endTrace({ traceId, status: "completed", correlation: { candidateId: "c2" } });
    await recorder.flush();
    expect((await store.getTraceRow(traceId))?.completed_candidate_id).toBe("c2");
  });

  it("correlation attach after start leaves nullable ids then updates", async () => {
    const { recorder, readRepo } = createTestDurableMarketingTraceStack();
    const { traceId } = recorder.startTrace({
      traceType: "marketing_production",
      correlation: { productionRequestId: "pr-late" },
    });
    await recorder.flush();
    expect((await readRepo.getTrace(traceId))?.candidateId).toBeNull();

    recorder.endTrace({
      traceId,
      status: "completed",
      correlation: { candidateId: "cand-late", reviewId: "hmr-late", assignmentId: "asg-late" },
    });
    await recorder.flush();
    const t = await readRepo.getTrace(traceId);
    expect(t?.candidateId).toBe("cand-late");
    expect(t?.reviewId).toBe("hmr-late");
    expect(t?.assignmentId).toBe("asg-late");
    expect(t?.productionRequestId).toBe("pr-late");
  });

  it("completed fixture leaves no dangling running spans", async () => {
    const { recorder, readRepo } = createTestDurableMarketingTraceStack();
    const handoff = fourCityHandoff();
    await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "happy",
        constraints: [],
        memoryReferences: [],
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentAssignmentId: handoff.contentAssignment.assignmentId,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        now: () => NOW,
        requestDraft: async () => coveringDraft(handoff),
        requestGovernance: async () => allow(),
        trace: { recorder },
      },
    );
    await recorder.flush();
    const recent = await readRepo.listRecentTraces({ limit: 1 });
    expect(recent[0]?.status).not.toBe("running");
    const spans = await readRepo.listTraceSpans(recent[0]!.traceId);
    expect(spans.length).toBeGreaterThan(0);
    expect(spans.every((s) => s.status !== "running")).toBe(true);
  });
});
