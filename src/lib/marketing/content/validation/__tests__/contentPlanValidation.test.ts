vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { prepareContentToGovernanceHandoff } from "@/lib/marketing/content/governance/prepareContentToGovernanceHandoff";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";
import { buildContentPlanScaffold } from "@/lib/marketing/content/buildContentPlanScaffold";
import { parseContentStrategistOutput } from "@/lib/marketing/cron/marketingPlanSpecialists";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import { classifyMarketingIncident } from "@/lib/marketing/operations/incidentClassification";
import { ContentPlanContractError } from "@/lib/marketing/content/validation/contentPlanContractError";
import {
  canSafelyAdaptLegacyEvidenceRefs,
  getProviderEvidencePresence,
  parseProviderContentPlan,
  resolveContentPlanForGovernance,
  validateInternalContentPlan,
} from "@/lib/marketing/content/validation/validateContentPlan";
import { CONTENT_PLAN_CONTRACT } from "@/lib/marketing/content/types";

const NOW = new Date("2026-09-02T04:00:00.000Z");
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
  excerpt: "Japan autumn travel guidance updated.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
};

const evidenceRefPayload = {
  evidenceId: "ev-official",
  sourceId: "src-official",
  sourceType: "official_government",
  sourceName: "JNTO",
  isOfficial: true,
  evidenceType: "official_statement",
  url: "https://example.com/official",
  reference: null,
  excerpt: "Japan autumn travel guidance updated.",
  publishedAt: "2026-09-01T00:00:00.000Z",
  observedAt: "2026-09-02T00:00:00.000Z",
  credibilityHint: 0.9,
};

function baseDraft(overrides: Partial<ContentStrategistOutput> = {}): ContentStrategistOutput {
  return {
    title: "Japan update",
    body: "Official guidance says autumn travel planning is easier.",
    channel: "threads",
    agenda: "Japan autumn",
    sourceReferences: ["evidence:ev-official"],
    assignmentId: "ca_test",
    ...overrides,
  };
}

function validProviderPlan(assignmentId: string, overrides: Record<string, unknown> = {}) {
  return {
    assignmentId,
    primaryAngle: "Official update angle",
    keyMessage: "Japan autumn",
    factsToUse: ["Official guidance updated autumn travel planning."],
    evidenceRefs: [evidenceRefPayload],
    ...overrides,
  };
}

function expectContractError(fn: () => unknown): ContentPlanContractError {
  try {
    fn();
    throw new Error("expected ContentPlanContractError");
  } catch (error) {
    expect(error).toBeInstanceOf(ContentPlanContractError);
    return error as ContentPlanContractError;
  }
}

