import { clamp01 } from "@/lib/marketing/scoring/clamp";
import {
  GOVERNANCE_ALLOW_MAX_RISK,
  GOVERNANCE_BLOCK_MIN_RISK,
  GOVERNANCE_REVIEW_MAX_RISK,
  GOVERNANCE_REVIEW_MIN_RISK,
  GOVERNANCE_RISK_AGENDA_OVERUSED,
  GOVERNANCE_RISK_AGENDA_REPEAT,
  GOVERNANCE_RISK_CHANNEL_OVER,
  GOVERNANCE_RISK_EXACT,
  GOVERNANCE_RISK_NORMALIZED,
  GOVERNANCE_RISK_SAME_CHANNEL_RECENT,
  GOVERNANCE_RISK_SEMANTIC_REVIEW,
  GOVERNANCE_RISK_SEMANTIC_STRONG,
} from "@/lib/marketing/governance/constants";
import type {
  AgendaFrequencyEvaluation,
  ChannelFrequencyEvaluation,
  ExactDuplicateEvaluation,
  GovernanceDecision,
  GovernanceReason,
  GovernanceReasonCode,
  NormalizedDuplicateEvaluation,
  SemanticSimilarityEvaluation,
} from "@/lib/marketing/governance/types";

export type GovernanceSignals = {
  exact: ExactDuplicateEvaluation;
  normalized: NormalizedDuplicateEvaluation;
  semantic: SemanticSimilarityEvaluation;
  agenda: AgendaFrequencyEvaluation;
  channel: ChannelFrequencyEvaluation;
};

function hasCode(reasons: GovernanceReason[], code: GovernanceReasonCode): boolean {
  return reasons.some((reason) => reason.code === code);
}

export function combineGovernanceSignals(signals: GovernanceSignals): {
  decision: GovernanceDecision;
  reasons: GovernanceReason[];
  riskScore: number;
} {
  const reasons = [
    ...signals.exact.reasons,
    ...signals.normalized.reasons,
    ...signals.semantic.reasons,
    ...signals.agenda.reasons,
    ...signals.channel.reasons,
  ];

  let decision: GovernanceDecision = "ALLOW";
  const exact = hasCode(reasons, "EXACT_DUPLICATE");
  const normalized = hasCode(reasons, "NORMALIZED_DUPLICATE");
  const semanticHigh = hasCode(reasons, "SEMANTIC_SIMILARITY_HIGH");
  const semanticReview = hasCode(reasons, "SEMANTIC_SIMILARITY_REVIEW");
  const sameChannelRecent = hasCode(reasons, "SAME_CHANNEL_RECENT_SIMILAR") || signals.semantic.sameChannelRecent;
  const dailyLimit = signals.channel.dailyLimitExceeded;
  const agendaOverused = signals.agenda.overused;
  const agendaRepeat = signals.agenda.recentRepeat;

  if (exact || normalized) {
    decision = "BLOCK";
  } else if (dailyLimit || agendaOverused) {
    decision = "BLOCK";
  } else if (semanticHigh && signals.semantic.sameAgenda && sameChannelRecent) {
    decision = "BLOCK";
  } else if (semanticHigh) {
    decision = "REVIEW";
  } else if (semanticReview && agendaRepeat) {
    decision = "REVIEW";
  } else if (semanticReview) {
    decision = "REVIEW";
  } else if (agendaRepeat || sameChannelRecent) {
    decision = "REVIEW";
  }

  if (decision === "ALLOW" && reasons.length === 0) {
    reasons.push({ code: "NO_RISK_SIGNAL", severity: "info" });
  }

  return {
    decision,
    reasons,
    riskScore: alignRiskScore(decision, reasons),
  };
}

function baseRisk(reasons: GovernanceReason[]): number {
  let risk = 0;
  if (hasCode(reasons, "EXACT_DUPLICATE")) risk = Math.max(risk, GOVERNANCE_RISK_EXACT);
  if (hasCode(reasons, "NORMALIZED_DUPLICATE")) risk = Math.max(risk, GOVERNANCE_RISK_NORMALIZED);
  if (hasCode(reasons, "SEMANTIC_SIMILARITY_HIGH")) risk = Math.max(risk, GOVERNANCE_RISK_SEMANTIC_STRONG);
  if (hasCode(reasons, "SEMANTIC_SIMILARITY_REVIEW")) risk = Math.max(risk, GOVERNANCE_RISK_SEMANTIC_REVIEW);
  if (hasCode(reasons, "AGENDA_OVERUSED")) risk += GOVERNANCE_RISK_AGENDA_OVERUSED;
  else if (hasCode(reasons, "AGENDA_RECENT_REPEAT")) risk += GOVERNANCE_RISK_AGENDA_REPEAT;
  if (hasCode(reasons, "CHANNEL_DAILY_LIMIT")) risk += GOVERNANCE_RISK_CHANNEL_OVER;
  if (hasCode(reasons, "SAME_CHANNEL_RECENT_SIMILAR")) risk += GOVERNANCE_RISK_SAME_CHANNEL_RECENT;
  return clamp01(risk);
}

function alignRiskScore(decision: GovernanceDecision, reasons: GovernanceReason[]): number {
  const computed = baseRisk(reasons);
  if (decision === "BLOCK") return clamp01(Math.max(computed, GOVERNANCE_BLOCK_MIN_RISK));
  if (decision === "REVIEW") {
    return clamp01(Math.min(GOVERNANCE_REVIEW_MAX_RISK, Math.max(computed, GOVERNANCE_REVIEW_MIN_RISK)));
  }
  return clamp01(Math.min(computed, GOVERNANCE_ALLOW_MAX_RISK));
}
