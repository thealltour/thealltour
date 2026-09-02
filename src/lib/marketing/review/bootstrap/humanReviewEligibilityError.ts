export type HumanReviewIneligibilityReason =
  | "verification_fixture_excluded"
  | "candidate_status_failed"
  | "candidate_status_blocked"
  | "candidate_status_unknown"
  | "governance_blocked"
  | "governance_incompatible_with_status"
  | "missing_draft_body"
  | "missing_governance_decision_for_ready";

export class HumanReviewEligibilityError extends Error {
  readonly name = "HumanReviewEligibilityError";
  readonly reason: HumanReviewIneligibilityReason;
  readonly candidateId: string;

  constructor(input: { candidateId: string; reason: HumanReviewIneligibilityReason; message: string }) {
    super(input.message);
    this.reason = input.reason;
    this.candidateId = input.candidateId;
  }
}
