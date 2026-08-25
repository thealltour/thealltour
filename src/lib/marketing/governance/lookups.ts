import "server-only";

import { asString } from "@/lib/marketing/context/json";
import { mapAiAgendaRow } from "@/lib/marketing/context/mappers/agendaHistoryMapper";
import { mapAiPublicationRow, isPublishedPublication } from "@/lib/marketing/context/mappers/publicationContextMapper";
import { fetchAiAgendaRowsByIds, fetchAiAgendaRowsByKeys } from "@/lib/marketing/context/sources/agendaSource";
import { fetchAiPublicationRows } from "@/lib/marketing/context/sources/analyticsSource";
import {
  fetchAiContentRowByContentHash,
  fetchAiContentRowByNormalizedHash,
  fetchAiContentRows,
} from "@/lib/marketing/context/sources/legacyContentSource";
import type { PublicationContext } from "@/lib/marketing/context/types";
import {
  GOVERNANCE_SEMANTIC_REVIEW_MATCH,
  GOVERNANCE_SEMANTIC_TOP_K,
  channelGovernancePolicy,
} from "@/lib/marketing/governance/constants";
import type {
  GovernanceAgendaStats,
  GovernanceChannelStats,
  GovernanceMatchedMemory,
  ParsedGovernanceCandidate,
} from "@/lib/marketing/governance/types";
import { CONTENT_MEMORY_TYPE } from "@/lib/marketing/memory/constants";
import { semanticRetrieve } from "@/lib/marketing/semantic/semanticRetrieve";
import type { SemanticRetrieveDeps } from "@/lib/marketing/semantic/semanticRetrieve";
import type { SemanticMemoryMatch, SemanticRetrievalResult } from "@/lib/marketing/semantic/types";

const LOOKUP_LIMIT = 200;

export type GovernanceLookups = {
  findByContentHash: (hash: string) => Promise<string | null>;
  findByNormalizedHash: (hash: string) => Promise<string | null>;
  retrieveSimilar: (
    query: string,
    deps?: SemanticRetrieveDeps,
  ) => Promise<SemanticRetrievalResult>;
  loadAgendaStats: (candidate: ParsedGovernanceCandidate, now: Date) => Promise<GovernanceAgendaStats>;
  loadChannelStats: (candidate: ParsedGovernanceCandidate, now: Date) => Promise<GovernanceChannelStats>;
  loadMatchedMemories: (
    matches: SemanticMemoryMatch[],
    candidate: ParsedGovernanceCandidate,
    now: Date,
  ) => Promise<GovernanceMatchedMemory[]>;
};

