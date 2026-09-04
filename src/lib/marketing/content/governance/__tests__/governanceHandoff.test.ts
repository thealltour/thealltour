vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { prepareManagerToContentHandoff } from "@/lib/marketing/content/prepareManagerToContentHandoff";
import { prepareContentToGovernanceHandoff } from "@/lib/marketing/content/governance/prepareContentToGovernanceHandoff";
import { evaluateDeterministicClaimSignals } from "@/lib/marketing/content/governance/evaluateDeterministicClaimSignals";
import { normalizeGovernanceReviewResult } from "@/lib/marketing/content/governance/normalizeGovernanceReviewResult";
import {
  createInMemoryGovernanceReviewStore,
  getAssignmentGovernanceStatus,
  getGovernanceReviewById,
  recordGovernanceReview,
} from "@/lib/marketing/content/governance/store/governanceReviewStore";
import { mapManagerEvidenceRef } from "@/lib/marketing/content/evidence";
import type { CompactManagerEvidenceRef } from "@/lib/marketing/research/manager/types";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import { MAX_AUTO_REVISION_ROUNDS } from "@/lib/marketing/bot/organization/envelope";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";

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

describe("prepareContentToGovernanceHandoff", () => {
  it("builds bounded request with assignment and agenda linkage", () => {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Japan autumn guidance",
        summary: "Official update for travelers.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      title: "Japan update",
      body: "Official guidance says autumn travel is easier to plan.",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: ["evidence:ev-official"],
      assignmentId: mm.contentAssignment.assignmentId,
      contentPlan: mm.contentPlanScaffold,
    };
    const handoff = prepareContentToGovernanceHandoff({
      draft,
      assignment: mm.contentAssignment,
      selectedAgenda: mm.selectedAgenda,
      contentPlan: mm.contentPlanScaffold,
      productId: PRODUCT,
      channel: "threads",
    });
    expect(handoff.request.contract).toBe("governance-review-request-v1");
    expect(handoff.request.assignmentId).toBe(mm.contentAssignment.assignmentId);
    expect(handoff.request.selectedAgendaId).toBe(mm.selectedAgenda.id);
    expect(handoff.request.evidenceRefs[0]?.url).toBe(officialEvidence.url);
    expect(jsonContainsForbiddenBotLeak(handoff.request)).toBe(false);
  });

  it("keeps productless informational draft valid", () => {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Grand Canyon reopening",
        summary: "Useful safety update.",
        commercialIntent: "informational",
        matchedProductIds: [],
      },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      body: "The canyon reopened on a limited basis after floods.",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: [],
      assignmentId: mm.contentAssignment.assignmentId,
    };
    const signals = evaluateDeterministicClaimSignals({
      draft,
      assignment: mm.contentAssignment,
      now: NOW,
    });
    expect(mm.contentAssignment.matchedProductIds).toHaveLength(0);
    expect(signals.commercialRisks).not.toContain("missing_product_linkage");
  });

  it("legacy internal plan without evidenceRefs field uses assignment provenance when correspondence is safe", () => {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Japan autumn guidance",
        summary: "Official update for travelers.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { now: NOW },
    );
    const { evidenceRefs: _removed, ...scaffoldWithoutRefs } = mm.contentPlanScaffold;
    const draft: ContentStrategistOutput = {
      title: "Japan update",
      body: "Official guidance says autumn travel is easier to plan.",
      channel: "threads",
      agenda: "Japan autumn",
      assignmentId: mm.contentAssignment.assignmentId,
    };
    expect(() =>
      prepareContentToGovernanceHandoff({
        draft,
        productId: PRODUCT,
        channel: "threads",
        assignment: mm.contentAssignment,
        selectedAgenda: mm.selectedAgenda,
        contentPlan: scaffoldWithoutRefs,
        contentPlanScaffold: mm.contentPlanScaffold,
      }),
    ).not.toThrow();
  });

  it("provider contentPlan facts without evidenceRefs fails at provider contract boundary", () => {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Japan autumn guidance",
        summary: "Official update for travelers.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      title: "Japan update",
      body: "Official guidance says autumn travel is easier to plan.",
      channel: "threads",
      agenda: "Japan autumn",
      contentPlan: {
        assignmentId: mm.contentAssignment.assignmentId,
        factsToUse: ["Autumn travel planning is easier per official guidance."],
      } as ContentStrategistOutput["contentPlan"],
      assignmentId: mm.contentAssignment.assignmentId,
    };
    expect(() =>
      prepareContentToGovernanceHandoff({
        draft,
        productId: PRODUCT,
        channel: "threads",
        assignment: mm.contentAssignment,
        selectedAgenda: mm.selectedAgenda,
        contentPlan: draft.contentPlan as NonNullable<ContentStrategistOutput["contentPlan"]>,
      }),
    ).toThrow(/evidence_refs_absent|malformed_model_output|content_plan_validation/);
  });

  it("fails closed when factual claims lack any evidence provenance", () => {
    const draft: ContentStrategistOutput = {
      title: "Japan update",
      body: "Official guidance says autumn travel planning is easier to plan with verified sources.",
      channel: "threads",
      agenda: "Japan autumn",
      contentPlan: {
        contract: "content-plan-v1",
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
      },
      assignmentId: "ca_test",
    };
    expect(() =>
      prepareContentToGovernanceHandoff({
        draft,
        productId: PRODUCT,
        channel: "threads",
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
    ).toThrow(/missing_evidence_for_factual_claims|content_plan_validation/);
  });
});

