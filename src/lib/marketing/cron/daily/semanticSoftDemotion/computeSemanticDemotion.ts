import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { marketingSemanticCosineSimilarity } from "@/lib/marketing/semantic/entityEmbeddings/inMemorySemanticEmbeddingRepository";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";
import {
  SEMANTIC_BAND_DIAGNOSTIC_MAX,
  SEMANTIC_BAND_NEAR_DUPLICATE_MAX,
  SEMANTIC_BAND_SAME_TOPIC_MAX,
  SEMANTIC_BAND_STRONG_MIN,
  SEMANTIC_DEMOTION_MODERATE,
  SEMANTIC_DEMOTION_STRONG,
  SEMANTIC_DEMOTION_WEAK,
  SEMANTIC_SOFT_DEMOTION_MODEL,
  SEMANTIC_SOFT_DEMOTION_REVISION,
  SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/constants";
import {
  computeCorroborationSignals,
  type CorroborationBreakdown,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/corroboration";
import type { MarketingSemanticDemotionMode } from "@/lib/marketing/cron/daily/semanticSoftDemotion/demotionModeConfig";
import type {
  SemanticBand,
  SemanticDemotionDecision,
  SemanticSoftDemotionReport,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/types";

export function resolveSemanticBand(similarity: number): SemanticBand {
  if (similarity >= SEMANTIC_BAND_STRONG_MIN) return "strong_duplicate_candidate";
  if (similarity >= SEMANTIC_BAND_SAME_TOPIC_MAX && similarity <= SEMANTIC_BAND_NEAR_DUPLICATE_MAX) {
    return "near_duplicate_candidate";
  }
  // Gap (0.80, 0.82) treated as near-duplicate candidate for soft policy continuity.
  if (similarity > SEMANTIC_BAND_NEAR_DUPLICATE_MAX && similarity < SEMANTIC_BAND_STRONG_MIN) {
    return "near_duplicate_candidate";
  }
  if (similarity >= SEMANTIC_BAND_DIAGNOSTIC_MAX) return "same_topic_signal";
  return "diagnostic_only";
}

/**
 * Soft demotion requires at least one CONTENT/EVENT corroborator.
 * Context/bias alone (source, series, destination-only, date-only) => never.
 * Exact URL/title identity is not routed through semantic demotion.
 */
export function resolveDemotionAmount(input: {
  band: SemanticBand;
  breakdown: CorroborationBreakdown;
}): { amount: number; reason: string | null } {
  // Exact duplicates belong to deterministic cooldown/title-dedupe — not semantic soft demotion.
  if (input.breakdown.deterministicExactSignals.length > 0) {
    return { amount: 0, reason: null };
  }

  if (!input.breakdown.hasContentCorroboration) {
    return { amount: 0, reason: null };
  }

  const content = input.breakdown.contentCorroborators;

  if (input.band === "strong_duplicate_candidate") {
    return {
      amount: SEMANTIC_DEMOTION_STRONG,
      reason: `semantic_strong_soft_demote:${content.join("+")}`,
    };
  }

  if (input.band === "near_duplicate_candidate") {
    if (input.breakdown.hasStrongContentCorroboration || content.length >= 2) {
      return {
        amount: SEMANTIC_DEMOTION_MODERATE,
        reason: `semantic_near_soft_demote_moderate:${content.join("+")}`,
      };
    }
    return {
      amount: SEMANTIC_DEMOTION_WEAK,
      reason: `semantic_near_soft_demote_weak:${content.join("+")}`,
    };
  }

  // same_topic / diagnostic: no duplicate penalty.
  return { amount: 0, reason: null };
}

export type ComputeSemanticDemotionInput = {
  candidates: CompactManagerAgendaCandidate[];
  /** researchBriefId -> embedding vector (durable store). Missing => no semantic compare. */
  embeddingsByBriefId: Map<string, EmbeddingVector>;
  model?: string;
  revision?: string;
  sourceTextVersion?: string;
  /** Optional repository/load failure marker. */
  loadError?: string | null;
  /** Activation mode — compute never mutates scores; appliedDemotedCount stays 0 here. */
  mode?: MarketingSemanticDemotionMode;
};

function emptyDecision(
  c: CompactManagerAgendaCandidate,
  partial: Partial<SemanticDemotionDecision> = {},
): SemanticDemotionDecision {
  return {
    agendaCandidateId: c.agendaCandidateId,
    researchBriefId: c.researchBriefId,
    semanticAvailable: false,
    semanticSimilarity: null,
    comparedResearchBriefId: null,
    comparedAgendaCandidateId: null,
    semanticBand: null,
    contentCorroborators: [],
    contextSignals: [],
    deterministicExactSignals: [],
    duplicateSignals: [],
    demotionAmount: 0,
    demotionReason: null,
    ...partial,
  };
}

function finalizeReport(
  partial: {
    semanticAvailable: boolean;
    degraded: boolean;
    degradeReason: string | null;
    model: string;
    revision: string;
    sourceTextVersion: string;
    embeddingsLoaded: number;
    decisions: SemanticDemotionDecision[];
    demotedCount: number;
  },
  mode: MarketingSemanticDemotionMode,
): SemanticSoftDemotionReport {
  const hypothetical = partial.decisions.filter((d) => d.demotionAmount > 0).length;
  const comparedCount = partial.decisions.filter(
    (d) => d.semanticSimilarity != null && d.comparedResearchBriefId != null,
  ).length;
  return {
    ...partial,
    mode,
    embeddingAvailableCount: partial.embeddingsLoaded,
    comparedCount,
    demotedCount: hypothetical,
    hypotheticalDemotedCount: hypothetical,
    // Compute never applies scores — runner sets appliedDemotedCount for live.
    appliedDemotedCount: 0,
  };
}

/**
 * Pure computation: for each candidate, compare against higher-ranked peers.
 * Demotes the lower-ranked near-duplicate only when content corroboration exists.
 * Never removes candidates. Never hard-rejects. Never mutates input scores.
 */
export function computeSemanticDemotion(
  input: ComputeSemanticDemotionInput,
): SemanticSoftDemotionReport {
  const model = input.model ?? SEMANTIC_SOFT_DEMOTION_MODEL;
  const revision = input.revision ?? SEMANTIC_SOFT_DEMOTION_REVISION;
  const sourceTextVersion = input.sourceTextVersion ?? SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION;
  const mode = input.mode ?? "shadow";
  const candidates = input.candidates;
  const embeddings = input.embeddingsByBriefId;

  if (input.loadError) {
    return finalizeReport(
      {
        semanticAvailable: false,
        degraded: true,
        degradeReason: input.loadError,
        model,
        revision,
        sourceTextVersion,
        embeddingsLoaded: 0,
        decisions: candidates.map((c) =>
          emptyDecision(c, {
            degraded: true,
            degradeReason: input.loadError,
          }),
        ),
        demotedCount: 0,
      },
      mode,
    );
  }

  const decisions: SemanticDemotionDecision[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const embedding = embeddings.get(candidate.researchBriefId);
    if (!embedding) {
      decisions.push(emptyDecision(candidate));
      continue;
    }

    let best: {
      similarity: number;
      peer: CompactManagerAgendaCandidate;
      breakdown: CorroborationBreakdown;
      amount: number;
      reason: string | null;
      band: SemanticBand;
    } | null = null;

    for (let j = 0; j < i; j += 1) {
      const peer = candidates[j]!;
      const peerEmbedding = embeddings.get(peer.researchBriefId);
      if (!peerEmbedding) continue;

      const similarity = marketingSemanticCosineSimilarity(embedding, peerEmbedding);
      const band = resolveSemanticBand(similarity);
      const breakdown = computeCorroborationSignals(candidate, peer);
      const demotion = resolveDemotionAmount({ band, breakdown });

      if (
        !best ||
        demotion.amount > best.amount ||
        (demotion.amount === best.amount && similarity > best.similarity)
      ) {
        best = {
          similarity,
          peer,
          breakdown,
          amount: demotion.amount,
          reason: demotion.reason,
          band,
        };
      }
    }

    if (!best) {
      decisions.push(
        emptyDecision(candidate, {
          semanticAvailable: true,
        }),
      );
      continue;
    }

    decisions.push({
      agendaCandidateId: candidate.agendaCandidateId,
      researchBriefId: candidate.researchBriefId,
      semanticAvailable: true,
      semanticSimilarity: Number(best.similarity.toFixed(4)),
      comparedResearchBriefId: best.peer.researchBriefId,
      comparedAgendaCandidateId: best.peer.agendaCandidateId,
      semanticBand: best.band,
      contentCorroborators: best.breakdown.contentCorroborators,
      contextSignals: best.breakdown.contextSignals,
      deterministicExactSignals: best.breakdown.deterministicExactSignals,
      duplicateSignals: [
        ...best.breakdown.deterministicExactSignals,
        ...best.breakdown.contentCorroborators,
        ...best.breakdown.contextSignals,
      ],
      demotionAmount: best.amount,
      demotionReason: best.reason,
    });
  }

  return finalizeReport(
    {
      semanticAvailable: embeddings.size > 0,
      degraded: false,
      degradeReason: null,
      model,
      revision,
      sourceTextVersion,
      embeddingsLoaded: embeddings.size,
      decisions,
      demotedCount: decisions.filter((d) => d.demotionAmount > 0).length,
    },
    mode,
  );
}
