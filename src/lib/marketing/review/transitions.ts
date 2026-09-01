import type { CompletedMarketingCandidateStatus } from "@/lib/marketing/cron/daily/types";
import type { HumanMarketingReviewStatus } from "@/lib/marketing/review/types";

export class HumanReviewTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HumanReviewTransitionError";
  }
}

export class HumanReviewPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HumanReviewPolicyError";
  }
}

const ALLOWED_TRANSITIONS: Record<HumanMarketingReviewStatus, HumanMarketingReviewStatus[]> = {
  pending: ["editing", "approved_for_manual_publish", "deferred", "rejected"],
  editing: ["pending", "approved_for_manual_publish", "deferred", "rejected"],
  approved_for_manual_publish: ["editing", "manually_published"],
  deferred: ["pending", "editing"],
  rejected: [],
  manually_published: [],
};

export function assertAllowedTransition(
  from: HumanMarketingReviewStatus,
  to: HumanMarketingReviewStatus,
): void {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new HumanReviewTransitionError(`transition not allowed: ${from} -> ${to}`);
  }
}

export function canCandidateBeApproved(candidateStatus: CompletedMarketingCandidateStatus): boolean {
  return candidateStatus === "ready_for_human_review" || candidateStatus === "needs_human_review";
}

export function isCandidateDiagnosticsOnly(candidateStatus: CompletedMarketingCandidateStatus): boolean {
  return candidateStatus === "failed";
}

export function isCandidateBlocked(candidateStatus: CompletedMarketingCandidateStatus): boolean {
  return candidateStatus === "blocked";
}

export function assertCandidateApprovable(candidateStatus: CompletedMarketingCandidateStatus): void {
  if (isCandidateDiagnosticsOnly(candidateStatus)) {
    throw new HumanReviewPolicyError("failed candidates cannot be approved");
  }
  if (isCandidateBlocked(candidateStatus)) {
    throw new HumanReviewPolicyError("blocked candidates cannot be approved without governance resolution");
  }
  if (!canCandidateBeApproved(candidateStatus)) {
    throw new HumanReviewPolicyError(`candidate status ${candidateStatus} is not approvable`);
  }
}

export function computeGovernanceStale(
  governanceReviewedDraftBody: string,
  currentDraftBody: string,
): boolean {
  return governanceReviewedDraftBody.trim() !== currentDraftBody.trim();
}

export function matchesQueueFilter(input: {
  filter: import("@/lib/marketing/review/types").HumanReviewQueueFilter;
  businessDateKst: string;
  todayKst: string;
  candidateStatus: CompletedMarketingCandidateStatus;
  humanReviewStatus: HumanMarketingReviewStatus | null;
  governanceDecision: string | null;
}): boolean {
  switch (input.filter) {
    case "all":
      return true;
    case "today":
      return input.businessDateKst === input.todayKst;
    case "pending":
      return !input.humanReviewStatus || input.humanReviewStatus === "pending" || input.humanReviewStatus === "editing";
    case "needs_review":
      return input.candidateStatus === "needs_human_review" || input.governanceDecision === "REVIEW";
    case "approved":
      return input.humanReviewStatus === "approved_for_manual_publish";
    case "deferred":
      return input.humanReviewStatus === "deferred";
    case "manually_published":
      return input.humanReviewStatus === "manually_published";
    case "blocked_failed":
      return input.candidateStatus === "blocked" || input.candidateStatus === "failed";
    default:
      return true;
  }
}
