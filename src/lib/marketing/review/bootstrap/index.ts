export {
  evaluateHumanReviewEligibility,
  isCandidateEligibleForHumanReview,
  resolveCandidateGovernanceDecision,
  type HumanReviewEligibilityOptions,
  type HumanReviewEligibilityResult,
} from "@/lib/marketing/review/bootstrap/eligibility";
export {
  HumanReviewEligibilityError,
  type HumanReviewIneligibilityReason,
} from "@/lib/marketing/review/bootstrap/humanReviewEligibilityError";
export {
  bootstrapHumanReviewForCandidate,
  bootstrapMissingHumanMarketingReviews,
  buildDeterministicReviewId,
  type BootstrapHumanReviewDeps,
  type BootstrapMissingHumanReviewsResult,
  type HumanReviewBootstrapResult,
} from "@/lib/marketing/review/bootstrap/bootstrapHumanReview";
