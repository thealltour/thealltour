vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import {
  MARKETING_ATTR,
  MARKETING_SPAN_CONTRACT,
  MARKETING_TRACE_CONTRACT,
  MARKETING_TRACE_PRIVACY_POLICY,
  appendSpan,
  assertAgentPrismMappingFeasible,
  attributesFromTokenUsage,
  createMarketingSpan,
  createMarketingSpanId,
  createMarketingTrace,
  createMarketingTraceId,
  finishSpan,
  finishTrace,
  inferTraceErrorFromPipelineFailure,
  isForbiddenAttributeKey,
  isValidSpanId,
  isValidTraceId,
  mapIncidentClassToTraceError,
  pickMarketingAttributes,
  sanitizeSpanAttributes,
  toOtelCompatibleSpan,
  toOtelCompatibleTraceExport,
  validateMarketingTrace,
} from "@/lib/marketing/observability";

const T0 = "2026-09-10T07:00:00.000Z";
const T1 = "2026-09-10T07:00:02.500Z";
const T2 = "2026-09-10T07:00:05.000Z";

describe("OBS-1 marketing trace contract", () => {
  it("creates OTel-compatible trace/span ids", () => {
    const traceId = createMarketingTraceId();
    const spanId = createMarketingSpanId();
    expect(isValidTraceId(traceId)).toBe(true);
    expect(isValidSpanId(spanId)).toBe(true);
    expect(MARKETING_TRACE_PRIVACY_POLICY).toBe("marketing-trace-privacy-v1");
  });

  it("builds parent/child hierarchy along production spine", () => {
    let trace = createMarketingTrace({
      traceType: "production",
      startedAt: T0,
      correlation: {
        productionRequestId: "req_1",
        logicalRunKey: "daily-marketing-production:2026-09-10:abc",
        assignmentId: "ca_1",
        candidateId: null,
      },
    });

    const root = createMarketingSpan({
      traceId: trace.traceId,
      name: "marketing.production",
      kind: "orchestration",
      stage: "production_request",
      actorType: "system",
      startedAt: T0,
      spanId: createMarketingSpanId(Buffer.alloc(8, 1)),
    });
    trace = appendSpan(trace, root);

    const mm = createMarketingSpan({
      traceId: trace.traceId,
      parentSpanId: root.spanId,
      name: "marketing.agent.marketing_manager",
      kind: "agent",
      stage: "marketing_manager",
      actorType: "hermes_bot",
      actorId: "marketing-manager",
      startedAt: T0,
      endedAt: T1,
      status: "ok",
      attributes: pickMarketingAttributes({
        [MARKETING_ATTR.CHANNEL]: "threads",
        [MARKETING_ATTR.ASSIGNMENT_ID]: "ca_1",
      }),
    });
    trace = appendSpan(trace, mm);

    const ep = createMarketingSpan({
      traceId: trace.traceId,
      parentSpanId: mm.spanId,
      name: "marketing.staff.evidence_pack",
      kind: "deterministic",
      stage: "evidence_pack",
      actorType: "typescript_staff",
      actorId: "evidence_pack",
      startedAt: T1,
      endedAt: T2,
      status: "ok",
      attributes: pickMarketingAttributes({
        [MARKETING_ATTR.EVIDENCE_AVAILABLE]: 3,
        [MARKETING_ATTR.EVIDENCE_ALLOWED]: 2,
        [MARKETING_ATTR.EVIDENCE_USED]: ["ev-1", "ev-2"],
        [MARKETING_ATTR.EVIDENCE_COVERAGE_RATIO]: 0.67,
      }),
    });
    trace = appendSpan(trace, ep);

    const cv = createMarketingSpan({
      traceId: trace.traceId,
      parentSpanId: ep.spanId,
      name: "marketing.validation.completeness",
      kind: "validation",
      stage: "completeness_validator",
      actorType: "typescript_staff",
      actorId: "completeness_validator",
      startedAt: T2,
      status: "revision_required",
      attempt: 1,
      attributes: pickMarketingAttributes({
        [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]: ["Madrid", "Barcelona"],
        [MARKETING_ATTR.REQ_DESTINATION_COVERED]: ["Madrid"],
        [MARKETING_ATTR.COMPLETENESS_STATUS]: "fail",
        [MARKETING_ATTR.COMPLETENESS_MISSING_COUNT]: 1,
        [MARKETING_ATTR.REVISION_ROUND]: 1,
        [MARKETING_ATTR.REVISION_REASON]: "missing_destination",
      }),
    });
    trace = appendSpan(trace, cv);
    trace = { ...trace, rootSpanId: root.spanId };

    const issues = validateMarketingTrace(trace);
    expect(issues).toEqual([]);
    expect(trace.contract).toBe(MARKETING_TRACE_CONTRACT);
    expect(trace.spans?.every((s) => s.contract === MARKETING_SPAN_CONTRACT)).toBe(true);
    expect(cv.status).toBe("revision_required");
    expect(cv.otelStatusCode).toBe("OK"); // business revision ≠ system ERROR
  });

  it("validates timestamps and rejects endedAt before startedAt", () => {
    const trace = createMarketingTrace({
      traceType: "production",
      startedAt: T0,
      traceId: createMarketingTraceId(Buffer.alloc(16, 2)),
    });
    const bad = createMarketingSpan({
      traceId: trace.traceId,
      name: "bad",
      kind: "internal",
      stage: "other",
      actorType: "system",
      startedAt: T2,
      endedAt: T0,
      status: "ok",
    });
    const issues = validateMarketingTrace({ ...trace, spans: [bad], rootSpanId: bad.spanId });
    expect(issues.some((i) => i.code === "invalid_timestamps")).toBe(true);
  });

  it("represents attempt/revision and governance attributes", () => {
    const trace = createMarketingTrace({ traceType: "production", startedAt: T0 });
    const ga = createMarketingSpan({
      traceId: trace.traceId,
      name: "marketing.agent.governance_auditor",
      kind: "agent",
      stage: "governance_auditor",
      actorType: "hermes_bot",
      actorId: "governance-auditor",
      startedAt: T0,
      endedAt: T1,
      status: "blocked",
      attempt: 2,
      attributes: pickMarketingAttributes({
        [MARKETING_ATTR.GOVERNANCE_DECISION]: "BLOCK",
        [MARKETING_ATTR.GOVERNANCE_RISK_SCORE]: 0.8,
        [MARKETING_ATTR.REVISION_ROUND]: 1,
      }),
      error: {
        class: "governance_block",
        incidentClass: "business_rule_block",
        message: "Governance BLOCK after revision budget",
      },
    });
    expect(ga.attempt).toBe(2);
    expect(ga.attributes[MARKETING_ATTR.GOVERNANCE_DECISION]).toBe("BLOCK");
    expect(ga.error?.class).toBe("governance_block");
  });

  it("maps incident + pipeline failures into error taxonomy", () => {
    expect(mapIncidentClassToTraceError("hermes_invocation_failure")).toBe("invocation_failure");
    expect(mapIncidentClassToTraceError("timeout")).toBe("timeout");
    expect(mapIncidentClassToTraceError("malformed_model_output")).toBe("schema_failure");
    expect(mapIncidentClassToTraceError("persistence_failure")).toBe("persistence_failure");
    expect(inferTraceErrorFromPipelineFailure({ message: "completeness_failed: missing dest" })).toBe(
      "completeness_failure",
    );
    expect(inferTraceErrorFromPipelineFailure({ message: "evidence_refs_absent" })).toBe(
      "grounding_failure",
    );
  });

  it("rejects/sanitizes sensitive attributes", () => {
    expect(isForbiddenAttributeKey("api_key")).toBe(true);
    expect(isForbiddenAttributeKey("full_prompt")).toBe(true);
    expect(isForbiddenAttributeKey(MARKETING_ATTR.ASSIGNMENT_ID)).toBe(false);

    const { attributes, rejectedKeys } = sanitizeSpanAttributes({
      [MARKETING_ATTR.CHANNEL]: "threads",
      api_key: "sk-secret-should-die",
      full_prompt: "SYSTEM: dump everything",
      note: "Bearer eyJhbGciOiJIUzI1NiJ9.abc.def leaked",
    });
    expect(rejectedKeys).toEqual(expect.arrayContaining(["api_key", "full_prompt"]));
    expect(attributes).not.toHaveProperty("api_key");
    expect(String(attributes.note)).not.toMatch(/eyJhbGci/);
    expect(String(attributes.note)).toContain("[redacted");

    const span = createMarketingSpan({
      traceId: createMarketingTraceId(),
      name: "t",
      kind: "internal",
      stage: "other",
      actorType: "system",
      attributes: {
        authorization: "Bearer tok",
        [MARKETING_ATTR.ASSIGNMENT_SUMMARY]: "Safe summary",
      },
    });
    expect(span.attributes).not.toHaveProperty("authorization");
    expect(span.attributes[MARKETING_ATTR.ASSIGNMENT_SUMMARY]).toBe("Safe summary");
  });

  it("links gen_ai usage without inventing a parallel ledger", () => {
    const attrs = attributesFromTokenUsage({
      inputTokens: 120,
      outputTokens: 40,
      totalTokens: 160,
    });
    expect(attrs[MARKETING_ATTR.GEN_AI_INPUT_TOKENS]).toBe(120);
    expect(attrs[MARKETING_ATTR.GEN_AI_OUTPUT_TOKENS]).toBe(40);
  });

  it("exports OTel-compatible spans for AgentPrism feasibility", () => {
    const traceId = createMarketingTraceId(Buffer.alloc(16, 3));
    const parentId = createMarketingSpanId(Buffer.alloc(8, 4));
    const child = createMarketingSpan({
      traceId,
      parentSpanId: parentId,
      name: "marketing.agent.content_strategist",
      kind: "agent",
      stage: "content_strategist",
      actorType: "hermes_bot",
      actorId: "content-strategist",
      startedAt: T0,
      endedAt: T1,
      status: "ok",
      attributes: pickMarketingAttributes({
        [MARKETING_ATTR.GEN_AI_PROVIDER]: "openrouter",
        [MARKETING_ATTR.GEN_AI_MODEL]: "test-model",
        [MARKETING_ATTR.GEN_AI_INPUT_TOKENS]: 10,
        [MARKETING_ATTR.AI_RUNTIME_REQUEST_ID]: "req_runtime_1",
      }),
    });

    const exported = toOtelCompatibleSpan(child);
    expect(exported.traceId).toBe(traceId);
    expect(exported.spanId).toBe(child.spanId);
    expect(exported.parentSpanId).toBe(parentId);
    expect(exported.name).toBe(child.name);
    expect(exported.startTimeUnixNano).not.toBe("0");
    expect(exported.endTimeUnixNano).toBeTruthy();
    expect(exported.status.code).toBe(1); // OK
    expect(exported.attributes.some((a) => a.key === MARKETING_ATTR.GEN_AI_PROVIDER)).toBe(true);
    expect(exported.marketingStatus).toBe("ok");

    const feasibility = assertAgentPrismMappingFeasible(child);
    expect(feasibility.ok).toBe(true);
    expect(feasibility.missing).toEqual([]);

    const envelope = toOtelCompatibleTraceExport({
      contract: MARKETING_TRACE_CONTRACT,
      traceId,
      traceType: "production",
      startedAt: T0,
      status: "completed",
      spans: [child],
    });
    expect(envelope.spans).toHaveLength(1);
  });

  it("finish helpers close span/trace without dropping correlation", () => {
    let trace = createMarketingTrace({
      traceType: "human_review",
      startedAt: T0,
      correlation: { reviewId: "hmr_1", candidateId: "cmc_1" },
    });
    const span = createMarketingSpan({
      traceId: trace.traceId,
      name: "marketing.human_review",
      kind: "human_boundary",
      stage: "human_review",
      actorType: "human",
      startedAt: T0,
    });
    const done = finishSpan(span, {
      status: "ok",
      endedAt: T2,
      attributes: pickMarketingAttributes({ [MARKETING_ATTR.REVIEW_ID]: "hmr_1" }),
    });
    expect(done.durationMs).toBe(5000);
    expect(done.status).toBe("ok");
    trace = appendSpan(trace, done);
    trace = finishTrace(trace, { status: "completed", endedAt: T2 });
    expect(trace.status).toBe("completed");
    expect(trace.reviewId).toBe("hmr_1");
    expect(validateMarketingTrace(trace)).toEqual([]);
  });
});
