import { randomUUID } from "node:crypto";

import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

function mergeUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildResearchBriefFromSignals(
  signals: ResearchSignal[],
  now: Date = new Date(),
): ResearchBrief | null {
  const eligible = signals.filter(
    (s) => s.status === "eligible" && !s.duplicateOfSignalId,
  );
  if (eligible.length === 0) return null;

  const primary =
    eligible.sort(
      (a, b) =>
        (b.credibility?.score ?? 0) - (a.credibility?.score ?? 0) ||
        (b.freshness?.freshnessScore ?? 0) - (a.freshness?.freshnessScore ?? 0),
    )[0]!;

  const claims = mergeUnique(
    eligible.map((s) => s.claim).filter((c): c is string => Boolean(c)),
  );
  if (claims.length === 0 && primary.summary) {
    claims.push(primary.summary);
  }

  const evidence = eligible.flatMap((s) => s.evidence);
  const evidenceIds = new Set<string>();
  const dedupedEvidence = evidence.filter((e) => {
    if (evidenceIds.has(e.id)) return false;
    evidenceIds.add(e.id);
    return true;
  });

  const freshness = primary.freshness ?? {
    observedAt: primary.observedAt,
    publishedAt: primary.publishedAt ?? null,
    expiresAt: primary.expiresAt ?? null,
    halfLifeHours: null,
    freshnessScore: null,
  };

  return {
    id: randomUUID(),
    title: primary.title,
    summary: primary.summary,
    signalIds: eligible.map((s) => s.id),
    primarySignalId: primary.id,
    claims,
    evidence: dedupedEvidence,
    topics: mergeUnique(eligible.flatMap((s) => s.topics)),
    destinations: mergeUnique(eligible.flatMap((s) => s.destinations)),
    entities: mergeUnique(eligible.flatMap((s) => s.entities)),
    freshness,
    credibility: primary.credibility ?? {
      score: 0,
      level: "unknown",
      reasons: ["missing_credibility_assessment"],
    },
    travelRelevance: primary.travelRelevance ?? {
      score: 0,
      reasons: ["missing_relevance_assessment"],
    },
    publicInterest:
      primary.publicInterestScore ??
      eligible.reduce((max, s) => Math.max(max, s.publicInterestScore ?? 0), 0),
    commercialRelevance: primary.commercialRelevance ?? null,
    risks:
      (primary.credibility?.level === "low"
        ? ["low_credibility_source"]
        : []) as string[],
    openQuestions: [],
    generatedAt: now.toISOString(),
    validUntil: primary.expiresAt ?? null,
    status: "active",
  };
}

/** Guard: brief must not implicitly become a content draft. */
export function assertResearchBriefNotContentDraft(brief: ResearchBrief): void {
  const forbidden = ["caption", "hook", "cta", "hashtags", "channelCopy"] as const;
  for (const key of forbidden) {
    if (key in (brief as unknown as Record<string, unknown>)) {
      throw new Error(`ResearchBrief must not include content field: ${key}`);
    }
  }
}
