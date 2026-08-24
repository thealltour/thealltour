import { canonicalPurpose } from "@/lib/marketing/retrieval/validation";
import {
  MATCH_EXACT,
  MATCH_MISS,
  MATCH_NEUTRAL,
  MATCH_SCORE_WEIGHT,
  PURPOSE_SOURCE_PRIORITY,
  SOURCE_PRIORITY_WEIGHT,
} from "@/lib/marketing/scoring/constants";
import {
  candidateAgendaId,
  candidateCampaignIds,
  candidateChannel,
  candidateProductId,
} from "@/lib/marketing/scoring/candidateAccessors";
import { clamp01 } from "@/lib/marketing/scoring/clamp";
import type { ContextCandidate, ScoringRequest } from "@/lib/marketing/scoring/types";

export function purposeSourcePriority(purpose: string, sourceKey: ContextCandidate["sourceKey"]): number {
  const order = PURPOSE_SOURCE_PRIORITY[canonicalPurpose(purpose)] ?? [];
  const index = order.indexOf(sourceKey);
  if (index < 0) return 0.35;
  if (order.length === 1) return 1;
  return 1 - (index / (order.length - 1)) * 0.5;
}

export function matchDimension(requestValue: string | undefined, candidateValue: string | null): number | null {
  if (!requestValue) return null;
  if (!candidateValue) return MATCH_NEUTRAL;
  return candidateValue === requestValue ? MATCH_EXACT : MATCH_MISS;
}

export function matchOneOf(requestValue: string | undefined, candidateValues: string[]): number | null {
  if (!requestValue) return null;
  if (candidateValues.length === 0) return MATCH_NEUTRAL;
  return candidateValues.includes(requestValue) ? MATCH_EXACT : MATCH_MISS;
}

export function scoreRelevance(candidate: ContextCandidate, request: ScoringRequest): number {
  const sourcePriority = purposeSourcePriority(request.canonicalPurpose ?? request.purpose, candidate.sourceKey);
  const dimensions = [
    matchDimension(request.productId, candidateProductId(candidate)),
    matchDimension(request.channel, candidateChannel(candidate)),
    matchOneOf(request.campaignId, candidateCampaignIds(candidate)),
    matchDimension(request.agendaId, candidateAgendaId(candidate)),
  ].filter((value): value is number => value != null);
  const matchScore =
    dimensions.length === 0 ? MATCH_NEUTRAL : dimensions.reduce((sum, value) => sum + value, 0) / dimensions.length;
  return clamp01(sourcePriority * SOURCE_PRIORITY_WEIGHT + matchScore * MATCH_SCORE_WEIGHT);
}
