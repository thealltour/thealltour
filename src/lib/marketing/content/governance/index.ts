export type {
  ContentToGovernanceHandoffResult,
  GetAssignmentGovernanceStatusResult,
  GetGovernanceReviewResult,
  GovernanceClaim,
  GovernanceClaimType,
  GovernancePreflightSignals,
  GovernanceReviewObservability,
  GovernanceReviewRecord,
  PrepareContentToGovernanceHandoffInput,
  StructuredGovernanceDecision,
  StructuredGovernanceReviewRequest,
} from "@/lib/marketing/content/governance/types";
export {
  GOVERNANCE_DECISION_CONTRACT,
  GOVERNANCE_REVIEW_REQUEST_CONTRACT,
} from "@/lib/marketing/content/governance/types";
export {
  extractGovernanceClaims,
  detectCsAddedClaims,
  splitClaimSentences,
} from "@/lib/marketing/content/governance/extractClaims";
export { evaluateDeterministicClaimSignals } from "@/lib/marketing/content/governance/evaluateDeterministicClaimSignals";
export {
  prepareContentToGovernanceHandoff,
  buildGovernanceReviewIdempotencyKey,
} from "@/lib/marketing/content/governance/prepareContentToGovernanceHandoff";
export {
  normalizeGovernanceReviewResult,
  assertGovernanceReviewResult,
} from "@/lib/marketing/content/governance/normalizeGovernanceReviewResult";
export {
  createInMemoryGovernanceReviewStore,
  getDefaultGovernanceReviewStore,
  resetDefaultGovernanceReviewStore,
  recordGovernanceReview,
  getGovernanceReviewById,
  getAssignmentGovernanceStatus,
} from "@/lib/marketing/content/governance/store/governanceReviewStore";
