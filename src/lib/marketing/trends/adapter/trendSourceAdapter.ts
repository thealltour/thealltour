/**
 * TrendSourceAdapter — Meta TrendSignal → internal Research domain.
 * Explicit layer separation:
 *   A Trend Discovery
 *   B Editorial Intelligence
 *   C Factual Verification (unverified queue only)
 *   D Provenance / Diagnostics
 */

import { randomUUID } from "node:crypto";

import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type {
  ResearchBriefEditorialIntelligence,
  ResearchBriefMarketRelevanceSignals,
  ResearchBriefTrendContext,
} from "@/lib/marketing/research/types/editorialIntelligence";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { TrendSignalPayloadV1 } from "@/lib/marketing/trends/types";

/** Deterministic Meta AI research source id (valid UUID, not a secret). */
export const META_AI_TREND_SOURCE_ID = "a1000000-0000-4000-8000-000000000001";

export type AdaptedTrendLayers = {
  /** A — Trend Discovery */
  discovery: {
    topic: string;
    summary: string;
    trendType: string;
    window: { start: string; end: string };
    trendSignalStatus: string;
    marketRelevance: ResearchBriefMarketRelevanceSignals;
  };
  /** B — Editorial Intelligence */
  editorial: ResearchBriefEditorialIntelligence;
  /** C — Factual (unverified only) */
  factualClaimsUnverified: string[];
  /** D — Provenance / diagnostics */
  provenance: ResearchBriefTrendContext & {
    observedMetrics: TrendSignalPayloadV1["observed_metrics"];
    confidenceScore: number;
    popularityScore: number;
    rawContextExcludedFromSemantic: true;
  };
};

export type AdaptTrendSignalResult = {
  layers: AdaptedTrendLayers;
  source: ResearchSource;
  signal: ResearchSignal;
  brief: ResearchBrief;
  agendaCandidate: AgendaCandidate;
};

function mapTrendTypeToSignalType(trendType: string): ResearchSignal["signalType"] {
  switch (trendType) {
    case "fare_price_signal":
      return "airfare";
    case "seasonal_demand":
      return "seasonal_condition";
    case "event_festival":
      return "festival";
    case "entry_visa_policy_interest":
      return "visa";
    case "weather_disruption":
      return "weather";
    case "safety_disruption":
      return "safety";
    case "accommodation_trend":
      return "hotel_resort";
    case "competitor_promotion_signal":
      return "competitor_signal";
    case "destination_interest":
    case "activity_trend":
    case "traveler_behavior_trend":
    case "content_format_trend":
    case "audience_question":
    case "travel_pain_point":
    default:
      return "destination_trend";
  }
}

export function adaptTrendLayers(payload: TrendSignalPayloadV1): AdaptedTrendLayers {
  const mo = payload.marketing_observations;
  return {
    discovery: {
      topic: payload.topic,
      summary: payload.summary,
      trendType: payload.trend_type,
      window: { ...payload.window },
      trendSignalStatus: payload.trend_signal_status,
      marketRelevance: {
        originMarket: "KR",
        travelDirection: "outbound",
        // Input feature only — never copied as koreanTravelerRelevance.
        providerMarketRelevanceScore: payload.market_relevance.score,
        observedBasis: payload.market_relevance.basis.observed,
        inferredBasis: payload.market_relevance.basis.inferred,
      },
    },
    editorial: {
      hookSignals: [...mo.hook_signals],
      formatSignals: [...mo.format_signals],
      audiencePainPoints: [...mo.audience_pain_points],
      audienceQuestions: [...mo.audience_questions],
      personaHints: [...mo.persona_estimates],
      contentAngles: [...mo.content_angles],
    },
    factualClaimsUnverified: payload.factual_claims
      .filter((c) => c.verification_status === "unverified")
      .map((c) => c.claim),
    provenance: {
      provider: "meta_ai",
      observationId: payload.observation_id,
      providerRunId: payload.provider_run_id,
      trendType: payload.trend_type,
      trendSignalStatus: payload.trend_signal_status,
      window: { ...payload.window },
      providerClusterHint: payload.provider_cluster_hint ?? null,
      clusterLabel: payload.cluster_label ?? null,
      verticalTags: [...payload.vertical_tags],
      provenanceLevels: payload.provenance.map((p) => p.level),
      observedMetrics: payload.observed_metrics,
      confidenceScore: payload.confidence.score,
      popularityScore: payload.popularity.score,
      rawContextExcludedFromSemantic: true,
    },
  };
}

export function buildMetaAiTrendSource(now = new Date()): ResearchSource {
  const iso = now.toISOString();
  return {
    id: META_AI_TREND_SOURCE_ID,
    sourceType: "social",
    name: "Meta AI Trend Discovery",
    canonicalUrl: null,
    provider: "meta_ai",
    authorityLevel: "community",
    defaultCredibility: 0.35,
    locale: "ko-KR",
    country: "KR",
    language: "ko",
    isOfficial: false,
    isEnabled: true,
    metadata: {
      role: "trend_discovery_editorial_intelligence_provider",
      neverAccesses: ["agenda_finalize", "cmc", "hmr", "publication", "sns"],
    },
    createdAt: iso,
    updatedAt: iso,
  };
}

/**
 * Pure adapt: build Research domain objects from a validated TrendSignalPayload.
 * Does not persist. Does not promote factual claims to verified research facts.
 */
