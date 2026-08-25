import {
  GOVERNANCE_ALLOW_MAX_RISK,
  GOVERNANCE_HIGH_RISK_REASON_CODES,
  channelGovernancePolicy,
} from "@/lib/marketing/governance/constants";
import type { GovernanceReason, GovernanceResult } from "@/lib/marketing/governance/types";

const HIGH_RISK = new Set<string>(GOVERNANCE_HIGH_RISK_REASON_CODES);

export function hasHighRiskRevisionReason(reasons: GovernanceReason[]): boolean {
  return reasons.some((reason) => HIGH_RISK.has(reason.code));
}

export function canAutoPublish(result: GovernanceResult): boolean {
  const channelPolicy = channelGovernancePolicy(result.channelStats.channel);
  if (result.decision !== "ALLOW") return false;
  if (!result.semanticAvailable) return false;
  if (result.riskScore > GOVERNANCE_ALLOW_MAX_RISK) return false;
  if (!channelPolicy.autoPublishEnabled) return false;
  if (hasHighRiskRevisionReason(result.reasons)) return false;
  return true;
}
