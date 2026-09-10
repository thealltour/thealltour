import type {
  ContentDeliverableRequirements,
  EvidencePack,
} from "@/lib/marketing/content/types";
import { allowedEvidenceIdsFromPack } from "@/lib/marketing/content/evidencePack";
import type { CompletenessValidationResult } from "@/lib/marketing/content/completenessValidator";
import type { GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import type { DepartmentPipelineStatus } from "@/lib/marketing/bot/organization/pipeline";
import { MARKETING_ATTR, pickMarketingAttributes } from "@/lib/marketing/observability/attributes";
import type { MarketingSpanAttributes } from "@/lib/marketing/observability/types";
import { truncateSummary } from "@/lib/marketing/observability/privacy";

export function attributesForRequirements(
  requirements: ContentDeliverableRequirements | null | undefined,
): MarketingSpanAttributes {
  if (!requirements) {
    return pickMarketingAttributes({
      [MARKETING_ATTR.COMPLETENESS_STATUS]: "skipped",
    });
  }
  return pickMarketingAttributes({
    [MARKETING_ATTR.ASSIGNMENT_ID]: requirements.assignmentId,
    [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]: requirements.requiredDestinations,
    [MARKETING_ATTR.REQ_SECTION_REQUIRED_COUNT]: requirements.requiredSections.length,
    [MARKETING_ATTR.REQ_DESTINATION_COVERED]: [],
  });
}

export function attributesForEvidencePack(pack: EvidencePack | null | undefined): MarketingSpanAttributes {
  if (!pack) {
    return pickMarketingAttributes({
      [MARKETING_ATTR.EVIDENCE_AVAILABLE]: 0,
      [MARKETING_ATTR.EVIDENCE_ALLOWED]: 0,
    });
  }
  const available = pack.availableEvidenceRefs.length;
  const allowedIds = allowedEvidenceIdsFromPack(pack);
  const lockedFacts = pack.items.filter((item) => item.locked).length;
  const coverage = available > 0 ? allowedIds.length / available : 0;
  return pickMarketingAttributes({
    [MARKETING_ATTR.ASSIGNMENT_ID]: pack.assignmentId,
    [MARKETING_ATTR.EVIDENCE_AVAILABLE]: available,
    [MARKETING_ATTR.EVIDENCE_ALLOWED]: allowedIds.length,
    [MARKETING_ATTR.EVIDENCE_USED]: allowedIds.slice(0, 12),
    [MARKETING_ATTR.EVIDENCE_COVERAGE_RATIO]: Number(coverage.toFixed(4)),
    [MARKETING_ATTR.RESULT_SUMMARY]: truncateSummary(`facts_locked=${lockedFacts}`),
  });
}

export function attributesForCompleteness(
  requirements: ContentDeliverableRequirements | null | undefined,
  result: CompletenessValidationResult,
): MarketingSpanAttributes {
  const requiredCount = requirements?.requiredDestinationCount ?? requirements?.requiredDestinations.length ?? 0;
  return pickMarketingAttributes({
    [MARKETING_ATTR.REQ_DESTINATION_REQUIRED]: requirements?.requiredDestinations ?? [],
    [MARKETING_ATTR.REQ_DESTINATION_COVERED]: result.coveredDestinations,
    [MARKETING_ATTR.REQ_DESTINATION_MISSING]: result.missingDestinations,
    [MARKETING_ATTR.COMPLETENESS_STATUS]: result.ok ? "pass" : "fail",
    [MARKETING_ATTR.COMPLETENESS_MISSING_COUNT]: result.failures.length,
    [MARKETING_ATTR.COMPLETENESS_FAILURE_CODES]: result.failures.map((f) => f.code).slice(0, 8),
    [MARKETING_ATTR.RESULT_SUMMARY]: truncateSummary(
      `dest_required=${requiredCount};covered=${result.coveredDestinations.length};missing=${result.missingDestinations.length}`,
    ),
  });
}

export function attributesForGovernance(
  governance: GovernanceReviewResult,
  structured?: {
    unsupportedClaims?: unknown[];
    evidenceGaps?: unknown[];
    factualRisks?: unknown[];
  } | null,
): MarketingSpanAttributes {
  return pickMarketingAttributes({
    [MARKETING_ATTR.GOVERNANCE_DECISION]: governance.decision,
    [MARKETING_ATTR.GOVERNANCE_RISK_SCORE]: governance.riskScore,
    [MARKETING_ATTR.GOVERNANCE_HUMAN_APPROVAL_REQUIRED]: governance.humanApprovalRequired,
    [MARKETING_ATTR.RESULT_SUMMARY]: truncateSummary(
      `unsupported=${structured?.unsupportedClaims?.length ?? 0};gaps=${structured?.evidenceGaps?.length ?? 0};hints=${governance.revisionHints.length}`,
    ),
  });
}

export function humanBoundaryHandoffStatus(
  pipelineStatus: DepartmentPipelineStatus,
): "ready_for_human_review" | "needs_human_review" | "revision_required" | "failed" | "other" {
  if (pipelineStatus === "publish_ready") return "ready_for_human_review";
  if (pipelineStatus === "approval_pending") return "needs_human_review";
  if (pipelineStatus === "revision_required") return "revision_required";
  if (pipelineStatus === "handoff_failed") return "failed";
  return "other";
}

export function attributesForHumanBoundary(
  pipelineStatus: DepartmentPipelineStatus,
): MarketingSpanAttributes {
  const handoff = humanBoundaryHandoffStatus(pipelineStatus);
  return pickMarketingAttributes({
    [MARKETING_ATTR.RESULT_SUMMARY]: handoff,
    [MARKETING_ATTR.COMPLETENESS_STATUS]: handoff,
  });
}
