import type { GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import type {
  StructuredGovernanceDecision,
  StructuredGovernanceReviewRequest,
} from "@/lib/marketing/content/governance/types";
import { GOVERNANCE_DECISION_CONTRACT } from "@/lib/marketing/content/governance/types";

const VALID_DECISIONS = new Set(["ALLOW", "REVIEW", "BLOCK"]);

export function normalizeGovernanceReviewResult(
  raw: GovernanceReviewResult,
  request: StructuredGovernanceReviewRequest,
  now = new Date(),
): { handoff: GovernanceReviewResult; structured: StructuredGovernanceDecision } {
  const decisionRaw = String(raw?.decision ?? "").toUpperCase();
  const malformed = !VALID_DECISIONS.has(decisionRaw);

  const decision = malformed
    ? "REVIEW"
    : (decisionRaw as StructuredGovernanceDecision["decision"]);

  const preflight = request.preflightSignals;
  const unsupportedClaims = [
    ...preflight.unsupportedClaims,
    ...(raw.reasons ?? []).filter((reason) => /unsupported|unverified|missing/i.test(reason)),
  ].slice(0, 12);

  const requiredRevisions = [...(raw.revisionHints ?? [])];
  if (decision === "BLOCK" && requiredRevisions.length === 0) {
    if (preflight.suggestedConcerns.length > 0) {
      requiredRevisions.push(...preflight.suggestedConcerns.slice(0, 3));
    } else {
      requiredRevisions.push("Revise unsupported or unverified factual claims before resubmitting.");
    }
  }

  const evidenceGaps = preflight.evidenceGaps;
  const reasons = malformed
    ? ["MALFORMED_GA_RESPONSE"]
    : (raw.reasons ?? []).map(String).slice(0, 16);

  // Factual grounding floor: ALLOW with grounding gaps must become REVIEW (never auto-BLOCK).
  let finalDecision = decision;
  let finalReasons = reasons;
  let humanApprovalRequired = malformed
    ? true
    : Boolean(raw.humanApprovalRequired) || decision === "REVIEW";

  if (
    !malformed &&
    finalDecision === "ALLOW" &&
    (unsupportedClaims.length > 0 || evidenceGaps.length > 0)
  ) {
    finalDecision = "REVIEW";
    humanApprovalRequired = true;
    if (!finalReasons.includes("FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW")) {
      finalReasons = ["FACTUAL_GROUNDING_REQUIRES_HUMAN_REVIEW", ...finalReasons].slice(0, 16);
    }
  }

  const structured: StructuredGovernanceDecision = {
    contract: GOVERNANCE_DECISION_CONTRACT,
    reviewId: request.reviewId,
    assignmentId: request.assignmentId,
    decidedAt: now.toISOString(),
    decision: finalDecision,
    reasons: finalReasons,
    unsupportedClaims,
    factualRisks: preflight.factualRisks,
    evidenceGaps,
    commercialRisks: preflight.commercialRisks,
    policyRisks: malformed ? ["governance_response_malformed"] : [],
    requiredRevisions,
    verifiedEvidenceRefs: request.evidenceRefs
      .filter((ref) => ref.isOfficial || (ref.credibilityHint ?? 0) >= 0.6)
      .map((ref) => ref.evidenceId)
      .slice(0, 12),
    riskScore: malformed ? Math.max(raw.riskScore ?? 0, 0.75) : (raw.riskScore ?? 0),
    humanApprovalRequired,
    semanticAvailable: raw.semanticAvailable !== false,
    revisionHints: finalDecision === "BLOCK" ? requiredRevisions : (raw.revisionHints ?? []),
    claimCount: request.claims.length,
    unsupportedClaimCount: unsupportedClaims.length,
    evidenceGapCount: evidenceGaps.length,
    revisionNumber: request.priorRevision,
    malformed,
  };

  const handoff: GovernanceReviewResult = {
    decision: finalDecision,
    riskScore: structured.riskScore,
    reasons: structured.reasons,
    revisionHints: structured.revisionHints,
    humanApprovalRequired: structured.humanApprovalRequired,
    semanticAvailable: structured.semanticAvailable,
  };

  return { handoff, structured };
}

export function assertGovernanceReviewResult(raw: unknown): asserts raw is GovernanceReviewResult {
  if (!raw || typeof raw !== "object") throw new Error("governance_review_result_invalid");
  const value = raw as GovernanceReviewResult;
  if (!value.decision) throw new Error("governance_review_missing_decision");
}