function shiftDays(now: Date, days: number): string {
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function publicationTime(pub: PublicationContext): string | null {
  return pub.publishedAt ?? pub.scheduledAt;
}

function isCountablePublication(pub: PublicationContext): boolean {
  const status = pub.status.trim().toLowerCase();
  if (status === "deleted" || status === "failed" || status === "error") return false;
  return isPublishedPublication(pub) || Boolean(pub.scheduledAt) || status === "scheduled";
}

function inWindow(value: string | null, start: string, end: string): boolean {
  return Boolean(value && value >= start && value <= end);
}

function countInWindow(pubs: PublicationContext[], start: string, end: string, channel?: string): number {
  return pubs.filter((pub) => {
    if (!isCountablePublication(pub)) return false;
    if (channel && pub.channel.toLowerCase() !== channel) return false;
    return inWindow(publicationTime(pub), start, end);
  }).length;
}

async function loadPublications(contentIds: string[], start: string, end: string): Promise<PublicationContext[]> {
  if (contentIds.length === 0) return [];
  const rows = await fetchAiPublicationRows({
    contentIds,
    periodStart: start,
    periodEnd: end,
    limit: LOOKUP_LIMIT,
  });
  return rows.map(mapAiPublicationRow).filter((item): item is PublicationContext => item != null);
}

export function createGovernanceLookups(): GovernanceLookups {
  return {
    async findByContentHash(hash) {
      const row = await fetchAiContentRowByContentHash(hash);
      return asString(row?.id);
    },
    async findByNormalizedHash(hash) {
      const row = await fetchAiContentRowByNormalizedHash(hash);
      return asString(row?.id);
    },
    async retrieveSimilar(query, deps) {
      return semanticRetrieve(
        {
          query,
          limit: GOVERNANCE_SEMANTIC_TOP_K,
          minScore: GOVERNANCE_SEMANTIC_REVIEW_MATCH,
          memoryTypes: [CONTENT_MEMORY_TYPE],
        },
        deps,
      );
    },
    async loadAgendaStats(candidate, now) {
      const empty: GovernanceAgendaStats = {
        agendaId: candidate.agendaId,
        agendaKey: candidate.agendaKey,
        usageCount: null,
        lastUsedAt: null,
        publicationsLast7Days: 0,
        publicationsLast30Days: 0,
      };
      if (!candidate.agendaId && !candidate.agendaKey) return empty;
      const rows = candidate.agendaId
        ? await fetchAiAgendaRowsByIds([candidate.agendaId])
        : await fetchAiAgendaRowsByKeys([candidate.agendaKey ?? ""]);
      const agenda = rows.map(mapAiAgendaRow).find((item) => item != null) ?? null;
      const agendaId = agenda?.id ?? candidate.agendaId;
      if (!agendaId) {
        return { ...empty, usageCount: agenda?.usageCount ?? null };
      }
      const contents = await fetchAiContentRows({ agendaId, limit: LOOKUP_LIMIT });
      const contentIds = contents
        .map((row) => asString(row.id))
        .filter((id): id is string => Boolean(id));
      const pubs = await loadPublications(contentIds, shiftDays(now, -30), now.toISOString());
      return {
        agendaId,
        agendaKey: agenda?.agendaKey ?? candidate.agendaKey,
        usageCount: agenda?.usageCount ?? null,
        lastUsedAt: agenda?.lastUsedAt ?? null,
        publicationsLast7Days: countInWindow(pubs, shiftDays(now, -7), now.toISOString()),
        publicationsLast30Days: countInWindow(pubs, shiftDays(now, -30), now.toISOString()),
      };
    },
    async loadChannelStats(candidate, now) {
      const policy = channelGovernancePolicy(candidate.channel);
      const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const rows = await fetchAiPublicationRows({
        channel: candidate.channel,
        periodStart: start,
        periodEnd: now.toISOString(),
        limit: LOOKUP_LIMIT,
      });
      const pubs = rows.map(mapAiPublicationRow).filter((item): item is PublicationContext => item != null);
      const dailyCount = pubs.filter(isCountablePublication).length;
      let sameAgendaRecentCount = 0;
      if (candidate.agendaId && policy.sameAgendaCooldownDays > 0) {
        const contents = await fetchAiContentRows({ agendaId: candidate.agendaId, limit: LOOKUP_LIMIT });
        const contentIds = contents
          .map((row) => asString(row.id))
          .filter((id): id is string => Boolean(id));
        const agendaPubs = await loadPublications(
          contentIds,
          shiftDays(now, -policy.sameAgendaCooldownDays),
          now.toISOString(),
        );
        sameAgendaRecentCount = countInWindow(
          agendaPubs,
          shiftDays(now, -policy.sameAgendaCooldownDays),
          now.toISOString(),
          candidate.channel,
        );
      }
      const stats: GovernanceChannelStats = {
        channel: candidate.channel,
        dailyCount,
        dailyMax: policy.dailyMax,
        cooldownDays: policy.sameAgendaCooldownDays,
        sameAgendaRecentCount,
      };
      return stats;
    },
    async loadMatchedMemories(matches, candidate, now) {
      const contentIds = [
        ...new Set(
          matches
            .map((match) => match.memory.sourceId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (candidate.sourceContentId) contentIds.push(candidate.sourceContentId);
      const uniqueIds = [...new Set(contentIds)];
      const [contents, pubs] = await Promise.all([
        fetchAiContentRows({ ids: uniqueIds, limit: LOOKUP_LIMIT }),
        loadPublications(uniqueIds, shiftDays(now, -30), now.toISOString()),
      ]);
      const agendaByContent = new Map(
        contents.flatMap((row) => {
          const id = asString(row.id);
          return id ? [[id, asString(row.agenda_id)] as const] : [];
        }),
      );
      const recentStart = shiftDays(now, -7);
      const channelsByContent = new Map<string, string[]>();
      for (const pub of pubs) {
        if (!isCountablePublication(pub)) continue;
        if (!inWindow(publicationTime(pub), recentStart, now.toISOString())) continue;
        const list = channelsByContent.get(pub.contentId) ?? [];
        if (!list.includes(pub.channel.toLowerCase())) list.push(pub.channel.toLowerCase());
        channelsByContent.set(pub.contentId, list);
      }
      return matches.map((match) => {
        const contentId = match.memory.sourceId;
        return {
          memoryId: match.memoryId,
          contentId,
          score: match.score,
          title: match.memory.title,
          channels: contentId ? channelsByContent.get(contentId) ?? [] : [],
          agendaId: contentId ? agendaByContent.get(contentId) ?? null : null,
        };
      });
    },
  };
}