export function adaptTrendSignalToResearch(
  payload: TrendSignalPayloadV1,
  now = new Date(),
): AdaptTrendSignalResult {
  const layers = adaptTrendLayers(payload);
  const source = buildMetaAiTrendSource(now);
  const signalId = randomUUID();
  const briefId = randomUUID();
  const evidenceId = randomUUID();
  const iso = now.toISOString();

  const l1 = payload.provenance.find((p) => p.level === "L1");
  const l1Url = l1 && l1.level === "L1" && typeof l1.url === "string" ? l1.url : null;

  const evidence = {
    id: evidenceId,
    sourceId: source.id,
    url: typeof l1Url === "string" ? l1Url : null,
    title: payload.topic,
    excerpt: payload.summary.slice(0, 400),
    reference: `meta_ai:${payload.observation_id}`,
    publishedAt: payload.published_at ?? null,
    observedAt: payload.observed_at,
    evidenceType: "derived_signal" as const,
  };

  const claims =
    layers.factualClaimsUnverified.length > 0
      ? layers.factualClaimsUnverified.map((c) => `[unverified] ${c}`)
      : [`[unverified trend] ${payload.topic}: ${payload.summary.slice(0, 200)}`];

  const signal: ResearchSignal = {
    id: signalId,
    sourceId: source.id,
    sourceType: source.sourceType,
    signalType: mapTrendTypeToSignalType(payload.trend_type),
    title: payload.topic,
    summary: payload.summary,
    claim: claims[0] ?? null,
    claimSource: "derived",
    evidence: [evidence],
    canonicalUrl: typeof l1Url === "string" ? l1Url : null,
    externalId: payload.observation_id,
    publishedAt: payload.published_at ?? null,
    observedAt: payload.observed_at,
    expiresAt: payload.window.end,
    geography: ["KR"],
    destinations: payload.destinations ?? [],
    topics: [payload.trend_type, ...payload.vertical_tags].slice(0, 12),
    entities: payload.destinations ?? [],
    freshness: {
      publishedAt: payload.published_at ?? null,
      observedAt: payload.observed_at,
      expiresAt: payload.window.end,
      halfLifeHours: 72,
      freshnessScore: 0.7,
    },
    credibility: {
      score: 0.35,
      level: "low",
      reasons: ["meta_trend_provider", "unverified_facts"],
    },
    travelRelevance: {
      score: 0.55,
      reasons: ["kr_outbound_trend", payload.trend_type],
      marketRelevance: layers.discovery.marketRelevance.providerMarketRelevanceScore,
    },
    publicInterestScore: Math.min(0.85, 0.3 + payload.popularity.score * 0.4),
    commercialRelevance: null,
    language: "ko",
    rawFingerprint: `meta_trend:${payload.provider}:${payload.observation_id}`,
    normalizedFingerprint: `meta_trend:${payload.observation_id}`,
    status: "eligible",
    metadata: {
      trendType: payload.trend_type,
      trendSignalStatus: payload.trend_signal_status,
      providerClusterHint: payload.provider_cluster_hint ?? null,
    },
    createdAt: iso,
    updatedAt: iso,
  };

  const brief: ResearchBrief = {
    id: briefId,
    title: payload.topic,
    summary: payload.summary,
    signalIds: [signalId],
    primarySignalId: signalId,
    clusterId: null,
    claims,
    evidence: [evidence],
    topics: signal.topics,
    destinations: signal.destinations,
    entities: signal.entities,
    freshness: signal.freshness!,
    credibility: signal.credibility!,
    travelRelevance: signal.travelRelevance!,
    publicInterest: signal.publicInterestScore ?? 0.4,
    commercialRelevance: null,
    corroboration: {
      score: 0.25,
      sourceDiversityCount: 1,
      independentSourceCount: 1,
      reasons: ["single_trend_observation_adapter"],
    },
    risks: ["meta_factual_unverified", "trend_provider_not_authority"],
    openQuestions: [
      ...layers.editorial.audienceQuestions.slice(0, 4),
      "Requires internal corroboration before publication claims",
    ],
    generatedAt: iso,
    validUntil: payload.window.end,
    status: "active",
    editorialIntelligence: layers.editorial,
    trendContext: {
      provider: "meta_ai",
      observationId: payload.observation_id,
      providerRunId: payload.provider_run_id,
      trendType: payload.trend_type,
      trendSignalStatus: payload.trend_signal_status,
      window: { ...payload.window },
      providerClusterHint: payload.provider_cluster_hint ?? null,
      clusterLabel: payload.cluster_label ?? null,
      verticalTags: [...payload.vertical_tags],
      provenanceLevels: payload.provenance.map((p) => p.level),
    },
    marketRelevanceSignals: layers.discovery.marketRelevance,
  };

  const agendaCandidate = buildAgendaCandidateFromBrief(brief, now, [], {
    signalTypes: [signal.signalType],
    evidenceSources: [source],
  });

  return { layers, source, signal, brief, agendaCandidate };
}

export async function persistAdaptedTrend(
  adapted: AdaptTrendSignalResult,
  repo: ResearchRepository,
): Promise<AdaptTrendSignalResult> {
  await repo.upsertSource(adapted.source);
  const signal = await repo.upsertSignal(adapted.signal);
  const brief = await repo.upsertBrief({
    ...adapted.brief,
    signalIds: [signal.id],
    primarySignalId: signal.id,
  });
  const agendaCandidate = await repo.upsertAgendaCandidate({
    ...adapted.agendaCandidate,
    researchBriefId: brief.id,
  });
  return { ...adapted, signal, brief, agendaCandidate };
}