describe("deterministic claim signals", () => {
  it("flags unsupported exact price claims", () => {
    const draft: ContentStrategistOutput = {
      body: "Join now for only 990,000원 with guaranteed departure.",
      channel: "threads",
      agenda: "promo",
      sourceReferences: [],
    };
    const signals = evaluateDeterministicClaimSignals({ draft, now: NOW });
    expect(signals.factualRisks).toContain("unsupported_exact_price");
    expect(signals.commercialRisks.some((r) => /guarantee|commercial_price/i.test(r))).toBe(true);
  });

  it("flags unsupported visa/entry claims", () => {
    const draft: ContentStrategistOutput = {
      body: "Visa-free entry is now available for all travelers.",
      channel: "threads",
      agenda: "visa",
      sourceReferences: [],
    };
    const signals = evaluateDeterministicClaimSignals({ draft, now: NOW });
    expect(signals.factualRisks).toContain("unsupported_visa_entry_claim");
  });

  it("detects CS-added facts absent from assignment evidence", () => {
    const mm = prepareManagerToContentHandoff(
      { title: "Topic", summary: "Base summary only.", evidenceRefs: [] },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      body: "Visa-free entry is now available immediately.",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: [],
      assignmentId: mm.contentAssignment.assignmentId,
    };
    const signals = evaluateDeterministicClaimSignals({
      draft,
      assignment: mm.contentAssignment,
      now: NOW,
    });
    expect(signals.factualRisks).toContain("cs_added_unverified_claim");
  });

  it("surfaces stale evidence ids", () => {
    const stale = {
      ...officialEvidence,
      evidenceId: "ev-stale",
      publishedAt: "2025-01-01T00:00:00.000Z",
      observedAt: "2025-01-02T00:00:00.000Z",
    };
    const mm = prepareManagerToContentHandoff(
      {
        title: "Stale topic",
        summary: "Old guidance.",
        evidenceRefs: [mapManagerEvidenceRef(stale, 0.8)],
      },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      body: "Old guidance still applies.",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: [],
      assignmentId: mm.contentAssignment.assignmentId,
    };
    const handoff = prepareContentToGovernanceHandoff({
      draft,
      assignment: mm.contentAssignment,
      selectedAgenda: mm.selectedAgenda,
      contentPlanScaffold: mm.contentPlanScaffold,
      productId: PRODUCT,
      channel: "threads",
    });
    expect(handoff.request.preflightSignals.staleEvidenceIds).toContain("ev-stale");
  });
});

