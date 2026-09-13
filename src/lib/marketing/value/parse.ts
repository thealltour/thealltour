import {
  MARKETING_VALUE_ASSESSMENT_CONTRACT,
  MARKETING_VALUE_BUNDLE_CONTRACT,
  MARKETING_VALUE_EVALUATOR_VERSION,
  MARKETING_VALUE_VERDICTS,
  clampScore,
  type MarketingValueAssessment,
  type MarketingValueBundle,
  type MarketingValueVerdict,
} from "@/lib/marketing/value/contracts";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asScore(value: unknown): number {
  return clampScore(typeof value === "number" ? value : Number(value));
}

function asStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean).slice(0, max);
}

function asVerdict(value: unknown): MarketingValueVerdict {
  if (typeof value === "string" && (MARKETING_VALUE_VERDICTS as readonly string[]).includes(value)) {
    return value as MarketingValueVerdict;
  }
  return "reject";
}

export function parseMarketingValueAssessment(
  raw: unknown,
): MarketingValueAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const channel = asString(row.channel) as PublishableChannel;
  if (!channel) return null;
  return {
    contract: MARKETING_VALUE_ASSESSMENT_CONTRACT,
    channel,
    overallScore: asScore(row.overallScore),
    verdict: asVerdict(row.verdict),
    audienceRelevanceScore: asScore(row.audienceRelevanceScore),
    specificityScore: asScore(row.specificityScore),
    usefulnessScore: asScore(row.usefulnessScore),
    noveltyScore: asScore(row.noveltyScore),
    hookStrengthScore: asScore(row.hookStrengthScore),
    payoffScore: asScore(row.payoffScore),
    engagementPotentialScore: asScore(row.engagementPotentialScore),
    propositionAlignmentScore: asScore(row.propositionAlignmentScore),
    evidenceAdequacyForPromiseScore: asScore(row.evidenceAdequacyForPromiseScore),
    reasons: asStringArray(row.reasons, 8),
    weaknesses: asStringArray(row.weaknesses, 8),
    improvementHints: asStringArray(row.improvementHints, 8),
    evaluatedAt: asString(row.evaluatedAt) || new Date().toISOString(),
    evaluatorVersion: asString(row.evaluatorVersion) || MARKETING_VALUE_EVALUATOR_VERSION,
    stale: Boolean(row.stale),
    hardFail: Boolean(row.hardFail),
    hardFailReasons: asStringArray(row.hardFailReasons, 8),
  };
}

export function parseMarketingValueBundle(raw: unknown): MarketingValueBundle | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.contract !== MARKETING_VALUE_BUNDLE_CONTRACT) return null;
  const channelsRaw =
    row.channels && typeof row.channels === "object"
      ? (row.channels as Record<string, unknown>)
      : {};
  const channels: MarketingValueBundle["channels"] = {};
  for (const [key, value] of Object.entries(channelsRaw)) {
    const parsed = parseMarketingValueAssessment(value);
    if (parsed) channels[key as PublishableChannel] = parsed;
  }
  return {
    contract: MARKETING_VALUE_BUNDLE_CONTRACT,
    candidateId: asString(row.candidateId),
    sourceRevision: asString(row.sourceRevision),
    generatedAt: asString(row.generatedAt) || new Date().toISOString(),
    channels,
  };
}
