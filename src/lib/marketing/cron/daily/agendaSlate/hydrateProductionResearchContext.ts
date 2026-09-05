import "server-only";

import { truncateBotText } from "@/lib/marketing/bot/sanitize";
import type { MarketingProductionRequest } from "@/lib/marketing/cron/daily/agendaSlate/productionRequestTypes";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { createResearchRepository } from "@/lib/marketing/research/repository/createResearchRepository";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerEvidenceRef,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchEvidence } from "@/lib/marketing/research/types/researchSignal";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

const EVIDENCE_EXCERPT_MAX = 280;

/**
 * Fail-closed errors for queued Agenda production research hydration.
 * Do not silently continue with summary-only factual production.
 */
export class ProductionResearchHydrationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "research_context_unavailable"
      | "research_identity_mismatch"
      | "research_evidence_unavailable",
  ) {
    super(message);
    this.name = "ProductionResearchHydrationError";
  }

  toPipelineMessage(): string {
    return `${this.code}:${this.message}`;
  }
}

export type HydratedProductionResearchContext = {
  researchCandidate: CompactManagerAgendaCandidate;
  researchBrief: CompactManagerResearchBrief;
};

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
): Promise<CompactManagerResearchBrief> {
  const signalTypes = new Set<string>();
  for (const signalId of brief.signalIds.slice(0, 6)) {
    const signal = await repo.findSignalById(signalId);
    if (signal) signalTypes.add(signal.signalType);
  }

  const evidence: CompactManagerEvidenceRef[] = [];
  const sourceCache = new Map<string, ResearchSource | null>();
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
    signalTypes: [...signalTypes],
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

/**
 * Load canonical AgendaCandidate + ResearchBrief for a durable ProductionRequest
 * that stores stable IDs but not evidence blobs.
 *
 * Contract:
 *   durable request IDs + canonical persisted research hydration at execution time
 */
export async function hydrateProductionResearchContext(
  request: Pick<MarketingProductionRequest, "selection" | "slateItemId" | "requestId">,
  deps: { repo?: ResearchRepository } = {},
): Promise<HydratedProductionResearchContext> {
  const agendaCandidateId = request.selection.agendaCandidateId?.trim() || null;
  const researchBriefId = request.selection.researchBriefId?.trim() || null;

  if (!agendaCandidateId || !researchBriefId) {
    throw new ProductionResearchHydrationError(
      "production selection missing agendaCandidateId or researchBriefId",
      "research_context_unavailable",
    );
  }

  let repo: ResearchRepository;
  try {
    repo = deps.repo ?? (await createResearchRepository());
  } catch (error) {
    throw new ProductionResearchHydrationError(
      error instanceof Error ? error.message : "research_repository_unavailable",
      "research_context_unavailable",
    );
  }

  let candidate: AgendaCandidate | null;
  let brief: ResearchBrief | null;
  try {
    candidate = await repo.findAgendaCandidateById(agendaCandidateId);
    brief = await repo.findBriefById(researchBriefId);
  } catch (error) {
    throw new ProductionResearchHydrationError(
      error instanceof Error ? error.message : "research_lookup_failed",
      "research_context_unavailable",
    );
  }

  if (!candidate || !brief) {
    throw new ProductionResearchHydrationError(
      `canonical research missing candidate=${agendaCandidateId} brief=${researchBriefId}`,
      "research_context_unavailable",
    );
  }

  if (candidate.researchBriefId !== researchBriefId) {
    throw new ProductionResearchHydrationError(
      `agenda candidate ${candidate.id} references brief ${candidate.researchBriefId}, selection has ${researchBriefId}`,
      "research_identity_mismatch",
    );
  }

  if (brief.id !== researchBriefId) {
    throw new ProductionResearchHydrationError(
      `loaded brief id mismatch for ${researchBriefId}`,
      "research_identity_mismatch",
    );
  }

  const compactBrief = await buildCompactBrief(brief, repo);
  if (compactBrief.evidence.length < 1) {
    throw new ProductionResearchHydrationError(
      `canonical research brief ${researchBriefId} has no evidence refs`,
      "research_evidence_unavailable",
    );
  }

  const researchCandidate = buildCompactCandidate(candidate, compactBrief);
  if (researchCandidate.evidence.length < 1) {
    throw new ProductionResearchHydrationError(
      `canonical agenda candidate ${agendaCandidateId} has no evidence refs`,
      "research_evidence_unavailable",
    );
  }

  return {
    researchCandidate,
    researchBrief: compactBrief,
  };
}
