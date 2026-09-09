/**
 * TrendSourceAdapter — Meta TrendSignal → internal Research domain.
 * Explicit layer separation:
 *   A Trend Discovery
 *   B Editorial Intelligence
 *   C Factual Verification (unverified queue only)
 *   D Provenance / Diagnostics
 *
 * Boundary: TrendSignal may use ISO offset datetimes (+09:00).
 * Research persistence requires UTC `Z` via toResearchUtcDatetime.
 */

import { randomUUID } from "node:crypto";

import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import {
  toResearchUtcDatetime,
  toResearchUtcDatetimeOrNull,
} from "@/lib/marketing/research/datetime";
import { ResearchValidationError } from "@/lib/marketing/research/repository/errors";
import { buildAgendaCandidateFromBrief } from "@/lib/marketing/research/services/agendaCandidateBuilder";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type {
  ResearchBriefEditorialIntelligence,
  ResearchBriefMarketRelevanceSignals,
  ResearchBriefTrendContext,
} from "@/lib/marketing/research/types/editorialIntelligence";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import {
  agendaCandidateSchema,
  researchBriefSchema,
  researchSignalSchema,
  researchSourceSchema,
} from "@/lib/marketing/research/validation";
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

function canonicalWindow(window: { start: string; end: string }): { start: string; end: string } {
  return {
    start: toResearchUtcDatetime(window.start),
    end: toResearchUtcDatetime(window.end),
  };
}

export function adaptTrendLayers(payload: TrendSignalPayloadV1): AdaptedTrendLayers {
  const mo = payload.marketing_observations;
  const window = canonicalWindow(payload.window);
  return {
    discovery: {
      topic: payload.topic,
      summary: payload.summary,
      trendType: payload.trend_type,
      window,
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
      window,
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
 * All Research datetime fields are UTC Z.
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

  const observedAt = toResearchUtcDatetime(payload.observed_at);
  const publishedAt = toResearchUtcDatetimeOrNull(payload.published_at ?? null);
  const window = layers.discovery.window;

  const l1 = payload.provenance.find((p) => p.level === "L1");
  const l1Url = l1 && l1.level === "L1" && typeof l1.url === "string" ? l1.url : null;
  const l1Extra = l1 as { published_at?: string | null; captured_at?: string } | undefined;
  const l1PublishedAt = toResearchUtcDatetimeOrNull(
    typeof l1Extra?.published_at === "string" ? l1Extra.published_at : null,
  );
  const l1CapturedAt =
    typeof l1Extra?.captured_at === "string" ? toResearchUtcDatetime(l1Extra.captured_at) : null;

  // Prefer L1 published when present; otherwise payload-level published_at.
  const evidencePublishedAt = l1PublishedAt ?? publishedAt;
  // Evidence observedAt: prefer L1 captured when present (still <= observed_at after normalize).
  const evidenceObservedAt = l1CapturedAt ?? observedAt;

  const evidence = {
    id: evidenceId,
    sourceId: source.id,
    url: typeof l1Url === "string" ? l1Url : null,
    title: payload.topic,
    excerpt: payload.summary.slice(0, 400),
    reference: `meta_ai:${payload.observation_id}`,
    publishedAt: evidencePublishedAt,
    observedAt: evidenceObservedAt,
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
    publishedAt,
    observedAt,
    expiresAt: window.end,
    geography: ["KR"],
    destinations: payload.destinations ?? [],
    topics: [payload.trend_type, ...payload.vertical_tags].slice(0, 12),
    entities: payload.destinations ?? [],
    freshness: {
      publishedAt,
      observedAt,
      expiresAt: window.end,
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
    validUntil: window.end,
    status: "active",
    editorialIntelligence: layers.editorial,
    trendContext: {
      provider: "meta_ai",
      observationId: payload.observation_id,
      providerRunId: payload.provider_run_id,
      trendType: payload.trend_type,
      trendSignalStatus: payload.trend_signal_status,
      window,
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

/** Validate adapted objects against Research Zod schemas before any durable write. */
export function assertAdaptedTrendPersistable(adapted: AdaptTrendSignalResult): void {
  const source = researchSourceSchema.safeParse(adapted.source);
  if (!source.success) {
    throw new ResearchValidationError(
      `trend_source_invalid:${source.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  const signal = researchSignalSchema.safeParse(adapted.signal);
  if (!signal.success) {
    throw new ResearchValidationError(
      `trend_signal_invalid:${signal.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  const brief = researchBriefSchema.safeParse(adapted.brief);
  if (!brief.success) {
    throw new ResearchValidationError(
      `trend_brief_invalid:${brief.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  const candidate = agendaCandidateSchema.safeParse(adapted.agendaCandidate);
  if (!candidate.success) {
    throw new ResearchValidationError(
      `trend_agenda_candidate_invalid:${candidate.error.issues[0]?.message ?? "invalid"}`,
    );
  }
}

async function rollbackPartialTrendPersist(
  repo: ResearchRepository,
  ids: { candidateId?: string; briefId?: string; signalId?: string },
): Promise<void> {
  try {
    if (ids.candidateId && repo.deleteAgendaCandidateById) {
      await repo.deleteAgendaCandidateById(ids.candidateId);
    }
  } catch {
    // best-effort
  }
  try {
    if (ids.briefId && repo.deleteBriefById) {
      await repo.deleteBriefById(ids.briefId);
    }
  } catch {
    // best-effort
  }
  try {
    if (ids.signalId && repo.deleteSignalById) {
      await repo.deleteSignalById(ids.signalId);
    }
  } catch {
    // best-effort
  }
}

/**
 * Persist adapted trend atomically from the caller's POV:
 * validate first → write → on failure compensate deletes so no orphan durable rows remain.
 * Meta source upsert is idempotent shared identity and is not rolled back.
 */
export async function persistAdaptedTrend(
  adapted: AdaptTrendSignalResult,
  repo: ResearchRepository,
): Promise<AdaptTrendSignalResult> {
  assertAdaptedTrendPersistable(adapted);

  let signalId: string | undefined;
  let briefId: string | undefined;
  let candidateId: string | undefined;

  try {
    await repo.upsertSource(adapted.source);
    const signal = await repo.upsertSignal(adapted.signal);
    signalId = signal.id;
    const brief = await repo.upsertBrief({
      ...adapted.brief,
      signalIds: [signal.id],
      primarySignalId: signal.id,
    });
    briefId = brief.id;
    const agendaCandidate = await repo.upsertAgendaCandidate({
      ...adapted.agendaCandidate,
      researchBriefId: brief.id,
    });
    candidateId = agendaCandidate.id;
    return { ...adapted, signal, brief, agendaCandidate };
  } catch (error) {
    await rollbackPartialTrendPersist(repo, {
      candidateId,
      briefId,
      signalId,
    });
    throw error;
  }
}
