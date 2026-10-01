/**
 * Build ChatGPT-pasteable export from a full DailyAgendaSlate (all items).
 */

import type {
  DailyAgendaSlate,
  AgendaSlateCandidate,
  AgendaSlateEvidenceSummary,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import { normalizeSourceArticleIdentity } from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import {
  AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT,
} from "@/lib/marketing/editorialDirector/contracts";

export type AgendaExportFieldAuthority =
  | "source"
  | "mixed"
  | "heuristic"
  | "scoring"
  | "mm_inference";

/**
 * Provenance of each agenda field for the external Story Miner.
 * Identifiers and always-null placeholders are intentionally omitted.
 */
export const AGENDA_EXPORT_FIELD_AUTHORITY = {
  titleKo: "mixed",
  summaryKo: "mixed",
  topicIdentity: "heuristic",
  originDestination: "heuristic",
  sourceSignals: "source",
  sourceType: "source",
  existingEvidenceSnippets: "source",
  canonicalArticleIds: "source",
  "sourceFreshness.freshnessScore": "scoring",
  "sourceFreshness.freshnessWhyNow": "mm_inference",
  researchability: "scoring",
  currentResearchScore: "scoring",
  researchSnapshot: "scoring",
  scoreReasons: "scoring",
  riskFlags: "scoring",
  matchedProductIds: "heuristic",
  koreanTravelerRelevance: "mm_inference",
  businessTheAllTourRelevance: "mm_inference",
  practicalTravelValue: "mm_inference",
  contentPotential: "mm_inference",
  mmRationale: "mm_inference",
} as const satisfies Record<string, AgendaExportFieldAuthority>;

/** Research evidence accumulates one row per re-collection of the same article; export it once. */
function dedupeEvidenceByArticle(
  rows: readonly AgendaSlateEvidenceSummary[],
): AgendaSlateEvidenceSummary[] {
  const seen = new Set<string>();
  const out: AgendaSlateEvidenceSummary[] = [];
  rows.forEach((row, index) => {
    const key = normalizeSourceArticleIdentity(row) ?? `index:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  });
  return out;
}

function exportAgendaItem(item: AgendaSlateCandidate) {
  const evidence = dedupeEvidenceByArticle(item.evidenceSummary).map((e) => ({
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
    titleKo: item.titleKo ?? item.title,
    summaryKo: item.summaryKo ?? item.summary,
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
    existingEvidenceSnippets: [
      ...new Set(evidence.map((e) => e.excerpt?.trim()).filter((x): x is string => Boolean(x))),
    ],
    mmRationale: item.rationale,
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
  /** "subset" when a human picked specific agendas to hand to ChatGPT. */
  selection: "all" | "subset";
  agendaCount: number;
  agendas: ReturnType<typeof exportAgendaItem>[];
  fieldAuthority: typeof AGENDA_EXPORT_FIELD_AUTHORITY;
  notesKo: string[];
};

export type AgendaSlateExportOptions = {
  /** Export only these slate items (slate order kept). Omit for the full slate. */
  slateItemIds?: readonly string[];
};

export function buildAgendaSlateEditorialExportPayload(
  slate: DailyAgendaSlate,
  now: Date = new Date(),
  options: AgendaSlateExportOptions = {},
): AgendaSlateEditorialExportPayload {
  const wanted = options.slateItemIds ? new Set(options.slateItemIds) : null;
  const items = wanted
    ? slate.candidates.filter((c) => wanted.has(c.slateItemId))
    : slate.candidates;
  const agendas = items.map(exportAgendaItem);
  const subset = wanted !== null && agendas.length < slate.candidates.length;
  return {
    contract: AGENDA_SLATE_EXPORT_PAYLOAD_CONTRACT,
    businessDateKst: slate.businessDateKst,
    slateId: slate.slateId,
    exportedAt: now.toISOString(),
    selection: subset ? "subset" : "all",
    agendaCount: agendas.length,
    agendas,
    fieldAuthority: AGENDA_EXPORT_FIELD_AUTHORITY,
    notesKo: [
      subset
        ? `사람이 고른 Slate 후보 ${agendas.length}건만 포함되어 있습니다. 이 목록 안에서만 고르세요.`
        : "모든 오늘 Slate 후보가 포함되어 있습니다. 사전 선택이 필요하지 않습니다.",
      "값이 없으면 null입니다. 임의로 점수를 채우지 마세요.",
      "agendaId는 가져오기 시 식별자로 사용됩니다(slateItemId).",
      "fieldAuthority가 mm_inference 또는 scoring인 필드는 Story의 사실 근거가 아니라 참고 신호입니다. 사실 판단은 fieldAuthority가 source인 필드(sourceSignals 등)를 우선하세요.",
    ],
  };
}

export function buildEditorialDirectorClipboardText(
  slate: DailyAgendaSlate,
  now: Date = new Date(),
  options: AgendaSlateExportOptions = {},
): { text: string; agendaCount: number; payload: AgendaSlateEditorialExportPayload } {
  const payload = buildAgendaSlateEditorialExportPayload(slate, now, options);
  // Clipboard is slate JSON only — paste Editorial Director instructions separately if needed.
  const text = JSON.stringify(payload, null, 2);
  return { text, agendaCount: payload.agendaCount, payload };
}
