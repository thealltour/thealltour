import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import { isVerificationRecord } from "@/lib/marketing/operations/verification";
import type { HumanReviewIneligibilityReason } from "@/lib/marketing/review/bootstrap/humanReviewEligibilityError";

export type HumanReviewEligibilityOptions = {
  includeVerification?: boolean;
};

export type HumanReviewEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: HumanReviewIneligibilityReason; detail: string };

/**
 * Domain invariant (mapPipelineToCandidateStatus):
 * - ready_for_human_review ⇐ governance ALLOW + pipeline publish_ready
 * - needs_human_review ⇐ governance REVIEW | approval_pending | malformed governance
 * - blocked ⇐ governance BLOCK | revision_required
 * - failed ⇐ pipeline failure or unmatched terminal state
 *
 * Persisted candidates may omit governanceDecision; status is trusted when consistent.
 */
export function resolveCandidateGovernanceDecision(
  candidate: CompletedMarketingCandidate,
): "ALLOW" | "REVIEW" | "BLOCK" | null {
  const structured = candidate.governanceDecision?.decision ?? null;
  if (structured) return structured;

  const fromHistory = candidate.revisionHistory.at(-1)?.governanceDecision;
  if (fromHistory === "ALLOW" || fromHistory === "REVIEW" || fromHistory === "BLOCK") {
    return fromHistory;
  }

  const fromObservability = candidate.observability.governanceDecision;
  if (fromObservability === "ALLOW" || fromObservability === "REVIEW" || fromObservability === "BLOCK") {
    return fromObservability;
  }

  return null;
}

export function evaluateHumanReviewEligibility(
  candidate: CompletedMarketingCandidate,
  options: HumanReviewEligibilityOptions = {},
): HumanReviewEligibilityResult {
  if (
    !options.includeVerification &&
    isVerificationRecord({
      routineId: candidate.provenance.routineId,
      candidateId: candidate.candidateId,
      logicalRunKey: candidate.logicalRunKey,
    })
  ) {
    return {
      eligible: false,
      reason: "verification_fixture_excluded",
      detail: "Verification fixture candidates are excluded from production bootstrap policy.",
    };
  }

  if (candidate.status === "failed") {
    return {
      eligible: false,
      reason: "candidate_status_failed",
      detail: "Failed candidates are diagnostics-only and cannot receive HumanMarketingReview bootstrap.",
    };
  }

  if (candidate.status === "blocked") {
    return {
      eligible: false,
      reason: "candidate_status_blocked",
      detail: "Blocked candidates cannot enter the human review queue until governance is resolved.",
    };
  }

  if (candidate.status !== "ready_for_human_review" && candidate.status !== "needs_human_review") {
    return {
      eligible: false,
      reason: "candidate_status_unknown",
      detail: `Candidate status ${candidate.status} is not eligible for human review bootstrap.`,
    };
  }

  if (!candidate.draft?.body?.trim()) {
    return {
      eligible: false,
      reason: "missing_draft_body",
      detail: "Candidate draft body is required before HumanMarketingReview can be bootstrapped.",
    };
  }

  const governanceDecision = resolveCandidateGovernanceDecision(candidate);
  const governanceMalformed = candidate.governanceDecision?.malformed === true;

  if (governanceDecision === "BLOCK") {
    return {
      eligible: false,
      reason: "governance_blocked",
      detail: "Governance BLOCK prohibits human review bootstrap for this candidate.",
    };
  }

  if (candidate.status === "ready_for_human_review") {
    if (governanceDecision === "REVIEW") {
      return {
        eligible: false,
        reason: "governance_incompatible_with_status",
        detail: "ready_for_human_review requires governance ALLOW; found REVIEW.",
      };
    }
    if (governanceDecision === null) {
      return { eligible: true };
    }
    if (governanceDecision !== "ALLOW") {
      return {
        eligible: false,
        reason: "governance_incompatible_with_status",
        detail: `ready_for_human_review requires governance ALLOW; found ${governanceDecision}.`,
      };
    }
    return { eligible: true };
  }

  // needs_human_review: produced by REVIEW decision, approval_pending, or malformed governance output.
  if (governanceDecision === "ALLOW" && !governanceMalformed) {
    return {
      eligible: false,
      reason: "governance_incompatible_with_status",
      detail: "needs_human_review requires governance REVIEW or malformed governance; found ALLOW without malformed flag.",
    };
  }
  if (governanceDecision === "REVIEW" || governanceMalformed || governanceDecision === null) {
    return { eligible: true };
  }

  return {
    eligible: false,
    reason: "governance_incompatible_with_status",
    detail: `needs_human_review is incompatible with governance decision ${governanceDecision}.`,
  };
}

export function isCandidateEligibleForHumanReview(
  candidate: CompletedMarketingCandidate,
  options: HumanReviewEligibilityOptions = {},
): boolean {
  return evaluateHumanReviewEligibility(candidate, options).eligible;
}
