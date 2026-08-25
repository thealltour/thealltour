export type {
  AgendaFrequencyEvaluation,
  ChannelFrequencyEvaluation,
  ExactDuplicateEvaluation,
  GovernanceAgendaStats,
  GovernanceCandidate,
  GovernanceChannelStats,
  GovernanceDecision,
  GovernanceMatchedMemory,
  GovernanceReason,
  GovernanceReasonCode,
  GovernanceResult,
  GovernanceSeverity,
  NormalizedDuplicateEvaluation,
  ParsedGovernanceCandidate,
  SemanticSimilarityEvaluation,
} from "@/lib/marketing/governance/types";
export { GOVERNANCE_REASON_CODES } from "@/lib/marketing/governance/types";
export {
  GOVERNANCE_AGENDA_BLOCK_LAST_7_DAYS,
  GOVERNANCE_AGENDA_REVIEW_LAST_30_DAYS,
  GOVERNANCE_AGENDA_REVIEW_LAST_7_DAYS,
  GOVERNANCE_CHANNEL_POLICIES,
  GOVERNANCE_HIGH_RISK_REASON_CODES,
  GOVERNANCE_POLICY_VERSION,
  GOVERNANCE_SEMANTIC_REVIEW_MATCH,
  GOVERNANCE_SEMANTIC_STRONG_MATCH,
  GOVERNANCE_SEMANTIC_TOP_K,
  channelGovernancePolicy,
} from "@/lib/marketing/governance/constants";
export type { GovernanceChannelPolicy } from "@/lib/marketing/governance/constants";
export { GovernanceValidationError } from "@/lib/marketing/governance/errors";
export {
  canonicalGovernanceText,
  governanceContentHash,
  governanceEmbeddingQuery,
  governanceNormalizedHash,
  normalizedGovernanceText,
} from "@/lib/marketing/governance/hashes";
export { parseGovernanceCandidate } from "@/lib/marketing/governance/parseCandidate";
export {
  evaluateAgendaFrequency,
  evaluateChannelFrequency,
  evaluateExactDuplicate,
  evaluateNormalizedDuplicate,
  evaluateSemanticSimilarity,
} from "@/lib/marketing/governance/evaluators";
export { combineGovernanceSignals } from "@/lib/marketing/governance/combineGovernanceSignals";
export { evaluateContentGovernance } from "@/lib/marketing/governance/evaluateContentGovernance";
export type { EvaluateContentGovernanceDeps } from "@/lib/marketing/governance/evaluateContentGovernance";
export { parseContentGovernanceCliArgs } from "@/lib/marketing/governance/cli";
export type { ContentGovernanceCliArgs } from "@/lib/marketing/governance/cli";
export { canAutoPublish, hasHighRiskRevisionReason } from "@/lib/marketing/governance/canAutoPublish";
export { applyGovernancePolicy } from "@/lib/marketing/governance/applyGovernancePolicy";
export type { ApplyGovernancePolicyOptions } from "@/lib/marketing/governance/applyGovernancePolicy";
export { applyApprovalDecision } from "@/lib/marketing/governance/applyApprovalDecision";
export type { ApplyApprovalDecisionInput } from "@/lib/marketing/governance/applyApprovalDecision";
export { evaluateGovernanceWorkflow } from "@/lib/marketing/governance/evaluateGovernanceWorkflow";
export type { EvaluateGovernanceWorkflowDeps } from "@/lib/marketing/governance/evaluateGovernanceWorkflow";
export { revisionHintsForReasons } from "@/lib/marketing/governance/revisionHints";
export {
  APPROVAL_DECISIONS,
  GOVERNANCE_POLICY_ACTIONS,
  GOVERNANCE_POLICY_WORKFLOW_STATES,
  GOVERNANCE_WORKFLOW_STATES,
} from "@/lib/marketing/governance/workflowTypes";
export type {
  ApprovalCandidateSnapshot,
  ApprovalDecision,
  ApprovalRecord,
  ApprovalRequest,
  ApprovalReviewerType,
  AppliedApprovalResult,
  GovernancePolicyAction,
  GovernancePolicyOverride,
  GovernancePolicyOverrideCode,
  GovernancePolicyResult,
  GovernancePolicyWorkflowState,
  GovernanceWorkflowResult,
  GovernanceWorkflowState,
  RevisionMatchedContent,
  RevisionRequest,
} from "@/lib/marketing/governance/workflowTypes";
