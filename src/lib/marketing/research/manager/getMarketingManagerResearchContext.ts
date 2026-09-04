import "server-only";

import { truncateBotText } from "@/lib/marketing/bot/sanitize";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { createResearchRepository } from "@/lib/marketing/research/repository/createResearchRepository";
import {
  rankAgendaCandidates,
  resolveKoreanOutboundForBrief,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import { aggregateEvidenceSourceRoleWeights } from "@/lib/marketing/research/portfolio/sourcePortfolioRoles";
import { isStaleFreshness } from "@/lib/marketing/research/services/freshnessScorer";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerEvidenceRef,
  CompactManagerResearchBrief,
  GetMarketingManagerResearchContextOptions,
  MarketingResearchContext,
  MarketingResearchContextStatus,
} from "@/lib/marketing/research/manager/types";
import { MARKETING_RESEARCH_CONTEXT_CONTRACT } from "@/lib/marketing/research/manager/types";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchEvidence } from "@/lib/marketing/research/types/researchSignal";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const DEFAULT_LIMIT = 10;
const DEFAULT_LOOKBACK_HOURS = 168;
const MAX_LIMIT = 15;
const EVIDENCE_EXCERPT_MAX = 280;

export type MarketingManagerResearchContextDeps = {
  repo?: ResearchRepository;
  now?: Date;
  checkSemanticInfrastructure?: () => Promise<boolean>;
};

function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function clampLookbackHours(hours?: number): number {
  if (hours == null || !Number.isFinite(hours)) return DEFAULT_LOOKBACK_HOURS;
  return Math.max(1, Math.min(24 * 30, Math.floor(hours)));
}

function matchesFilter(values: string[], filter?: string): boolean {
  if (!filter?.trim()) return true;
  const needle = filter.trim().toLowerCase();
  return values.some((v) => v.toLowerCase().includes(needle));
}

async function resolveSignalTypes(
  repo: ResearchRepository,
  brief: ResearchBrief,
): Promise<string[]> {
  const types = new Set<string>();
  for (const signalId of brief.signalIds.slice(0, 6)) {
    const signal = await repo.findSignalById(signalId);
    if (signal) types.add(signal.signalType);
  }
  return [...types];
}

function mapEvidenceRef(
  evidence: ResearchEvidence,
  source: ResearchSource | null,
): CompactManagerEvidenceRef {
  return {
    evidenceId: evidence.id,
    sourceId: evidence.sourceId,
    sourceType: source?.sourceType ?? null,
    sourceName: source?.name ?? null,
    isOfficial: Boolean(source?.isOfficial || source?.sourceType === "official_government"),
    evidenceType: evidence.evidenceType,
    url: evidence.url ?? null,
    reference: evidence.reference ?? null,
    excerpt: truncateBotText(evidence.excerpt, EVIDENCE_EXCERPT_MAX),
    publishedAt: evidence.publishedAt ?? null,
    observedAt: evidence.observedAt,
  };
}

async function buildCompactBrief(
  brief: ResearchBrief,
  repo: ResearchRepository,
  sourceCache: Map<string, ResearchSource | null>,
): Promise<CompactManagerResearchBrief> {
  const signalTypes = await resolveSignalTypes(repo, brief);
  const evidence: CompactManagerEvidenceRef[] = [];
  for (const item of brief.evidence.slice(0, 12)) {
    let source = sourceCache.get(item.sourceId);
    if (source === undefined) {
      source = await repo.getSourceById(item.sourceId);
      sourceCache.set(item.sourceId, source);
    }
    evidence.push(mapEvidenceRef(item, source));
  }

  return {
    researchBriefId: brief.id,
    title: brief.title,
    summary: truncateBotText(brief.summary, 600) ?? brief.summary,
    destinations: brief.destinations,
    topics: brief.topics,
    entities: brief.entities,
    signalTypes,
    publishedAt: brief.freshness.publishedAt ?? null,
    observedAt: brief.freshness.observedAt,
    freshnessScore: brief.freshness.freshnessScore ?? 0,
    credibilityScore: brief.credibility.score,
    travelRelevanceScore: brief.travelRelevance.score,
    publicInterestScore: brief.publicInterest,
    corroborationScore: brief.corroboration?.score ?? null,
    commercialRelevance: brief.commercialRelevance
      ? {
          level: brief.commercialRelevance.level,
          matchedProductIds: brief.commercialRelevance.matchedProductIds ?? [],
        }
      : null,
    evidence,
    risks: brief.risks,
    openQuestions: brief.openQuestions,
    generatedAt: brief.generatedAt,
    validUntil: brief.validUntil ?? null,
  };
}