describe("normalizeGovernanceReviewResult", () => {
  it("adds requiredRevisions on BLOCK when GA omitted hints", () => {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Price promo",
        summary: "Promo",
        evidenceRefs: [],
      },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      body: "Only 990,000원 today.",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: [],
      assignmentId: mm.contentAssignment.assignmentId,
    };
    const { request } = prepareContentToGovernanceHandoff({
      draft,
      assignment: mm.contentAssignment,
      contentPlanScaffold: mm.contentPlanScaffold,
      productId: PRODUCT,
      channel: "threads",
    });
    const normalized = normalizeGovernanceReviewResult(
      { decision: "BLOCK", riskScore: 0.9, reasons: [], revisionHints: [], humanApprovalRequired: false, semanticAvailable: true },
      request,
      NOW,
    );
    expect(normalized.handoff.revisionHints.length).toBeGreaterThan(0);
    expect(normalized.structured.requiredRevisions.length).toBeGreaterThan(0);
  });

  it("fails closed to REVIEW on malformed GA response", () => {
    const mm = prepareManagerToContentHandoff({ title: "Topic", summary: "Summary" }, { now: NOW });
    const { request } = prepareContentToGovernanceHandoff({
      draft: { body: "Hello", channel: "threads", agenda: null, sourceReferences: [] },
      assignment: mm.contentAssignment,
      contentPlanScaffold: mm.contentPlanScaffold,
      productId: PRODUCT,
      channel: "threads",
    });
    const normalized = normalizeGovernanceReviewResult(
      { decision: "MAYBE" as "ALLOW", riskScore: 0, reasons: [], revisionHints: [], humanApprovalRequired: false, semanticAvailable: true },
      request,
      NOW,
    );
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.structured.malformed).toBe(true);
  });

  function baseRequest() {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Scotland note",
        summary: "Travel update.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.9)],
      },
      { now: NOW },
    );
    const { request } = prepareContentToGovernanceHandoff({
      draft: {
        body: "Official guidance says autumn travel is easier to plan.",
        channel: "threads",
        agenda: mm.selectedAgenda.title,
        sourceReferences: ["evidence:ev-official"],
      },
      assignment: mm.contentAssignment,
      contentPlanScaffold: mm.contentPlanScaffold,
      productId: PRODUCT,
      channel: "threads",
    });
    return request;
  }

  it("ALLOW + no gaps -> ALLOW", () => {
    const request = {
      ...baseRequest(),
      preflightSignals: {
        unsupportedClaims: [],
        factualRisks: [],
        evidenceGaps: [],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: [],
      },
    };
    const normalized = normalizeGovernanceReviewResult(allow({ riskScore: 0 }), request, NOW);
    expect(normalized.structured.decision).toBe("ALLOW");
    expect(normalized.structured.riskScore).toBe(0);
    expect(normalized.structured.reasons).not.toContain("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
  });

  it("ALLOW + unsupported claim -> REVIEW with grounding reason", () => {
    const request = {
      ...baseRequest(),
      preflightSignals: {
        unsupportedClaims: ["claim_1"],
        factualRisks: [],
        evidenceGaps: [],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: [],
      },
    };
    const normalized = normalizeGovernanceReviewResult(allow({ riskScore: 0 }), request, NOW);
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.handoff.decision).toBe("REVIEW");
    expect(normalized.structured.humanApprovalRequired).toBe(true);
    expect(normalized.structured.reasons).toContain("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
    expect(normalized.structured.riskScore).toBe(0);
  });

  it("ALLOW + evidence gap -> REVIEW", () => {
    const request = {
      ...baseRequest(),
      preflightSignals: {
        unsupportedClaims: [],
        factualRisks: [],
        evidenceGaps: ["Missing source for schedule claim"],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: [],
      },
    };
    const normalized = normalizeGovernanceReviewResult(allow({ riskScore: 0 }), request, NOW);
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.structured.reasons[0]).toBe("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
  });

  it("REVIEW remains REVIEW", () => {
    const request = {
      ...baseRequest(),
      preflightSignals: {
        unsupportedClaims: ["claim_1"],
        factualRisks: [],
        evidenceGaps: [],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: [],
      },
    };
    const normalized = normalizeGovernanceReviewResult(
      allow({ decision: "REVIEW", humanApprovalRequired: true, reasons: ["EXISTING_REVIEW"] }),
      request,
      NOW,
    );
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.structured.reasons).toContain("EXISTING_REVIEW");
    expect(normalized.structured.reasons).not.toContain("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
  });

  it("BLOCK remains BLOCK", () => {
    const request = {
      ...baseRequest(),
      preflightSignals: {
        unsupportedClaims: ["claim_1"],
        factualRisks: ["policy"],
        evidenceGaps: ["gap"],
        commercialRisks: [],
        staleEvidenceIds: [],
        suggestedConcerns: ["fix it"],
      },
    };
    const normalized = normalizeGovernanceReviewResult(
      allow({ decision: "BLOCK", riskScore: 0.9, reasons: ["POLICY_BLOCK"] }),
      request,
      NOW,
    );
    expect(normalized.structured.decision).toBe("BLOCK");
    expect(normalized.structured.reasons).toContain("POLICY_BLOCK");
    expect(normalized.structured.reasons).not.toContain("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW");
  });

  it("policy risk / malformed behavior unchanged", () => {
    const request = baseRequest();
    const normalized = normalizeGovernanceReviewResult(
      { decision: "WEIRD" as "ALLOW", riskScore: 0.1, reasons: [], revisionHints: [], humanApprovalRequired: false, semanticAvailable: true },
      request,
      NOW,
    );
    expect(normalized.structured.decision).toBe("REVIEW");
    expect(normalized.structured.malformed).toBe(true);
    expect(normalized.structured.policyRisks).toContain("governance_response_malformed");
    expect(normalized.structured.riskScore).toBeGreaterThanOrEqual(0.75);
  });
});

