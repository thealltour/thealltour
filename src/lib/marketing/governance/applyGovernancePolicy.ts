import { GOVERNANCE_POLICY_VERSION } from "@/lib/marketing/governance/constants";
import { canAutoPublish, hasHighRiskRevisionReason } from "@/lib/marketing/governance/canAutoPublish";
import { governanceWorkflowSummary } from "@/lib/marketing/governance/summaries";
import type { GovernanceResult } from "@/lib/marketing/governance/types";
import type {
  GovernancePolicyAction,
  GovernancePolicyOverride,
  GovernancePolicyResult,
  GovernancePolicyWorkflowState,
} from "@/lib/marketing/governance/workflowTypes";

export type ApplyGovernancePolicyOptions = {
  now?: Date;
};

export function applyGovernancePolicy(
  governance: GovernanceResult,
  options: ApplyGovernancePolicyOptions = {},
): GovernancePolicyResult {
  const now = options.now ?? new Date();
  const overrides: GovernancePolicyOverride[] = [];

  let action: GovernancePolicyAction;
  let workflowState: GovernancePolicyWorkflowState;
  let humanApprovalRequired: boolean;
  let revisionRequired: boolean;

  if (governance.decision === "BLOCK" || hasHighRiskRevisionReason(governance.reasons)) {
    if (governance.decision !== "BLOCK") {
      overrides.push({ code: "HIGH_RISK_REASON", fromDecision: governance.decision });
    }
    action = "REQUEST_REVISION";
    workflowState = "revision_required";
    humanApprovalRequired = false;
    revisionRequired = true;
  } else if (governance.decision === "REVIEW") {
    action = "REQUEST_APPROVAL";
    workflowState = "approval_pending";
    humanApprovalRequired = true;
    revisionRequired = false;
  } else if (!governance.semanticAvailable) {
    overrides.push({ code: "SEMANTIC_UNAVAILABLE", fromDecision: governance.decision });
    action = "REQUEST_APPROVAL";
    workflowState = "approval_pending";
    humanApprovalRequired = true;
    revisionRequired = false;
  } else {
    action = "PROCEED";
    workflowState = "publish_ready";
    humanApprovalRequired = false;
    revisionRequired = false;
  }

  const autoPublishAllowed = action === "PROCEED" && canAutoPublish(governance);

  return {
    governance,
    action,
    workflowState,
    autoPublishAllowed,
    humanApprovalRequired,
    revisionRequired,
    reasons: governance.reasons,
    policyOverrides: overrides,
    summary: governanceWorkflowSummary({
      decision: governance.decision,
      action,
      overrides,
    }),
    policyVersion: GOVERNANCE_POLICY_VERSION,
    evaluatedAt: now.toISOString(),
  };
}