function buildCompactCandidate(
  candidate: AgendaCandidate,
  brief: CompactManagerResearchBrief,
): CompactManagerAgendaCandidate {
  const components = candidate.researchScoreComponents;
  return {
    agendaCandidateId: candidate.id,
    researchBriefId: candidate.researchBriefId,
    title: candidate.title,
    summary: truncateBotText(candidate.rationale, 600) ?? candidate.rationale,
    destinations: brief.destinations,
    topics: brief.topics,
    entities: brief.entities,
    signalTypes: brief.signalTypes,
    publishedAt: brief.publishedAt,
    observedAt: brief.observedAt,
    freshnessScore: candidate.freshnessScore,
    credibilityScore: candidate.credibilityScore,
    travelRelevanceScore: candidate.travelRelevanceScore,
    publicInterestScore: candidate.publicInterestScore,
    commercialRelevanceScore: candidate.commercialLinkageScore ?? 0,
    seasonalityScore: candidate.seasonalityScore ?? 0,
    corroborationScore: candidate.corroborationScore ?? 0,
    noveltyScore: components?.novelty ?? 0,
    koreanOutboundRelevanceScore:
      candidate.koreanOutboundRelevanceScore ?? components?.koreanOutbound ?? 0,
    totalResearchScore: candidate.compositeResearchScore,
    researchScoreComponents: components ?? null,
    scoreReasons: candidate.scoreReasons ?? [],
    riskFlags: candidate.riskFlags,
    matchedProductIds: brief.commercialRelevance?.matchedProductIds ?? [],
    evidence: brief.evidence,
    candidateStatus: candidate.status,
  };
}

function summarizeSources(briefs: CompactManagerResearchBrief[]): MarketingResearchContext["sourceSummary"] {
  const families = new Set<string>();
  let officialSourceCount = 0;
  let newsSourceCount = 0;
  let evidenceCount = 0;

  for (const brief of briefs) {
    for (const ev of brief.evidence) {
      evidenceCount += 1;
      const family = `${ev.sourceType ?? "unknown"}:${ev.sourceName ?? ev.sourceId}`;
      families.add(family);
      if (ev.isOfficial) officialSourceCount += 1;
      if (ev.sourceType === "news") newsSourceCount += 1;
    }
  }

  return {
    officialSourceCount,
    newsSourceCount,
    independentSourceFamilies: families.size,
    evidenceCount,
  };
}

async function defaultSemanticInfrastructureCheck(): Promise<boolean> {
  try {
    const { checkEmbeddingHealth } = await import("@/lib/marketing/semantic/embeddingProvider");
    await checkEmbeddingHealth(process.env);
    return true;
  } catch {
    return false;
  }
}

