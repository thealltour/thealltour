import { describe, expect, it } from "vitest";

import { mapPipelineToCandidateStatus } from "@/lib/marketing/cron/daily/mapPipelineResult";
import type { DepartmentPipelineResult } from "@/lib/marketing/bot/organization/pipeline";
import type { StructuredGovernanceDecision } from "@/lib/marketing/content/governance/types";

function pipeline(
  overrides: Partial<DepartmentPipelineResult> = {},
): DepartmentPipelineResult {
  return {
    status: "publish_ready",
    publishActionIncluded: false,
    agentIdentityEnforcement: "strict",
    performance: { tokens: 0, costUsd: 0, latencyMs: 0 },
    draft: null,
    envelopes: [],
    revisionRounds: 0,
    nextAction: "human_review",
    ...overrides,
  } as DepartmentPipelineResult;
}

function gov(decision: "ALLOW" | "REVIEW" | "BLOCK"): StructuredGovernanceDecision {
  return {
    contract: "governance-decision-v1",
    decision,
    reviewId: "gov_test",
    assignmentId: null,
    riskScore: 0,
    reasons: [],
    factualRisks: [],
    policyRisks: [],
    commercialRisks: [],
    unsupportedClaims: [],
    evidenceGaps: [],
    requiredRevisions: [],
    revisionHints: [],
    verifiedEvidenceRefs: [],
    decidedAt: new Date().toISOString(),
    malformed: false,
    humanApprovalRequired: decision !== "ALLOW",
    semanticAvailable: true,
    claimCount: 0,
    unsupportedClaimCount: 0,
    evidenceGapCount: 0,
    revisionNumber: 0,
  };
}

describe("mapPipelineToCandidateStatus", () => {
  it("maps governance BLOCK to blocked", () => {
    expect(mapPipelineToCandidateStatus(pipeline({ status: "revision_required" }), gov("BLOCK"))).toBe(
      "blocked",
    );
  });

  it("maps completeness revision_required without governance to needs_human_review (not blocked)", () => {
    expect(mapPipelineToCandidateStatus(pipeline({ status: "revision_required" }), null)).toBe(
      "needs_human_review",
    );
  });

  it("maps ALLOW + publish_ready to ready_for_human_review", () => {
    expect(mapPipelineToCandidateStatus(pipeline({ status: "publish_ready" }), gov("ALLOW"))).toBe(
      "ready_for_human_review",
    );
  });
});