describe("governance review store", () => {
  let store: ReturnType<typeof createInMemoryGovernanceReviewStore>;

  beforeEach(() => {
    store = createInMemoryGovernanceReviewStore();
  });

  it("records reviews idempotently", () => {
    const mm = prepareManagerToContentHandoff({ title: "Topic", summary: "Summary" }, { now: NOW });
    const draft: ContentStrategistOutput = {
      body: "Draft",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: [],
      assignmentId: mm.contentAssignment.assignmentId,
    };
    const { request } = prepareContentToGovernanceHandoff({
      draft,
      assignment: mm.contentAssignment,
      contentPlanScaffold: mm.contentPlanScaffold,
      productId: PRODUCT,
      channel: "threads",
    });
    const key = `idem-${request.reviewId}`;
    const first = recordGovernanceReview({ request, decision: null, idempotencyKey: key, store, now: NOW });
    const second = recordGovernanceReview({ request, decision: null, idempotencyKey: key, store, now: NOW });
    expect(second.reviewId).toBe(first.reviewId);
    const lookup = getGovernanceReviewById(first.reviewId, store);
    expect(lookup.status).toBe("ok");
    const status = getAssignmentGovernanceStatus(mm.contentAssignment.assignmentId, store);
    expect(status.status).toBe("ok");
  });
});

describe("pipeline governance integration", () => {
  it("passes structured governance request and preserves one revision on BLOCK", async () => {
    const mm = prepareManagerToContentHandoff(
      {
        title: "Scotland trend",
        summary: "Travel note.",
        evidenceRefs: [mapManagerEvidenceRef(officialEvidence, 0.85)],
      },
      { now: NOW },
    );
    const draft: ContentStrategistOutput = {
      title: "Scotland",
      body: "Trend note grounded in evidence.",
      channel: "threads",
      agenda: mm.selectedAgenda.title,
      sourceReferences: ["evidence:ev-official"],
      assignmentId: mm.contentAssignment.assignmentId,
      contentPlan: mm.contentPlanScaffold,
    };
    let reviews = 0;
    let sawStructured = false;
    let revisionDrafts = 0;

    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "daily",
        selectedAgenda: mm.selectedAgenda,
        contentAssignment: mm.contentAssignment,
        contentPlanScaffold: mm.contentPlanScaffold,
      },
      {
        requestDraft: async (envelope) => {
          if ((envelope.payload.constraints ?? []).some((c) => c.startsWith("revision:"))) {
            revisionDrafts += 1;
          }
          return draft;
        },
        requestGovernance: async (envelope) => {
          reviews += 1;
          if (envelope.payload.contract === "governance-review-request-v1") {
            sawStructured = true;
            expect(envelope.payload.assignmentId).toBe(mm.contentAssignment.assignmentId);
          }
          return allow({
            decision: "BLOCK",
            reasons: ["unsupported_exact_price"],
            revisionHints: [],
          });
        },
      },
    );

    expect(sawStructured).toBe(true);
    expect(reviews).toBe(1 + MAX_AUTO_REVISION_ROUNDS);
    expect(revisionDrafts).toBe(1);
    expect(result.revisionRounds).toBe(1);
    expect(result.status).toBe("revision_required");
  });

  it("does not auto-revise on REVIEW", async () => {
    const mm = prepareManagerToContentHandoff(
      { title: "Info note", summary: "Short update.", commercialIntent: "informational" },
      { now: NOW },
    );
    let drafts = 0;
    const result = await runDepartmentPipeline(
      {
        productId: PRODUCT,
        channel: "threads",
        goal: "daily",
        selectedAgenda: mm.selectedAgenda,
        contentAssignment: mm.contentAssignment,
        contentPlanScaffold: mm.contentPlanScaffold,
      },
      {
        requestDraft: async () => {
          drafts += 1;
          return {
            body: "Informational note.",
            channel: "threads",
            agenda: null,
            sourceReferences: [],
          };
        },
        requestGovernance: async () =>
          allow({ decision: "REVIEW", reasons: ["SEMANTIC_SIMILARITY_REVIEW"], humanApprovalRequired: true }),
      },
    );
    expect(drafts).toBe(1);
    expect(result.status).toBe("approval_pending");
    expect(result.revisionRounds).toBe(0);
  });
});