export async function getMarketingManagerResearchContext(
  options: GetMarketingManagerResearchContextOptions = {},
  deps: MarketingManagerResearchContextDeps = {},
): Promise<MarketingResearchContext> {
  const now = deps.now ?? new Date();
  const limit = clampLimit(options.limit);
  const lookbackHours = clampLookbackHours(options.lookbackHours);
  const since = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000).toISOString();
  const requestedAt = now.toISOString();

  let repo: ResearchRepository;
  try {
    repo = deps.repo ?? (await createResearchRepository());
  } catch (error) {
    return emptyContext({
      status: "unavailable",
      since,
      until: requestedAt,
      lookbackHours,
      requestedAt,
      notes: [
        error instanceof Error ? error.message : "research_repository_unavailable",
      ],
    });
  }

  const semanticOk =
    deps.checkSemanticInfrastructure !== undefined
      ? await deps.checkSemanticInfrastructure()
      : await defaultSemanticInfrastructureCheck();

  let rawCandidates: AgendaCandidate[];
  try {
    rawCandidates = await repo.findRecentAgendaCandidates({
      since,
      limit: Math.max(limit * 6, 60),
    });
  } catch (error) {
    return emptyContext({
      status: "unavailable",
      since,
      until: requestedAt,
      lookbackHours,
      requestedAt,
      notes: [error instanceof Error ? error.message : "agenda_query_failed"],
    });
  }

  const sourceCache = new Map<string, ResearchSource | null>();
  const enriched: AgendaCandidate[] = [];
  const seedByCandidateId = new Map<string, number>();

  for (const candidate of rawCandidates) {
    const brief = await repo.findBriefById(candidate.researchBriefId);
    if (!brief) {
      enriched.push(candidate);
      continue;
    }
    const evidenceSources: Array<ResearchSource | null> = [];
    for (const item of brief.evidence.slice(0, 8)) {
      let source = sourceCache.get(item.sourceId);
      if (source === undefined) {
        source = await repo.getSourceById(item.sourceId);
        sourceCache.set(item.sourceId, source);
      }
      evidenceSources.push(source);
    }
    const sourceRole = aggregateEvidenceSourceRoleWeights(evidenceSources);
    seedByCandidateId.set(candidate.id, sourceRole.agendaSeedWeight);

    {
      const signalTypes = await resolveSignalTypes(repo, brief);
      const components = candidate.researchScoreComponents ?? {
        freshness: candidate.freshnessScore,
        credibility: candidate.credibilityScore,
        travelRelevance: candidate.travelRelevanceScore,
        publicInterest: candidate.publicInterestScore,
        corroboration: candidate.corroborationScore ?? 0.35,
        novelty: 0.5,
        seasonality: candidate.seasonalityScore ?? 0.4,
        commercial: candidate.commercialLinkageScore ?? 0.25,
      };
      const korean = resolveKoreanOutboundForBrief({
        brief,
        components,
        signalTypes,
        sourceRole,
      });
      const baseReasons = (candidate.scoreReasons ?? []).filter((r) => !r.startsWith("koreanOutbound_"));
      enriched.push({
        ...candidate,
        koreanOutboundRelevanceScore: korean.score,
        scoreReasons: [...baseReasons, ...korean.reasons.map((r) => `koreanOutbound_${r}`)].slice(0, 12),
        riskFlags:
          korean.score < 0.15 && !candidate.riskFlags.includes("low_korean_outbound_relevance")
            ? [...candidate.riskFlags, "low_korean_outbound_relevance"]
            : candidate.riskFlags.filter((r) => r !== "low_korean_outbound_relevance" || korean.score < 0.15),
        researchScoreComponents: { ...components, koreanOutbound: korean.score },
      });
    }
  }

  const ranked = rankAgendaCandidates(enriched, { agendaSeedWeightByCandidateId: seedByCandidateId });
  let staleExcludedCount = 0;
  let duplicateExcludedCount = 0;
  const seenBriefIds = new Set<string>();
  const eligible: AgendaCandidate[] = [];

  for (const candidate of ranked) {
    if (candidate.status === "rejected" || candidate.status === "expired") {
      staleExcludedCount += 1;
      continue;
    }
    if (candidate.freshnessScore < 0.15) {
      staleExcludedCount += 1;
      continue;
    }
    if (seenBriefIds.has(candidate.researchBriefId)) {
      duplicateExcludedCount += 1;
      continue;
    }

    const brief = await repo.findBriefById(candidate.researchBriefId);
    if (!brief || brief.status !== "active") {
      staleExcludedCount += 1;
      continue;
    }
    if (isStaleFreshness(brief.freshness, 0.15, now)) {
      staleExcludedCount += 1;
      continue;
    }
    if (!matchesFilter(brief.destinations, options.destination)) {
      continue;
    }
    if (!matchesFilter(brief.topics, options.topic)) {
      continue;
    }

    seenBriefIds.add(candidate.researchBriefId);
    eligible.push(candidate);
    if (eligible.length >= limit) break;
  }

    const briefs: CompactManagerResearchBrief[] = [];
  const agendaCandidates: CompactManagerAgendaCandidate[] = [];

  for (const candidate of eligible) {
    const briefRow = await repo.findBriefById(candidate.researchBriefId);
    if (!briefRow) continue;
    const compactBrief = await buildCompactBrief(briefRow, repo, sourceCache);
    briefs.push(compactBrief);
    agendaCandidates.push(buildCompactCandidate(candidate, compactBrief));
  }

  const hasData = agendaCandidates.length > 0;
  let status: MarketingResearchContextStatus = "ok";
  const notes: string[] = [];

  if (!hasData) {
    status = "empty";
    notes.push("no_eligible_research_in_window");
  } else if (!semanticOk) {
    status = "degraded";
    notes.push("semantic_infrastructure_unavailable_persisted_research_returned");
  }

  return {
    contract: MARKETING_RESEARCH_CONTEXT_CONTRACT,
    status,
    generatedAt: requestedAt,
    window: {
      lookbackHours,
      since,
      until: requestedAt,
    },
    agendaCandidates,
    briefs,
    sourceSummary: summarizeSources(briefs),
    degradedState: hasData
      ? {
          semanticInfrastructureAvailable: semanticOk,
          reason: semanticOk ? null : "embedding_provider_unavailable",
        }
      : null,
    observability: {
      requestedAt,
      candidateCount: agendaCandidates.length,
      briefCount: briefs.length,
      topScore: agendaCandidates[0]?.totalResearchScore ?? null,
      degraded: !semanticOk,
      staleExcludedCount,
      duplicateExcludedCount,
    },
    notes,
  };
}

function emptyContext(input: {
  status: MarketingResearchContextStatus;
  since: string;
  until: string;
  lookbackHours: number;
  requestedAt: string;
  notes: string[];
}): MarketingResearchContext {
  return {
    contract: MARKETING_RESEARCH_CONTEXT_CONTRACT,
    status: input.status,
    generatedAt: input.requestedAt,
    window: {
      lookbackHours: input.lookbackHours,
      since: input.since,
      until: input.until,
    },
    agendaCandidates: [],
    briefs: [],
    sourceSummary: {
      officialSourceCount: 0,
      newsSourceCount: 0,
      independentSourceFamilies: 0,
      evidenceCount: 0,
    },
    degradedState: null,
    observability: {
      requestedAt: input.requestedAt,
      candidateCount: 0,
      briefCount: 0,
      topScore: null,
      degraded: false,
      staleExcludedCount: 0,
      duplicateExcludedCount: 0,
    },
    notes: input.notes,
  };
}
