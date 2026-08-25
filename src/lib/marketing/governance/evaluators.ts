import {
  GOVERNANCE_AGENDA_BLOCK_LAST_7_DAYS,
  GOVERNANCE_AGENDA_REVIEW_LAST_30_DAYS,
  GOVERNANCE_AGENDA_REVIEW_LAST_7_DAYS,
  GOVERNANCE_SEMANTIC_REVIEW_MATCH,
  GOVERNANCE_SEMANTIC_STRONG_MATCH,
} from "@/lib/marketing/governance/constants";
import type {
  AgendaFrequencyEvaluation,
  ChannelFrequencyEvaluation,
  ExactDuplicateEvaluation,
  GovernanceAgendaStats,
  GovernanceChannelStats,
  GovernanceMatchedMemory,
  GovernanceReason,
  NormalizedDuplicateEvaluation,
  ParsedGovernanceCandidate,
  SemanticSimilarityEvaluation,
} from "@/lib/marketing/governance/types";

function excludeSelf(existingId: string | null, sourceContentId: string | null): string | null {
  if (!existingId) return null;
  if (sourceContentId && existingId === sourceContentId) return null;
  return existingId;
}

export function evaluateExactDuplicate(input: {
  hash: string;
  existingId: string | null;
  sourceContentId: string | null;
}): ExactDuplicateEvaluation {
  const matchedContentId = excludeSelf(input.existingId, input.sourceContentId);
  const reasons: GovernanceReason[] = matchedContentId
    ? [{ code: "EXACT_DUPLICATE", severity: "critical", matchedContentId }]
    : [];
  return { hash: input.hash, matchedContentId, reasons };
}

export function evaluateNormalizedDuplicate(input: {
  hash: string;
  existingId: string | null;
  sourceContentId: string | null;
}): NormalizedDuplicateEvaluation {
  const matchedContentId = excludeSelf(input.existingId, input.sourceContentId);
  const reasons: GovernanceReason[] = matchedContentId
    ? [{ code: "NORMALIZED_DUPLICATE", severity: "critical", matchedContentId }]
    : [];
  return { hash: input.hash, matchedContentId, reasons };
}

export function evaluateSemanticSimilarity(input: {
  available: boolean;
  candidate: ParsedGovernanceCandidate;
  matches: GovernanceMatchedMemory[];
}): SemanticSimilarityEvaluation {
  if (!input.available) {
    return {
      available: false,
      reasons: [],
      matches: [],
      topScore: null,
      sameAgenda: false,
      sameChannelRecent: false,
      crossChannelAdaptation: false,
    };
  }

  const matches = input.matches.filter((match) => {
    if (!input.candidate.sourceContentId) return true;
    return match.contentId !== input.candidate.sourceContentId;
  });
  const top = matches[0] ?? null;
  const topScore = top?.score ?? null;
  const sameAgenda = matches.some(
    (match) =>
      Boolean(input.candidate.agendaId) &&
      Boolean(match.agendaId) &&
      match.agendaId === input.candidate.agendaId &&
      match.score >= GOVERNANCE_SEMANTIC_REVIEW_MATCH,
  );
  const sameChannelRecent = matches.some(
    (match) =>
      match.score >= GOVERNANCE_SEMANTIC_REVIEW_MATCH &&
      match.channels.includes(input.candidate.channel),
  );
  const crossChannelAdaptation = Boolean(input.candidate.sourceContentId) &&
    input.matches.some(
      (match) =>
        match.contentId === input.candidate.sourceContentId &&
        match.channels.length > 0 &&
        !match.channels.includes(input.candidate.channel),
    );

  const reasons: GovernanceReason[] = [];
  if (top && topScore != null && topScore >= GOVERNANCE_SEMANTIC_STRONG_MATCH) {
    reasons.push({
      code: "SEMANTIC_SIMILARITY_HIGH",
      severity: "high",
      value: topScore,
      matchedContentId: top.contentId,
    });
  } else if (top && topScore != null && topScore >= GOVERNANCE_SEMANTIC_REVIEW_MATCH) {
    reasons.push({
      code: "SEMANTIC_SIMILARITY_REVIEW",
      severity: "medium",
      value: topScore,
      matchedContentId: top.contentId,
    });
  }
  if (sameChannelRecent && top) {
    reasons.push({
      code: "SAME_CHANNEL_RECENT_SIMILAR",
      severity: "high",
      value: topScore,
      matchedContentId: top.contentId,
    });
  }
  if (crossChannelAdaptation) {
    reasons.push({
      code: "CROSS_CHANNEL_ADAPTATION",
      severity: "info",
      matchedContentId: input.candidate.sourceContentId,
    });
  }

  return {
    available: true,
    reasons,
    matches,
    topScore,
    sameAgenda,
    sameChannelRecent,
    crossChannelAdaptation,
  };
}

export function evaluateAgendaFrequency(stats: GovernanceAgendaStats): AgendaFrequencyEvaluation {
  const reasons: GovernanceReason[] = [];
  const overused = stats.publicationsLast7Days >= GOVERNANCE_AGENDA_BLOCK_LAST_7_DAYS;
  const recentRepeat =
    stats.publicationsLast7Days >= GOVERNANCE_AGENDA_REVIEW_LAST_7_DAYS ||
    stats.publicationsLast30Days >= GOVERNANCE_AGENDA_REVIEW_LAST_30_DAYS;
  if (overused) {
    reasons.push({
      code: "AGENDA_OVERUSED",
      severity: "high",
      value: stats.publicationsLast7Days,
    });
  } else if (recentRepeat) {
    reasons.push({
      code: "AGENDA_RECENT_REPEAT",
      severity: "medium",
      value: stats.publicationsLast7Days,
    });
  }
  return { stats, reasons, recentRepeat, overused };
}

export function evaluateChannelFrequency(stats: GovernanceChannelStats): ChannelFrequencyEvaluation {
  const dailyLimitExceeded = stats.dailyCount >= stats.dailyMax;
  const reasons: GovernanceReason[] = dailyLimitExceeded
    ? [{ code: "CHANNEL_DAILY_LIMIT", severity: "high", value: stats.dailyCount }]
    : [];
  return { stats, reasons, dailyLimitExceeded };
}

export function emptyAgendaStats(): GovernanceAgendaStats {
  return {
    agendaId: null,
    agendaKey: null,
    usageCount: null,
    lastUsedAt: null,
    publicationsLast7Days: 0,
    publicationsLast30Days: 0,
  };
}