describe("STEP 3-12 ContentPlan contract — provenance semantics", () => {
  it("1: provider factual claims + evidenceRefs absent → malformed_model_output, GA not called", async () => {
    const err = expectContractError(() =>
      parseProviderContentPlan({
        assignmentId: "ca1",
        factsToUse: ["Official guidance says autumn travel planning is easier."],
      }),
    );
    expect(err.incidentClass).toBe("malformed_model_output");
    expect(err.validationIssue).toBe("evidence_refs_absent");

    let governanceCalls = 0;
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: mm.selectedAgenda,
        contentAssignment: mm.contentAssignment,
        contentPlanScaffold: mm.contentPlanScaffold,
      },
      {
        requestDraft: async () =>
          baseDraft({
            contentPlan: {
              assignmentId: mm.contentAssignment.assignmentId,
              factsToUse: ["Unsupported factual claim without evidence."],
            } as ContentStrategistOutput["contentPlan"],
          }),
        requestGovernance: async () => {
          governanceCalls += 1;
          return {
            decision: "ALLOW",
            riskScore: 0,
            reasons: [],
            revisionHints: [],
            humanApprovalRequired: false,
            semanticAvailable: true,
          };
        },
      },
    );
    expect(result.failure?.code).toBe("governance_unavailable");
    expect(governanceCalls).toBe(0);
  });

  it("2: provider factual claims + evidenceRefs [] → malformed_model_output, GA not called", async () => {
    const err = expectContractError(() =>
      parseProviderContentPlan({
        assignmentId: "ca1",
        factsToUse: ["Official guidance says autumn travel planning is easier."],
        evidenceRefs: [],
      }),
    );
    expect(err.incidentClass).toBe("malformed_model_output");
    expect(err.validationIssue).toBe("evidence_refs_empty");

    let governanceCalls = 0;
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: mm.selectedAgenda,
        contentAssignment: mm.contentAssignment,
        contentPlanScaffold: mm.contentPlanScaffold,
      },
      {
        requestDraft: async () =>
          baseDraft({
            contentPlan: {
              assignmentId: mm.contentAssignment.assignmentId,
              factsToUse: ["Unsupported factual claim without evidence."],
              evidenceRefs: [],
            } as ContentStrategistOutput["contentPlan"],
          }),
        requestGovernance: async () => {
          governanceCalls += 1;
          return {
            decision: "ALLOW",
            riskScore: 0,
            reasons: [],
            revisionHints: [],
            humanApprovalRequired: false,
            semanticAvailable: true,
          };
        },
      },
    );
    expect(result.failure?.code).toBe("governance_unavailable");
    expect(governanceCalls).toBe(0);
  });

  it("3: provider no factual claims + evidenceRefs absent → valid, canonical [] after validation", () => {
    const raw = { assignmentId: "ca1", factsToUse: [] };
    expect(getProviderEvidencePresence(raw)).toBe("absent");
    const plan = parseProviderContentPlan(raw);
    expect(plan.evidenceRefs).toEqual([]);
  });

  it("4: provider no factual claims + evidenceRefs [] → valid", () => {
    const raw = { assignmentId: "ca1", factsToUse: [], evidenceRefs: [] };
    expect(getProviderEvidencePresence(raw)).toBe("empty");
    const plan = parseProviderContentPlan(raw);
    expect(plan.evidenceRefs).toEqual([]);
  });

  it("5: internal/scaffold factual claims + no evidence → invalid_state, GA not called", async () => {
    const draft: ContentStrategistOutput = {
      title: "Japan update",
      body: "Official guidance says autumn travel planning is easier to plan with verified sources.",
      channel: "threads",
      agenda: "Japan autumn",
      assignmentId: "ca_test",
    };
    const scaffoldPlan = {
      contract: CONTENT_PLAN_CONTRACT,
      assignmentId: "ca_test",
      recommendedFormats: [],
      primaryAngle: "angle",
      keyMessage: "message",
      targetAudience: "audience",
      hook: "hook",
      outline: [],
      factsToUse: ["Autumn travel planning is easier per official guidance."],
      factsToAvoid: [],
      ctaStrategy: "info",
      productLinkageStrategy: "none",
      evidenceRefs: [],
      requiredAssets: [],
      riskNotes: [],
      draftInstructions: [],
    };

    expect(() =>
      prepareContentToGovernanceHandoff({
        draft,
        productId: PRODUCT,
        channel: "threads",
        contentPlan: scaffoldPlan,
        contentPlanScaffold: scaffoldPlan,
        assignment: {
          assignmentId: "ca_test",
          contract: "content-assignment-v1",
          createdAt: NOW.toISOString(),
          selectedAgendaId: "sa_test",
          selectedAgendaTitle: "Japan",
          objective: "inform",
          topic: "Japan",
          audience: null,
          destinations: [],
          facts: [],
          commercialIntent: "informational",
          matchedProductIds: [],
          constraints: [],
          formatHints: [],
          requiredOutputs: ["text_draft"],
          deadline: null,
          evidenceRefs: [],
          riskNotes: [],
          provenance: {
            selectedAgendaId: "sa_test",
            createdBy: "marketing-manager-handoff",
            idempotencyKey: "k",
          },
        },
      }),
    ).toThrow(/content_plan_validation:invalid_state:missing_evidence_for_factual_claims/);

    let governanceCalls = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: {
          id: "sa_test",
          title: "Japan",
          summary: "s",
          contentObjective: "inform",
          commercialIntent: "informational",
          matchedProductIds: [],
          timelinessNote: null,
        },
        contentAssignment: {
          assignmentId: "ca_test",
          contract: "content-assignment-v1",
          createdAt: NOW.toISOString(),
          selectedAgendaId: "sa_test",
          selectedAgendaTitle: "Japan",
          objective: "inform",
          topic: "Japan",
          audience: null,
          destinations: [],
          facts: [],
          commercialIntent: "informational",
          matchedProductIds: [],
          constraints: [],
          formatHints: [],
          requiredOutputs: ["text_draft"],
          deadline: null,
          evidenceRefs: [],
          riskNotes: [],
          provenance: {
            selectedAgendaId: "sa_test",
            createdBy: "marketing-manager-handoff",
            idempotencyKey: "k",
          },
        },
        contentPlanScaffold: scaffoldPlan,
      },
      {
        requestDraft: async () => draft,
        requestGovernance: async () => {
          governanceCalls += 1;
          return {
            decision: "ALLOW",
            riskScore: 0,
            reasons: [],
            revisionHints: [],
            humanApprovalRequired: false,
            semanticAvailable: true,
          };
        },
      },
    );
    expect(result.failure?.code).toBe("governance_unavailable");
    expect(governanceCalls).toBe(0);
  });

  it("6: persisted factual claims + no evidence → invalid_state, GA not called", () => {
    const persistedPlan = {
      contract: CONTENT_PLAN_CONTRACT,
      assignmentId: "ca_test",
      recommendedFormats: [],
      primaryAngle: "angle",
      keyMessage: "message",
      targetAudience: "audience",
      hook: "hook",
      outline: [],
      factsToUse: ["Autumn travel planning is easier per official guidance."],
      factsToAvoid: [],
      ctaStrategy: "info",
      productLinkageStrategy: "none",
      evidenceRefs: [],
      requiredAssets: [],
      riskNotes: [],
      draftInstructions: [],
    };
    const err = expectContractError(() =>
      resolveContentPlanForGovernance({
        draft: baseDraft(),
        effectivePlan: persistedPlan,
        source: "persisted",
      }),
    );
    expect(err.incidentClass).toBe("invalid_state");
    expect(err.validationIssue).toBe("missing_evidence_for_factual_claims");
  });

  it("7: legacy assignment provenance used only when deterministic safe correspondence exists", () => {
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const legacy = { ...mm.contentPlanScaffold };
    const { evidenceRefs: _removed, ...withoutRefs } = legacy;
    expect(canSafelyAdaptLegacyEvidenceRefs(withoutRefs, mm.contentAssignment)).toBe(true);
    const adapted = validateInternalContentPlan(withoutRefs, "persisted", mm.contentAssignment);
    expect(adapted.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("8: unsafe legacy provenance mapping → invalid_state", () => {
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const unsafe = {
      ...mm.contentPlanScaffold,
      factsToUse: ["A fabricated fact that does not exist on the assignment."],
    };
    const { evidenceRefs: _removed, ...withoutRefs } = unsafe;
    expect(canSafelyAdaptLegacyEvidenceRefs(withoutRefs, mm.contentAssignment)).toBe(false);
    const err = expectContractError(() =>
      validateInternalContentPlan(withoutRefs, "persisted", mm.contentAssignment),
    );
    expect(err.incidentClass).toBe("invalid_state");
    expect(err.validationIssue).toBe("legacy_unsafe");
  });

  it("9: valid facts + valid provenance → GA called exactly once", async () => {
    let governanceCalls = 0;
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "test",
        selectedAgenda: mm.selectedAgenda,
        contentAssignment: mm.contentAssignment,
        contentPlanScaffold: mm.contentPlanScaffold,
      },
      {
        requestDraft: async () =>
          baseDraft({
            contentPlan: parseProviderContentPlan(
              validProviderPlan(mm.contentAssignment.assignmentId, { factsToUse: [] }),
            ),
          }),
        requestGovernance: async () => {
          governanceCalls += 1;
          return {
            decision: "ALLOW",
            riskScore: 0,
            reasons: [],
            revisionHints: [],
            humanApprovalRequired: false,
            semanticAvailable: true,
          };
        },
      },
    );
    expect(result.governance?.decision).toBe("ALLOW");
    expect(governanceCalls).toBe(1);
  });

  it("10: revision facts + missing provenance → malformed_model_output, GA not called", () => {
    const err = expectContractError(() =>
      parseProviderContentPlan(
        {
          assignmentId: "ca1",
          factsToUse: ["Official guidance says autumn travel planning is easier."],
        },
        "revision",
      ),
    );
    expect(err.incidentClass).toBe("malformed_model_output");
    expect(err.validationIssue).toBe("evidence_refs_absent");

    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    expect(() =>
      prepareContentToGovernanceHandoff({
        draft: baseDraft({
          contentPlan: {
            assignmentId: mm.contentAssignment.assignmentId,
            factsToUse: ["Unsupported factual claim without evidence."],
          } as ContentStrategistOutput["contentPlan"],
        }),
        priorRevision: 1,
        assignment: mm.contentAssignment,
        selectedAgenda: mm.selectedAgenda,
        productId: PRODUCT,
        channel: "threads",
        contentPlan: {
          assignmentId: mm.contentAssignment.assignmentId,
          factsToUse: ["Unsupported factual claim without evidence."],
        } as NonNullable<ContentStrategistOutput["contentPlan"]>,
      }),
    ).toThrow(/evidence_refs_absent|malformed_model_output|content_plan_validation/);
  });

  it("11: provider missing vs explicit [] remain distinguishable until semantic validation", () => {
    const absentRaw = { assignmentId: "ca1", factsToUse: ["Official guidance says autumn travel planning is easier."] };
    const emptyRaw = {
      assignmentId: "ca1",
      factsToUse: ["Official guidance says autumn travel planning is easier."],
      evidenceRefs: [],
    };
    expect(getProviderEvidencePresence(absentRaw)).toBe("absent");
    expect(getProviderEvidencePresence(emptyRaw)).toBe("empty");

    const absentErr = expectContractError(() => parseProviderContentPlan(absentRaw));
    const emptyErr = expectContractError(() => parseProviderContentPlan(emptyRaw));
    expect(absentErr.validationIssue).toBe("evidence_refs_absent");
    expect(emptyErr.validationIssue).toBe("evidence_refs_empty");
    expect(absentErr.validationIssue).not.toBe(emptyErr.validationIssue);
  });

  it("valid ContentPlan and valid evidenceRefs pass internal scaffold", () => {
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official update.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const scaffold = buildContentPlanScaffold(mm.contentAssignment, mm.selectedAgenda);
    const validated = validateInternalContentPlan(scaffold, "internal_scaffold", mm.contentAssignment);
    expect(validated.contract).toBe(CONTENT_PLAN_CONTRACT);
    expect(validated.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("evidenceRefs wrong type/shape → malformed_model_output", () => {
    expect(() =>
      parseProviderContentPlan({
        assignmentId: "ca1",
        evidenceRefs: "not-array",
      }),
    ).toThrow(ContentPlanContractError);

    expect(() =>
      parseProviderContentPlan({
        assignmentId: "ca1",
        evidenceRefs: [{ evidenceId: "x" }],
      }),
    ).toThrow(ContentPlanContractError);
  });

  it("oversized evidenceRefs and facts rejected", () => {
    expect(() =>
      parseProviderContentPlan({
        assignmentId: "ca1",
        evidenceRefs: Array.from({ length: 20 }, (_, i) => ({
          evidenceId: `ev-${i}`,
          sourceId: `src-${i}`,
          sourceType: null,
          sourceName: null,
          isOfficial: false,
          evidenceType: "internal",
          url: null,
          reference: null,
          excerpt: null,
          publishedAt: null,
          observedAt: NOW.toISOString(),
          credibilityHint: null,
        })),
      }),
    ).toThrow(ContentPlanContractError);

    expect(() =>
      parseProviderContentPlan({
        assignmentId: "ca1",
        factsToUse: Array.from({ length: 20 }, (_, i) => `fact ${i} long enough`),
        evidenceRefs: [evidenceRefPayload],
      }),
    ).toThrow(ContentPlanContractError);
  });

  it("malformed vs valid raw provider structured output", () => {
    expect(() => parseContentStrategistOutput(JSON.stringify({ body: "ok", contentPlan: { bad: true } }))).toThrow(
      /content_plan_validation|content-strategist/,
    );

    const parsed = parseContentStrategistOutput(
      JSON.stringify({
        body: "Official guidance says autumn travel planning is easier.",
        contentPlan: validProviderPlan("ca1"),
      }),
    );
    expect(parsed.contentPlan?.assignmentId).toBe("ca1");
  });

  it("failure taxonomy: provider vs internal classification", () => {
    const malformed = classifyMarketingIncident({
      pipelineFailureMessage:
        "content_plan_validation:malformed_model_output:evidence_refs_absent:Provider contentPlan has factual claims but evidenceRefs field is absent",
    });
    expect(malformed.incidentClass).toBe("malformed_model_output");

    const invalid = classifyMarketingIncident({
      pipelineFailureMessage:
        "content_plan_validation:invalid_state:missing_evidence_for_factual_claims:Factual claims",
    });
    expect(invalid.incidentClass).toBe("invalid_state");
  });

  it("scaffold-only path with assignment evidence does not throw map error", () => {
    const mm = prepareManagerToContentHandoff(
      { title: "Japan", summary: "Official.", evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)] },
      { now: NOW },
    );
    const draft = baseDraft();
    expect(() =>
      prepareContentToGovernanceHandoff({
        draft,
        assignment: mm.contentAssignment,
        selectedAgenda: mm.selectedAgenda,
        productId: PRODUCT,
        channel: "threads",
        contentPlan: mm.contentPlanScaffold,
        contentPlanScaffold: mm.contentPlanScaffold,
      }),
    ).not.toThrow(/reading 'map'/);
  });

  it("2026-09-02 incident TypeError maps to invalid_state", () => {
    const assessment = classifyMarketingIncident({
      pipelineFailureCode: "governance_unavailable",
      pipelineFailureMessage: "Cannot read properties of undefined (reading 'map')",
      revisionCount: 0,
      governanceReviewId: null,
    });
    expect(assessment.incidentClass).toBe("invalid_state");
  });

  it("telemetry absence alone remains unknown", () => {
    const assessment = classifyMarketingIncident({
      failureReason: "GOVERNANCE_FAILED",
      revisionCount: 0,
      governanceReviewId: null,
    });
    expect(assessment.incidentClass).toBe("unknown");
    expect(assessment.incidentClass).not.toBe("runtime_unavailable");
  });

  it("existing incident classes preserved", () => {
    expect(
      classifyMarketingIncident({ failureReason: "GOVERNANCE_BLOCKED", candidateStatus: "blocked" }).incidentClass,
    ).toBe("business_rule_block");
    expect(
      classifyMarketingIncident({
        pipelineFailureMessage: "AI Runtime Gateway unavailable",
      }).incidentClass,
    ).toBe("runtime_unavailable");
    expect(
      classifyMarketingIncident({
        pipelineFailureMessage: "governance-auditor returned no ALLOW/REVIEW/BLOCK",
      }).incidentClass,
    ).toBe("malformed_model_output");
  });
});
