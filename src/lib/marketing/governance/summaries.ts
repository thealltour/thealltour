import type { GovernanceDecision } from "@/lib/marketing/governance/types";
import type {
  GovernancePolicyAction,
  GovernancePolicyOverride,
} from "@/lib/marketing/governance/workflowTypes";

export function governanceWorkflowSummary(input: {
  decision: GovernanceDecision;
  action: GovernancePolicyAction;
  overrides: GovernancePolicyOverride[];
}): string {
  if (input.overrides.some((override) => override.code === "SEMANTIC_UNAVAILABLE")) {
    return "의미 검색을 사용할 수 없어 사람 승인이 필요합니다";
  }
  if (input.action === "REQUEST_REVISION" || input.decision === "BLOCK") {
    return "중복 또는 플랫폼 빈도 정책 위반";
  }
  if (input.action === "REQUEST_APPROVAL" || input.decision === "REVIEW") {
    return "유사 콘텐츠 또는 게시 빈도 검토 필요";
  }
  return "중복 및 게시 빈도 위험 신호 없음";
}
