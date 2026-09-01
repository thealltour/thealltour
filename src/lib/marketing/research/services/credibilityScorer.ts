import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type {
  CredibilityAssessment,
  ResearchEvidence,
} from "@/lib/marketing/research/types/researchSignal";

const OFFICIAL_SOURCE_TYPES = new Set([
  "official_government",
  "tourism_board",
  "airline",
  "airport",
]);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function levelFromScore(score: number): CredibilityAssessment["level"] {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.25) return "low";
  return "unknown";
}

export function scoreCredibility(input: {
  source: ResearchSource;
  evidence: ResearchEvidence[];
  corroborationCount?: number;
}): CredibilityAssessment {
  const reasons: string[] = [];
  let score = input.source.defaultCredibility ?? 0.4;

  if (input.source.isOfficial || OFFICIAL_SOURCE_TYPES.has(input.source.sourceType)) {
    score += 0.25;
    reasons.push("official_or_authoritative_source_type");
  }
  if (input.source.authorityLevel === "official") {
    score += 0.15;
    reasons.push("source_authority_official");
  } else if (input.source.authorityLevel === "primary") {
    score += 0.08;
    reasons.push("source_authority_primary");
  } else if (input.source.authorityLevel === "community") {
    score -= 0.15;
    reasons.push("community_source_baseline");
  }

  const hasDirect = input.evidence.some(
    (e) => e.evidenceType === "direct_source" || e.evidenceType === "official_statement",
  );
  if (hasDirect) {
    score += 0.1;
    reasons.push("direct_or_official_evidence");
  } else {
    score -= 0.1;
    reasons.push("missing_direct_evidence");
  }

  const urlCount = input.evidence.filter((e) => e.url).length;
  if (urlCount === 0) {
    score -= 0.15;
    reasons.push("provenance_url_missing");
  } else {
    reasons.push("provenance_url_present");
  }

  const corroboration = input.corroborationCount ?? 0;
  if (corroboration > 0) {
    score += Math.min(0.15, corroboration * 0.05);
    reasons.push(`corroboration_count_${corroboration}`);
  }

  score = clamp01(score);
  return { score, level: levelFromScore(score), reasons };
}
