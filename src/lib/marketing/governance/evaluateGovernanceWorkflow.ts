import "server-only";

import { applyGovernancePolicy } from "@/lib/marketing/governance/applyGovernancePolicy";
import {
  evaluateContentGovernance,
  type EvaluateContentGovernanceDeps,
} from "@/lib/marketing/governance/evaluateContentGovernance";
import { buildApprovalRequest, buildRevisionRequest } from "@/lib/marketing/governance/payloads";
import type { GovernanceCandidate } from "@/lib/marketing/governance/types";
import type { GovernanceWorkflowResult } from "@/lib/marketing/governance/workflowTypes";

export type EvaluateGovernanceWorkflowDeps = EvaluateContentGovernanceDeps;

export async function evaluateGovernanceWorkflow(
  candidate: GovernanceCandidate,
  deps: EvaluateGovernanceWorkflowDeps = {},
): Promise<GovernanceWorkflowResult> {
  const now = deps.now ?? new Date();
  const governance = await evaluateContentGovernance(candidate, { ...deps, now });
  const policy = applyGovernancePolicy(governance, { now });

  return {
    ...policy,
    candidate,
    approvalRequest:
      policy.action === "REQUEST_APPROVAL" ? buildApprovalRequest(candidate, governance, policy.evaluatedAt) : null,
    revisionRequest: policy.action === "REQUEST_REVISION" ? buildRevisionRequest(governance) : null,
  };
}
