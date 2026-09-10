vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";
import {
  MARKETING_ATTR,
  createInMemoryMarketingTraceRecorder,
  createMarketingTraceId,
  createMarketingSpanId,
  isValidSpanId,
  isValidTraceId,
  safeRecorder,
  validateMarketingTrace,
} from "@/lib/marketing/observability";
import { MAX_AUTO_REVISION_ROUNDS } from "@/lib/marketing/bot/organization/envelope";

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

describe("OBS-2 pipeline instrumentation", () => {
  it("rejects all-zero canonical ids", () => {
    expect(() => createMarketingTraceId(Buffer.alloc(16, 0))).toThrow(/all-zero/);
    expect(() => createMarketingSpanId(Buffer.alloc(8, 0))).toThrow(/all-zero/);
    expect(isValidTraceId("0".repeat(32))).toBe(false);
    expect(isValidSpanId("0".repeat(16))).toBe(false);
    const tid = createMarketingTraceId();
    const sid = createMarketingSpanId();
    expect(isValidTraceId(tid)).toBe(true);
    expect(isValidSpanId(sid)).toBe(true);
  });

  it("Case A — happy path closes hierarchy with human boundary", async () => {
    const recorder = createInMemoryMarketingTraceRecorder();
    const handoff = fourCityHandoff();
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => coveringDraft(handoff),
        requestGovernance: async () => allow({ decision: "REVIEW", humanApprovalRequired: true }),
        trace: { recorder },
      },
    );

    expect(result.status).toBe("approval_pending");
    const traces = recorder.snapshot();
    expect(traces).toHaveLength(1);
    const trace = traces[0]!;
    expect(trace.traceType).toBe("marketing_production");
    expect(validateMarketingTrace(trace)).toEqual([]);
    expect(trace.spans?.every((s) => s.status !== "running")).toBe(true);
    expect(trace.spans?.every((s) => (s.durationMs ?? 0) >= 0)).toBe(true);

    const names = (trace.spans ?? []).map((s) => s.name);
    expect(names).toContain("marketing.production");
    expect(names).toContain("marketing.manager");
    expect(names).toContain("marketing.deliverable_requirements");
    expect(names).toContain("marketing.evidence_pack");
    expect(names).toContain("marketing.content_strategist");
    expect(names).toContain("marketing.completeness_validator");
    expect(names).toContain("marketing.governance_auditor");
    expect(names).toContain("marketing.human_review_boundary");

    const root = trace.spans?.find((s) => s.name === "marketing.production");
    const children = (trace.spans ?? []).filter((s) => s.parentSpanId === root?.spanId);
    expect(children.length).toBeGreaterThanOrEqual(6);
    expect(trace.status).toBe("completed");
  });

  it("Case B — completeness revision then second validator; no extra auto rounds", async () => {
    const recorder = createInMemoryMarketingTraceRecorder();
    const handoff = fourCityHandoff();
    let draftCalls = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => {
          draftCalls += 1;
          return draftCalls === 1 ? incompleteDraft(handoff) : coveringDraft(handoff);
        },
        requestGovernance: async () => allow(),
        trace: { recorder },
      },
    );

    expect(draftCalls).toBe(2);
    expect(result.revisionRounds).toBe(1);
    expect(result.revisionRounds).toBeLessThanOrEqual(MAX_AUTO_REVISION_ROUNDS);
    expect(["publish_ready", "approval_pending"]).toContain(result.status);

    const spans = recorder.snapshot()[0]?.spans ?? [];
    const cs = spans.filter((s) => s.name === "marketing.content_strategist");
    const cv = spans.filter((s) => s.name === "marketing.completeness_validator");
    expect(cs).toHaveLength(2);
    expect(cs[0]?.attempt).toBe(1);
    expect(cs[1]?.attempt).toBe(2);
    expect(cs[1]?.attributes[MARKETING_ATTR.REVISION_ROUND]).toBe(1);
    expect(cv).toHaveLength(2);
    expect(cv[0]?.status).toBe("revision_required");
    expect(cv[0]?.otelStatusCode).toBe("OK");
    expect(cv[1]?.status).toBe("ok");
    expect(spans.every((s) => s.status !== "running")).toBe(true);
  });

  it("Case C — Hermes invocation failure marks CS span ERROR and closes trace", async () => {
    const recorder = createInMemoryMarketingTraceRecorder();
    const handoff = fourCityHandoff();
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => {
          throw new Error("content-strategist spawn failed: hermes ENOENT");
        },
        requestGovernance: async () => allow(),
        trace: { recorder },
      },
    );

    expect(result.status).toBe("handoff_failed");
    expect(result.failure?.code).toBe("content_unavailable");

    const trace = recorder.snapshot()[0]!;
    expect(["failed", "partial"]).toContain(trace.status);
    const cs = trace.spans?.find((s) => s.name === "marketing.content_strategist");
    expect(cs?.status).toBe("error");
    expect(cs?.otelStatusCode).toBe("ERROR");
    expect(cs?.error?.message).toMatch(/ENOENT|spawn failed/i);
    expect(cs?.error?.message).not.toMatch(/api[_-]?key|Bearer\s+\S+/i);
    expect(trace.spans?.every((s) => s.status !== "running")).toBe(true);
  });

  it("governance BLOCK is business blocked with otel OK", async () => {
    const recorder = createInMemoryMarketingTraceRecorder();
    const handoff = prepareManagerToContentHandoff(
      {
        title: "Info",
        summary: "Short",
        destinations: [],
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { store: createInMemoryContentAssignmentStore(), now: NOW },
    );
    // Exhaust revision budget so BLOCK sticks without CS re-draft consuming another CS span pair.
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => ({
          title: "Info",
          body: "Short update grounded.",
          channel: "threads",
          agenda: handoff.selectedAgenda.title,
          sourceReferences: ["https://example.com/official"],
          contentPlan: {
            ...handoff.contentPlanScaffold,
            evidenceRefs: handoff.contentAssignment.evidenceRefs.slice(0, 1),
          },
        }),
        requestGovernance: async () =>
          allow({
            decision: "BLOCK",
            revisionHints: ["fix claim"],
            reasons: ["unsupported_exact_price"],
          }),
        trace: { recorder },
      },
    );

    expect(result.status).toBe("revision_required");
    const ga = recorder.snapshot()[0]?.spans?.find((s) => s.name === "marketing.governance_auditor");
    expect(ga?.status).toBe("blocked");
    expect(ga?.otelStatusCode).toBe("OK");
    expect(ga?.attributes[MARKETING_ATTR.GOVERNANCE_DECISION]).toBe("BLOCK");
  });

  it("recorder failure does not alter pipeline result", async () => {
    const exploding: ReturnType<typeof createInMemoryMarketingTraceRecorder> = {
      ...createInMemoryMarketingTraceRecorder(),
      startTrace() {
        throw new Error("recorder boom");
      },
      startSpan() {
        throw new Error("recorder boom");
      },
      endSpan() {
        throw new Error("recorder boom");
      },
      endTrace() {
        throw new Error("recorder boom");
      },
      failSpan() {
        throw new Error("recorder boom");
      },
      addSpanAttributes() {
        throw new Error("recorder boom");
      },
      getTrace() {
        return undefined;
      },
      getSpans() {
        return [];
      },
      snapshot() {
        return [];
      },
      clear() {},
    };

    const handoff = fourCityHandoff();
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => coveringDraft(handoff),
        requestGovernance: async () => allow(),
        trace: { recorder: safeRecorder(exploding) },
      },
    );
    expect(["publish_ready", "approval_pending"]).toContain(result.status);
  });

  it("rejects sensitive attributes on instrumented spans", async () => {
    const recorder = createInMemoryMarketingTraceRecorder();
    const handoff = fourCityHandoff();
    await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: handoff.selectedAgenda,
        contentAssignment: handoff.contentAssignment,
        contentPlanScaffold: handoff.contentPlanScaffold,
        deliverableRequirements: handoff.deliverableRequirements,
        evidencePack: handoff.evidencePack,
      },
      {
        requestDraft: async () => coveringDraft(handoff),
        requestGovernance: async () => allow(),
        trace: { recorder },
      },
    );
    const blob = JSON.stringify(recorder.snapshot());
    expect(blob).not.toMatch(/api[_-]?key|full_prompt|Authorization/i);
    const evidenceSpan = recorder.snapshot()[0]?.spans?.find((s) => s.name === "marketing.evidence_pack");
    expect(JSON.stringify(evidenceSpan?.attributes ?? {})).not.toContain("Japan entry guidance");
  });
});
