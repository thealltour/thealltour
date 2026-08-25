import type {
  GovernanceAgendaStats,
  GovernanceCandidate,
  GovernanceChannelStats,
  GovernanceDecision,
  GovernanceMatchedMemory,
  GovernanceReason,
  GovernanceReasonCode,
  GovernanceResult,
} from "@/lib/marketing/governance/types";

export const GOVERNANCE_WORKFLOW_STATES = [
  "draft",
  "governance_checking",
  "publish_ready",
  "approval_pending",
  "revision_required",
  "rejected",
  "approved",
] as const;

export type GovernanceWorkflowState = (typeof GOVERNANCE_WORKFLOW_STATES)[number];

export const GOVERNANCE_POLICY_ACTIONS = ["PROCEED", "REQUEST_APPROVAL", "REQUEST_REVISION"] as const;

export type GovernancePolicyAction = (typeof GOVERNANCE_POLICY_ACTIONS)[number];

export const GOVERNANCE_POLICY_WORKFLOW_STATES = [
  "publish_ready",
  "approval_pending",
  "revision_required",
] as const;

export type GovernancePolicyWorkflowState = (typeof GOVERNANCE_POLICY_WORKFLOW_STATES)[number];

export const APPROVAL_DECISIONS = ["APPROVE", "REJECT", "REQUEST_CHANGES"] as const;

export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export type ApprovalReviewerType = "human" | "system";

export type GovernancePolicyOverrideCode = "SEMANTIC_UNAVAILABLE" | "HIGH_RISK_REASON";

export type GovernancePolicyOverride = {
  code: GovernancePolicyOverrideCode;
  fromDecision: GovernanceDecision;
};

export type GovernancePolicyResult = {
  governance: GovernanceResult;
  action: GovernancePolicyAction;
  workflowState: GovernancePolicyWorkflowState;
  autoPublishAllowed: boolean;
  humanApprovalRequired: boolean;
  revisionRequired: boolean;
  reasons: GovernanceReason[];
  policyOverrides: GovernancePolicyOverride[];
  summary: string;
  policyVersion: string;
  evaluatedAt: string;
};

export type ApprovalCandidateSnapshot = {
  title: string | null;
  body: string;
  channel: string;
  productId: string | null;
  campaignId: string | null;
  agendaId: string | null;
  agendaKey: string | null;
  scheduledAt: string | null;
  contentType: string | null;
  sourceContentId: string | null;
};

export type ApprovalRequest = {
  candidate: ApprovalCandidateSnapshot;
  governanceDecision: GovernanceDecision;
  riskScore: number;
  reasons: GovernanceReason[];
  topSemanticMatches: GovernanceMatchedMemory[];
  agendaStats: GovernanceAgendaStats;
  channelStats: GovernanceChannelStats;
  generatedAt: string;
};

export type RevisionMatchedContent = {
  contentId: string | null;
  title: string | null;
  score: number;
};

export type RevisionRequest = {
  reasonCodes: GovernanceReasonCode[];
  matchedContent: RevisionMatchedContent[];
  riskScore: number;
  revisionHints: string[];
};

export type ApprovalRecord = {
  decision: ApprovalDecision;
  reviewedAt: string;
  reviewerId: string | null;
  reviewerType: ApprovalReviewerType | null;
  comment: string | null;
};

export type AppliedApprovalResult = {
  workflowState: Extract<GovernanceWorkflowState, "approved" | "rejected" | "revision_required">;
  action: GovernancePolicyAction | null;
  autoPublishAllowed: boolean;
  humanApprovalRequired: boolean;
  revisionRequired: boolean;
  record: ApprovalRecord;
};

export type GovernanceWorkflowResult = GovernancePolicyResult & {
  candidate: GovernanceCandidate;
  approvalRequest: ApprovalRequest | null;
  revisionRequest: RevisionRequest | null;
};
