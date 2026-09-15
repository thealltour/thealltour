/**
 * Build ChatGPT-pasteable export from a full DailyAgendaSlate (all items).
 */

import type { DailyAgendaSlate, AgendaSlateCandidate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT,
} from "@/lib/marketing/editorialDirector/contracts";
import {
  AGENDA_SLATE_PAYLOAD_END,
  AGENDA_SLATE_PAYLOAD_START,
  EDITORIAL_DIRECTOR_INSTRUCTION_KO,
} from "@/lib/marketing/editorialDirector/editorialPrompt";

function exportAgendaItem(item: AgendaSlateCandidate) {
  const evidence = item.evidenceSummary.map((e) => ({
    evidenceId: e.evidenceId,
    sourceId: e.sourceId,
    sourceName: e.sourceName,
    sourceType: e.sourceType,
    isOfficial: e.isOfficial,
    url: e.url,
    excerpt: e.excerpt,
  }));

  return {
    agendaId: item.slateItemId,
    slateItemId: item.slateItemId,
    agendaCandidateId: item.agendaCandidateId,
    researchBriefId: item.researchBriefId,
    state: item.state,
    origin: item.origin,
    titleKo: item.title,
    summaryKo: item.summary,
    topicIdentity: {
      destinations: item.destinations,
      topics: item.topics,
      entities: item.entities,
      audienceHint: item.audienceHint,
    },
    originDestination: {
      destinations: item.destinations,
      deferredFromBusinessDateKst: item.deferredFromBusinessDateKst,
    },
    productType: null as string | null,
    travelMode: null as string | null,
    commercialSubject: null as string | null,
    commercialIntent: null as string | null,
    sourceSignals: evidence,
    sourceType: evidence[0]?.sourceType ?? null,
    sourceFreshness: {
      freshnessWhyNow: item.editorial.freshnessWhyNow,
      freshnessScore: item.researchSnapshot.freshnessScore,
    },
    researchability: item.researchSnapshot.credibilityScore,
    currentResearchScore: item.score,
    researchSnapshot: item.researchSnapshot,
    scoreReasons: item.scoreReasons,
    koreanTravelerRelevance: item.editorial.koreanTravelerRelevance,
    businessTheAllTourRelevance: item.editorial.theAllTourBusinessRelevance,
    practicalTravelValue: item.editorial.practicalTravelValue,
    contentPotential: item.editorial.contentPotential,
    recentContentOverlap: null as string | null,
    trendMetaSignal: null as string | null,
    existingEvidenceSnippets: evidence
      .map((e) => e.excerpt)
      .filter((x): x is string => Boolean(x)),
    mmRationale: item.rationale,
    recommendedChannel: item.recommendedChannel,
    recommendedFormats: item.recommendedFormats,
    channelPotential: null as Record<string, unknown> | null,
    matchedProductIds: item.matchedProductIds,
    riskFlags: item.riskFlags,
    canonicalArticleIds: item.canonicalArticleIds,
  };
}

export type AgendaSlateEditorialExportPayload = {
  contract: typeof AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT;
  businessDateKst: string;
  slateId: string;
  exportedAt: string;
  agendaCount: number;
  agendas: ReturnType<typeof exportAgendaItem>[];
  notesKo: string[];
};

export function buildAgendaSlateEditorialExportPayload(
  slate: DailyAgendaSlate,
  now: Date = new Date(),
): AgendaSlateEditorialExportPayload {
  const agendas = slate.candidates.map(exportAgendaItem);
  return {
    contract: AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT,
    businessDateKst: slate.businessDateKst,
    slateId: slate.slateId,
    exportedAt: now.toISOString(),
    agendaCount: agendas.length,
    agendas,
    notesKo: [
      "모든 오늘 Slate 후보가 포함되어 있습니다. 사전 선택이 필요하지 않습니다.",
      "값이 없으면 null입니다. 임의로 점수를 채우지 마세요.",
      "agendaId는 가져오기 시 식별자로 사용됩니다(slateItemId).",
    ],
  };
}

export function buildEditorialDirectorClipboardText(
  slate: DailyAgendaSlate,
  now: Date = new Date(),
): { text: string; agendaCount: number; payload: AgendaSlateEditorialExportPayload } {
  const payload = buildAgendaSlateEditorialExportPayload(slate, now);
  const text = [
    EDITORIAL_DIRECTOR_INSTRUCTION_KO.trim(),
    "",
    AGENDA_SLATE_PAYLOAD_START,
    "",
    JSON.stringify(payload, null, 2),
    "",
    AGENDA_SLATE_PAYLOAD_END,
    "",
  ].join("\n");
  return { text, agendaCount: payload.agendaCount, payload };
}
