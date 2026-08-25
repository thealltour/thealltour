import { revisionHintsForReasons } from "@/lib/marketing/governance/revisionHints";
import type { GovernanceCandidate, GovernanceResult } from "@/lib/marketing/governance/types";
import type {
  ApprovalCandidateSnapshot,
  ApprovalRequest,
  RevisionRequest,
} from "@/lib/marketing/governance/workflowTypes";

export function snapshotApprovalCandidate(candidate: GovernanceCandidate): ApprovalCandidateSnapshot {
  return {
    title: candidate.title ?? null,
    body: candidate.body,
    channel: candidate.channel,
    productId: candidate.productId ?? null,
    campaignId: candidate.campaignId ?? null,
    agendaId: candidate.agendaId ?? null,
    agendaKey: candidate.agendaKey ?? null,
    scheduledAt: candidate.scheduledAt ?? null,
    contentType: candidate.contentType ?? null,
    sourceContentId: candidate.sourceContentId ?? null,
  };
}

export function buildApprovalRequest(
  candidate: GovernanceCandidate,
  governance: GovernanceResult,
  generatedAt: string,
): ApprovalRequest {
  return {
    candidate: snapshotApprovalCandidate(candidate),
    governanceDecision: governance.decision,
    riskScore: governance.riskScore,
    reasons: governance.reasons,
    topSemanticMatches: governance.matchedMemories.slice(0, 5),
    agendaStats: governance.agendaStats,
    channelStats: governance.channelStats,
    generatedAt,
  };
}

export function buildRevisionRequest(governance: GovernanceResult): RevisionRequest {
  return {
    reasonCodes: governance.reasons.map((reason) => reason.code),
    matchedContent: governance.matchedMemories.map((match) => ({
      contentId: match.contentId,
      title: match.title,
      score: match.score,
    })),
    riskScore: governance.riskScore,
    revisionHints: revisionHintsForReasons(governance.reasons),
  };
}
