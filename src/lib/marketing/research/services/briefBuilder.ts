import { randomUUID } from "node:crypto";

import { scoreCorroboration } from "@/lib/marketing/research/services/corroborationScorer";
import { selectPrimarySignal } from "@/lib/marketing/research/services/primarySignalSelector";
import type { ResearchCluster } from "@/lib/marketing/research/services/researchCluster";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

function mergeUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function mergeCredibility(signals: ResearchSignal[], corroborationScore: number) {
  const primary = signals.sort(
    (a, b) => (b.credibility?.score ?? 0) - (a.credibility?.score ?? 0),
  )[0];
  const base = primary?.credibility ?? {
    score: 0,
    level: "unknown" as const,
    reasons: ["missing_credibility_assessment"],
  };
  const boosted = Math.min(1, base.score + corroborationScore * 0.12);
  return {
    ...base,
    score: boosted,
    reasons: [...base.reasons, ...(corroborationScore >= 0.5 ? ["corroboration_boost"] : [])],
  };
}

export function buildResearchBriefFromCluster(input: {
  cluster: ResearchCluster;
  signals: ResearchSignal[];
  sources: Map<string, ResearchSource>;
  now?: Date;
}): ResearchBrief | null {
  const eligible = input.signals.filter((s) => s.status === "eligible" || s.duplicateOfSignalId);
  if (eligible.length === 0) return null;

  const primary = selectPrimarySignal(eligible, input.sources);
  const now = input.now ?? new Date();

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

  const corroboration = scoreCorroboration({
    clusterSignals: eligible,
    sources: input.sources,
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
    clusterId: input.cluster.id,
    claims,
    evidence: dedupedEvidence,
    topics: mergeUnique(eligible.flatMap((s) => s.topics)),
    destinations: mergeUnique(eligible.flatMap((s) => s.destinations)),
    entities: mergeUnique(eligible.flatMap((s) => s.entities)),
    freshness,
    credibility: mergeCredibility(eligible, corroboration.score),
    travelRelevance: primary.travelRelevance ?? {
      score: 0,
      reasons: ["missing_relevance_assessment"],
    },
    publicInterest:
      primary.publicInterestScore ??
      eligible.reduce((max, s) => Math.max(max, s.publicInterestScore ?? 0), 0),
    commercialRelevance: primary.commercialRelevance ?? null,
    corroboration,
    risks:
      (primary.credibility?.level === "low" ? ["low_credibility_source"] : []) as string[],
    openQuestions: [],
    generatedAt: now.toISOString(),
    validUntil: primary.expiresAt ?? null,
    status: "active",
  };
}

/** @deprecated Prefer buildResearchBriefFromCluster for semantic clusters. */
export function buildResearchBriefFromSignals(
  signals: ResearchSignal[],
  now: Date = new Date(),
): ResearchBrief | null {
  return buildResearchBriefFromCluster({
    cluster: {
      id: randomUUID(),
      primarySignalId: signals[0]?.id ?? randomUUID(),
      signalIds: signals.map((s) => s.id),
      clusterType: signals.length > 1 ? "semantic_event" : "destination_group",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    signals,
    sources: new Map(),
    now,
  });
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
