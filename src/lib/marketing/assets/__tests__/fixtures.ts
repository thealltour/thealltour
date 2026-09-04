import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";
import type { StructuredGovernanceDecision } from "@/lib/marketing/content/governance/types";
import {
  CONTENT_ASSIGNMENT_CONTRACT,
  CONTENT_PLAN_CONTRACT,
  SELECTED_AGENDA_CONTRACT,
  type AssignmentEvidenceRef,
  type ContentAssignment,
  type ContentPlan,
  type SelectedAgenda,
} from "@/lib/marketing/content/types";
import {
  COMPLETED_MARKETING_CANDIDATE_CONTRACT,
  type CompletedMarketingCandidate,
} from "@/lib/marketing/cron/daily/types";

export const NOW = new Date("2026-09-03T00:00:00.000Z");
export const BUSINESS_DATE = "2026-09-03";
export const CANDIDATE_ID = "cmc_daily_marketing_plan_2026_09_03";

export const officialEvidence: AssignmentEvidenceRef = {
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

export function buildSelectedAgenda(overrides: Partial<SelectedAgenda> = {}): SelectedAgenda {
  return {
    contract: SELECTED_AGENDA_CONTRACT,
    id: "sa_test_japan_autumn",
    decidedAt: NOW.toISOString(),
    title: "Japan autumn travel update",
    summary: "Official guidance changed for autumn travelers.",
    rationale: ["timely official update"],
    destinations: ["Japan"],
    topics: ["travel", "autumn"],
    entities: ["JNTO"],
    contentObjective: "Inform travelers about official autumn guidance",
    audienceHint: "Korea-based Japan travelers",
    commercialIntent: "informational",
    matchedProductIds: [],
    evidenceRefs: [officialEvidence],
    constraints: [],
    urgency: "normal",
    timelinessNote: "Guidance updated this week",
    provenance: {
      decidedBy: "marketing-manager",
      managerDecisionSource: "research_assisted",
      researchScoreAtSelection: 0.72,
      agendaCandidateId: "ac-japan-autumn",
      researchBriefId: "rb-japan-autumn",
    },
    ...overrides,
  };
}

export function buildAssignment(overrides: Partial<ContentAssignment> = {}): ContentAssignment {
  return {
    contract: CONTENT_ASSIGNMENT_CONTRACT,
    assignmentId: "ca_test_japan_autumn",
    createdAt: NOW.toISOString(),
    selectedAgendaId: "sa_test_japan_autumn",
    selectedAgendaTitle: "Japan autumn travel update",
    objective: "Inform travelers about official autumn guidance",
    topic: "Japan autumn travel",
    audience: "Korea-based Japan travelers",
    destinations: ["Japan"],
    facts: [
      {
        factId: "summary",
        statement: "Official guidance changed for autumn travelers.",
        evidenceRefs: ["ev-official"],
        confidence: "high",
      },
    ],
    commercialIntent: "informational",
    matchedProductIds: [],
    constraints: [],
    formatHints: [
      { format: "threads_text", score: 0.8, rationale: "concise update" },
      { format: "instagram_carousel", score: 0.7, rationale: "fact slides" },
      { format: "short_video_concept", score: 0.5, rationale: "destination hook" },
    ],
    requiredOutputs: ["content_plan", "text_draft"],
    deadline: null,
    evidenceRefs: [officialEvidence],
    riskNotes: [],
    provenance: {
      selectedAgendaId: "sa_test_japan_autumn",
      createdBy: "marketing-manager-handoff",
      idempotencyKey: "test-japan-autumn",
    },
    ...overrides,
  };
}

export function buildContentPlan(overrides: Partial<ContentPlan> = {}): ContentPlan {
  return {
    contract: CONTENT_PLAN_CONTRACT,
    assignmentId: "ca_test_japan_autumn",
    recommendedFormats: [
      { format: "threads_text", score: 0.8, rationale: "concise update" },
      { format: "instagram_carousel", score: 0.7, rationale: "fact slides" },
      { format: "short_video_concept", score: 0.5, rationale: "destination hook" },
    ],
    primaryAngle: "Official guidance changed for autumn travelers.",
    keyMessage: "Japan autumn travel update",
    targetAudience: "Korea-based Japan travelers",
    hook: "Official autumn travel guidance was updated.",
    outline: ["Why the update matters", "What changed", "How travelers can prepare"],
    factsToUse: ["Official guidance changed for autumn travelers."],
    factsToAvoid: [],
    ctaStrategy: "Informational CTA only — no hard sell.",
    productLinkageStrategy: "Informational content is valid without product linkage.",
    evidenceRefs: [officialEvidence],
    requiredAssets: ["destination imagery", "fact slides"],
    riskNotes: [],
    draftInstructions: ["Use only factsToUse"],
    ...overrides,
  };
}

export function buildDraft(overrides: Partial<ContentStrategistOutput> = {}): ContentStrategistOutput {
  return {
    title: "Japan autumn update",
    body: "Official guidance says autumn travel planning is easier.\n\nCheck the latest JNTO notes before you go.",
    channel: "threads",
    agenda: "Japan autumn travel update",
    sourceReferences: ["evidence:ev-official"],
    ...overrides,
  };
}

export function buildGovernance(
  overrides: Partial<StructuredGovernanceDecision> = {},
): StructuredGovernanceDecision {
  return {
    contract: "governance-decision-v1",
    reviewId: "gr_test",
    assignmentId: "ca_test_japan_autumn",
    decidedAt: NOW.toISOString(),
    decision: "ALLOW",
    reasons: ["NO_RISK_SIGNAL"],
    unsupportedClaims: [],
    factualRisks: [],
    evidenceGaps: [],
    commercialRisks: [],
    policyRisks: [],
    requiredRevisions: [],
    verifiedEvidenceRefs: ["ev-official"],
    riskScore: 0,
    humanApprovalRequired: false,
    semanticAvailable: true,
    revisionHints: [],
    claimCount: 1,
    unsupportedClaimCount: 0,
    evidenceGapCount: 0,
    revisionNumber: 0,
    malformed: false,
    ...overrides,
  };
}

export function buildTestCandidate(
  overrides: Partial<CompletedMarketingCandidate> = {},
): CompletedMarketingCandidate {
  const selectedAgenda = buildSelectedAgenda();
  const contentAssignment = buildAssignment();
  const contentPlan = buildContentPlan();
  const draft = buildDraft();
  const governanceDecision = buildGovernance();

  return {
    contract: COMPLETED_MARKETING_CANDIDATE_CONTRACT,
    candidateId: CANDIDATE_ID,
    runId: "run_test",
    logicalRunKey: "daily-marketing-plan:2026-09-03",
    businessDateKst: BUSINESS_DATE,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    selectedAgenda,
    contentAssignment,
    contentPlan,
    draft,
    governanceDecision,
    status: "ready_for_human_review",
    revisionHistory: [{ revisionNumber: 0, governanceDecision: "ALLOW" }],
    provenance: {
      routineId: "daily-marketing-plan",
      correlationId: "corr_test",
      researchStatus: "ok",
      governanceReviewId: "gr_test",
    },
    observability: {
      runId: "run_test",
      logicalRunKey: "daily-marketing-plan:2026-09-03",
      businessDateKst: BUSINESS_DATE,
      correlationId: "corr_test",
      researchStatus: "ok",
      candidateCount: 1,
      selectedAgendaId: selectedAgenda.id,
      assignmentId: contentAssignment.assignmentId,
      governanceReviewId: "gr_test",
      revisionCount: 0,
      governanceDecision: "ALLOW",
      finalCandidateId: CANDIDATE_ID,
      finalStatus: "ready_for_human_review",
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      failureReason: null,
    },
    ...overrides,
  };
}
