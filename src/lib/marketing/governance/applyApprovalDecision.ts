import { GovernanceValidationError } from "@/lib/marketing/governance/errors";
import type {
  ApprovalDecision,
  ApprovalRecord,
  AppliedApprovalResult,
  ApprovalReviewerType,
  GovernancePolicyResult,
} from "@/lib/marketing/governance/workflowTypes";

export type ApplyApprovalDecisionInput = {
  workflow: Pick<
    GovernancePolicyResult,
    "workflowState" | "action" | "autoPublishAllowed" | "humanApprovalRequired" | "revisionRequired"
  >;
  decision: ApprovalDecision;
  reviewerId?: string | null;
  reviewerType?: ApprovalReviewerType | null;
  comment?: string | null;
  now?: Date;
};

export function applyApprovalDecision(input: ApplyApprovalDecisionInput): AppliedApprovalResult {
  if (input.workflow.workflowState !== "approval_pending") {
    throw new GovernanceValidationError("Approval decisions apply only to approval_pending workflows");
  }

  const reviewedAt = (input.now ?? new Date()).toISOString();
  const record: ApprovalRecord = {
    decision: input.decision,
    reviewedAt,
    reviewerId: input.reviewerId ?? null,
    reviewerType: input.reviewerType ?? null,
    comment: input.comment ?? null,
  };

  if (input.decision === "APPROVE") {
    return {
      workflowState: "approved",
      action: "PROCEED",
      autoPublishAllowed: false,
      humanApprovalRequired: false,
      revisionRequired: false,
      record,
    };
  }

  if (input.decision === "REJECT") {
    return {
      workflowState: "rejected",
      action: null,
      autoPublishAllowed: false,
      humanApprovalRequired: false,
      revisionRequired: false,
      record,
    };
  }

  return {
    workflowState: "revision_required",
    action: "REQUEST_REVISION",
    autoPublishAllowed: false,
    humanApprovalRequired: false,
    revisionRequired: true,
    record,
  };
}
