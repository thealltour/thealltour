/**
 * MQ-5 — Marketing Value Assessment contract.
 * Separate from Governance: usefulness / attention / engagement worthiness.
 */

import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

export const MARKETING_VALUE_ASSESSMENT_CONTRACT = "marketing-value-assessment-v1" as const;
export const MARKETING_VALUE_BUNDLE_CONTRACT = "marketing-value-bundle-v1" as const;
export const MARKETING_VALUE_EVALUATOR_VERSION = "mq5-deterministic-v1.1" as const;

export const MARKETING_VALUE_VERDICTS = [
  "strong",
  "publishable",
  "needs_improvement",
  "reject",
] as const;
export type MarketingValueVerdict = (typeof MARKETING_VALUE_VERDICTS)[number];

/** Scores are 0–100 inclusive. */
export type MarketingValueAssessment = {
  contract: typeof MARKETING_VALUE_ASSESSMENT_CONTRACT;
  channel: PublishableChannel;
  overallScore: number;
  verdict: MarketingValueVerdict;
  audienceRelevanceScore: number;
  specificityScore: number;
  usefulnessScore: number;
  noveltyScore: number;
  hookStrengthScore: number;
  payoffScore: number;
  engagementPotentialScore: number;
  propositionAlignmentScore: number;
  evidenceAdequacyForPromiseScore: number;
  reasons: string[];
  weaknesses: string[];
  improvementHints: string[];
  evaluatedAt: string;
  evaluatorVersion: typeof MARKETING_VALUE_EVALUATOR_VERSION | string;
  /** True after human edit until re-evaluated. */
  stale?: boolean;
  hardFail?: boolean;
  hardFailReasons?: string[];
};

export type MarketingValueBundle = {
  contract: typeof MARKETING_VALUE_BUNDLE_CONTRACT;
  candidateId: string;
  sourceRevision: string;
  generatedAt: string;
  channels: Partial<Record<PublishableChannel, MarketingValueAssessment>>;
};

export type MarketingValueCompact = {
  contract: typeof MARKETING_VALUE_ASSESSMENT_CONTRACT;
  channel: PublishableChannel;
  overallScore: number;
  verdict: MarketingValueVerdict;
  reasons: string[];
  improvementHints: string[];
  stale?: boolean;
  hardFail?: boolean;
};

export function toMarketingValueCompact(
  assessment: MarketingValueAssessment,
): MarketingValueCompact {
  return {
    contract: MARKETING_VALUE_ASSESSMENT_CONTRACT,
    channel: assessment.channel,
    overallScore: assessment.overallScore,
    verdict: assessment.verdict,
    reasons: assessment.reasons.slice(0, 5),
    improvementHints: assessment.improvementHints.slice(0, 5),
    stale: assessment.stale,
    hardFail: assessment.hardFail,
  };
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function verdictFromScore(score: number, hardFail: boolean): MarketingValueVerdict {
  if (hardFail) return "reject";
  if (score >= 85) return "strong";
  if (score >= 70) return "publishable";
  if (score >= 50) return "needs_improvement";
  return "reject";
}

export function isMarketingValueApprovable(
  assessment: Pick<MarketingValueAssessment, "verdict" | "stale" | "hardFail"> | null | undefined,
  options?: { allowNeedsImprovementOverride?: boolean },
): boolean {
  if (!assessment || assessment.stale || assessment.hardFail) return false;
  if (assessment.verdict === "strong" || assessment.verdict === "publishable") return true;
  if (assessment.verdict === "needs_improvement") {
    return Boolean(options?.allowNeedsImprovementOverride);
  }
  return false;
}

/** Channel-approval error for a weak assessment, or null when approvable. */
export function marketingValueApprovalBlock(
  assessment: Pick<MarketingValueAssessment, "verdict" | "stale" | "hardFail"> | null | undefined,
  options?: { allowNeedsImprovementOverride?: boolean },
): string | null {
  if (!assessment) return null;
  if (isMarketingValueApprovable(assessment, options)) return null;
  if (assessment.stale) return "regeneration_required:marketing_value_stale";
  if (assessment.verdict === "reject" || assessment.hardFail) {
    return "regeneration_required:marketing_value_reject";
  }
  if (assessment.verdict === "needs_improvement") {
    return "regeneration_required:marketing_value_needs_improvement — edit content or set notes=marketing_value_override";
  }
  return "regeneration_required:marketing_value";
}
