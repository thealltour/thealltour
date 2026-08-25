import "server-only";

import { channelGovernancePolicy } from "@/lib/marketing/governance/constants";
import { combineGovernanceSignals } from "@/lib/marketing/governance/combineGovernanceSignals";
import {
  emptyAgendaStats,
  evaluateAgendaFrequency,
  evaluateChannelFrequency,
  evaluateExactDuplicate,
  evaluateNormalizedDuplicate,
  evaluateSemanticSimilarity,
} from "@/lib/marketing/governance/evaluators";
import type { GovernanceLookups } from "@/lib/marketing/governance/lookups";
import { parseGovernanceCandidate } from "@/lib/marketing/governance/parseCandidate";
import type { GovernanceCandidate, GovernanceResult } from "@/lib/marketing/governance/types";
import type { SemanticRetrieveDeps } from "@/lib/marketing/semantic/semanticRetrieve";

export type EvaluateContentGovernanceDeps = {
  now?: Date;
  lookups?: GovernanceLookups;
  semantic?: SemanticRetrieveDeps;
};

export async function evaluateContentGovernance(
  candidate: GovernanceCandidate,
  deps: EvaluateContentGovernanceDeps = {},
): Promise<GovernanceResult> {
  const now = deps.now ?? new Date();
  const parsed = parseGovernanceCandidate(candidate);
  const lookups =
    deps.lookups ??
    (await import("@/lib/marketing/governance/lookups")).createGovernanceLookups();

  const [exactId, normalizedId, semanticResult, agendaStats, channelBase] = await Promise.all([
    lookups.findByContentHash(parsed.exactHash),
    lookups.findByNormalizedHash(parsed.normalizedHash),
    lookups.retrieveSimilar(parsed.embeddingQuery, deps.semantic),
    lookups.loadAgendaStats(parsed, now),
    lookups.loadChannelStats(parsed, now),
  ]);

  const semanticAvailable = semanticResult.status === "ok";
  const matchedMemories = semanticAvailable
    ? await lookups.loadMatchedMemories(semanticResult.matches, parsed, now)
    : [];

  const policy = channelGovernancePolicy(parsed.channel);
  const channelStats = {
    ...channelBase,
    dailyMax: channelBase.dailyMax ?? policy.dailyMax,
  };

  const exact = evaluateExactDuplicate({
    hash: parsed.exactHash,
    existingId: exactId,
    sourceContentId: parsed.sourceContentId,
  });
  const normalized = evaluateNormalizedDuplicate({
    hash: parsed.normalizedHash,
    existingId: normalizedId,
    sourceContentId: parsed.sourceContentId,
  });
  const semantic = evaluateSemanticSimilarity({
    available: semanticAvailable,
    candidate: parsed,
    matches: matchedMemories,
  });
  const agenda = evaluateAgendaFrequency(agendaStats);
  const channel = evaluateChannelFrequency(channelStats);
  const combined = combineGovernanceSignals({ exact, normalized, semantic, agenda, channel });

  return {
    decision: combined.decision,
    riskScore: combined.riskScore,
    reasons: combined.reasons,
    checkedAt: now.toISOString(),
    semanticAvailable,
    matchedMemories: semantic.matches,
    agendaStats: agenda.stats,
    channelStats: channel.stats,
  };
}

export function emptyGovernanceChannelStats(channel: string) {
  const policy = channelGovernancePolicy(channel);
  return {
    channel,
    dailyCount: 0,
    dailyMax: policy.dailyMax,
    cooldownDays: policy.sameAgendaCooldownDays,
    sameAgendaRecentCount: 0,
  };
}

export { emptyAgendaStats };
