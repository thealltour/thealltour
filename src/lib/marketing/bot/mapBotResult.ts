import type { GovernanceWorkflowResult } from "@/lib/marketing/governance/workflowTypes";
import type { CompactGovernanceResult, HumanApprovalHandoff, MarketingBotResult } from "@/lib/marketing/bot/types";

export function compactGovernance(workflow: GovernanceWorkflowResult): CompactGovernanceResult {
  return {
    governanceDecision: workflow.governance.decision,
    riskScore: workflow.governance.riskScore,
    workflowAction: workflow.action,
    workflowState: workflow.workflowState,
    autoPublishAllowed: workflow.autoPublishAllowed,
    humanApprovalRequired: workflow.humanApprovalRequired,
    revisionRequired: workflow.revisionRequired,
    reasonCodes: workflow.reasons.map((reason) => reason.code),
    revisionHints: workflow.revisionRequest?.revisionHints ?? [],
    semanticAvailable: workflow.governance.semanticAvailable,
    summary: workflow.summary,
  };
}

export function mapWorkflowToBotResult(
  workflow: GovernanceWorkflowResult,
  content: { title?: string | null; body: string; channel: string },
): MarketingBotResult {
  const governance = compactGovernance(workflow);
  if (workflow.action === "REQUEST_REVISION") {
    return {
      status: "revision_required",
      content: { title: content.title ?? null, body: content.body },
      governance,
      nextAction: "revise_content",
      approvalHandoff: null,
      publishActionIncluded: false,
    };
  }
  if (workflow.action === "REQUEST_APPROVAL") {
    return {
      status: "approval_required",
      content: { title: content.title ?? null, body: content.body },
      governance,
      nextAction: "human_approval",
      approvalHandoff: buildApprovalHandoff(workflow, content),
      publishActionIncluded: false,
    };
  }
  return {
    status: "publish_ready",
    content: { title: content.title ?? null, body: content.body },
    governance,
    nextAction: "stop_before_publish",
    approvalHandoff: null,
    publishActionIncluded: false,
  };
}

export function buildApprovalHandoff(
  workflow: GovernanceWorkflowResult,
  content: { title?: string | null; body: string; channel: string },
): HumanApprovalHandoff {
  return {
    type: "approval_required",
    title: content.title ?? null,
    body: content.body,
    channel: content.channel,
    riskScore: workflow.governance.riskScore,
    reasons: workflow.reasons,
    semanticMatches: workflow.governance.matchedMemories.slice(0, 5).map((match) => ({
      contentId: match.contentId,
      title: match.title,
      score: match.score,
      channels: match.channels,
    })),
    recommendedAction: "REQUEST_CHANGES",
  };
}

export function buildBotRunTrace(input: {
  agentName: string;
  taskType: string;
  inputSummary: string;
  outputSummary: string;
  governanceDecision?: import("@/lib/marketing/governance/types").GovernanceDecision | null;
  provider?: string | null;
  model?: string | null;
  elapsedMs: number;
}): import("@/lib/marketing/bot/types").BotRunTrace {
  return {
    agentName: input.agentName,
    taskType: input.taskType,
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary,
    governanceDecision: input.governanceDecision ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    elapsedMs: input.elapsedMs,
  };
}
