import { createHash, randomUUID } from "node:crypto";

import { DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE } from "@/lib/marketing/content/createSelectedAgenda";
import {
  DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
  normalizeSourceArticleIdentity,
  subtractKstBusinessDays,
} from "@/lib/marketing/cron/daily/researchIdentityCooldown";
import { resolveAgendaSlateTargetSize } from "@/lib/marketing/cron/daily/agendaSlate/config";
import type { ManagerSlateCurationItem } from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import type {
  AgendaSlateCandidate,
  AgendaSlateEditorialDimensions,
  AgendaSlateEvidenceSummary,
  DailyAgendaSlate,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  AGENDA_SLATE_CANDIDATE_CONTRACT,
  DAILY_AGENDA_SLATE_CONTRACT,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import { DAILY_MARKETING_ROUTINE_ID } from "@/lib/marketing/cron/daily/types";

function stableSlateItemId(input: {
  businessDateKst: string;
  agendaCandidateId: string | null;
  researchBriefId: string | null;
  title: string;
  carryoverKey?: string | null;
}): string {
  const seed = [
    input.businessDateKst,
    input.carryoverKey ?? "",
    input.agendaCandidateId ?? "",
    input.researchBriefId ?? "",
    input.title.trim().toLowerCase(),
  ].join("|");
  return `asc_${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

function emptyEditorial(): AgendaSlateEditorialDimensions {
  return {
    freshnessWhyNow: null,
    koreanTravelerRelevance: null,
    practicalTravelValue: null,
    theAllTourBusinessRelevance: null,
    contentPotential: null,
  };
}

function mapEvidenceSummary(
  candidate: CompactManagerAgendaCandidate,
): AgendaSlateEvidenceSummary[] {
  return (candidate.evidence ?? []).slice(0, 6).map((ref) => ({
    evidenceId: ref.evidenceId,
    sourceId: ref.sourceId,
    sourceName: ref.sourceName,
    sourceType: ref.sourceType,
    isOfficial: ref.isOfficial,
    url: ref.url,
    excerpt: ref.excerpt,
  }));
}

export function canonicalArticleIdsForCandidate(
  candidate: CompactManagerAgendaCandidate,
): string[] {
  const ids = new Set<string>();
  for (const ref of candidate.evidence ?? []) {
    const key = normalizeSourceArticleIdentity(ref);
    if (key) ids.add(key);
  }
  return [...ids];
}

function identityKeysForSlateItem(item: {
  agendaCandidateId: string | null;
  researchBriefId: string | null;
  canonicalArticleIds: string[];
}): string[] {
  const keys: string[] = [];
  if (item.agendaCandidateId) keys.push(`ac:${item.agendaCandidateId}`);
  if (item.researchBriefId) keys.push(`rb:${item.researchBriefId}`);
  for (const articleId of item.canonicalArticleIds) {
    keys.push(`art:${articleId}`);
  }
  return keys;
}

function findResearchMatch(
  research: MarketingResearchContext,
  item: {
    agendaCandidateId: string | null;
    researchBriefId: string | null;
    title: string;
  },
): CompactManagerAgendaCandidate | null {
  return (
    research.agendaCandidates.find(
      (c) => item.agendaCandidateId && c.agendaCandidateId === item.agendaCandidateId,
    ) ??
    research.agendaCandidates.find(
      (c) => item.researchBriefId && c.researchBriefId === item.researchBriefId,
    ) ??
    research.agendaCandidates.find(
      (c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase(),
    ) ??
    null
  );
}

export function mapResearchCandidateToSlateItem(
  candidate: CompactManagerAgendaCandidate,
  input: {
    businessDateKst: string;
    channel?: string | null;
    origin?: AgendaSlateCandidate["origin"];
    deferredFromBusinessDateKst?: string | null;
    deferredFromSlateItemId?: string | null;
    state?: AgendaSlateCandidate["state"];
    editorial?: Partial<AgendaSlateEditorialDimensions>;
    rationale?: string[];
    recommendedFormats?: string[];
    recommendedChannel?: string | null;
    summary?: string;
  },
): AgendaSlateCandidate {
  const origin = input.origin ?? "organic_research";
  const editorial = { ...emptyEditorial(), ...(input.editorial ?? {}) };
  if (!editorial.freshnessWhyNow && candidate.freshnessScore != null) {
    editorial.freshnessWhyNow =
      candidate.freshnessScore >= 0.7
        ? "최근 관측된 신선도 신호가 높음"
        : "관측 기반 신선도 참고";
  }
  return {
    contract: AGENDA_SLATE_CANDIDATE_CONTRACT,
    slateItemId: stableSlateItemId({
      businessDateKst: input.businessDateKst,
      agendaCandidateId: candidate.agendaCandidateId,
      researchBriefId: candidate.researchBriefId,
      title: candidate.title,
      carryoverKey:
        origin === "deferred_carryover"
          ? `${input.deferredFromBusinessDateKst ?? ""}:${input.deferredFromSlateItemId ?? ""}`
          : null,
    }),
    state: input.state ?? "AVAILABLE",
    origin,
    deferredFromBusinessDateKst: input.deferredFromBusinessDateKst ?? null,
    deferredFromSlateItemId: input.deferredFromSlateItemId ?? null,
    agendaCandidateId: candidate.agendaCandidateId,
    researchBriefId: candidate.researchBriefId,
    canonicalArticleIds: canonicalArticleIdsForCandidate(candidate),
    title: candidate.title.trim(),
    summary: (input.summary ?? candidate.summary).trim(),
    score: candidate.totalResearchScore ?? null,
    scoreReasons: (candidate.scoreReasons ?? []).slice(0, 8),
    destinations: (candidate.destinations ?? []).slice(0, 8),
    topics: (candidate.topics ?? []).slice(0, 8),
    entities: (candidate.entities ?? []).slice(0, 12),
    audienceHint: DEFAULT_INFORMATIONAL_TRAVEL_AUDIENCE,
    rationale: (input.rationale ?? candidate.scoreReasons ?? []).slice(0, 6),
    recommendedFormats: (input.recommendedFormats ?? ["threads_text"]).slice(0, 4),
    recommendedChannel: input.recommendedChannel?.trim() || input.channel?.trim() || "threads",
    evidenceSummary: mapEvidenceSummary(candidate),
    matchedProductIds: (candidate.matchedProductIds ?? []).slice(0, 8),
    riskFlags: (candidate.riskFlags ?? []).slice(0, 8),
    editorial,
    researchSnapshot: {
      freshnessScore: candidate.freshnessScore ?? null,
      credibilityScore: candidate.credibilityScore ?? null,
      travelRelevanceScore: candidate.travelRelevanceScore ?? null,
      totalResearchScore: candidate.totalResearchScore ?? null,
    },
  };
}

function pinDeferredCarryover(
  deferredCarryover: AgendaSlateCandidate[],
  input: { businessDateKst: string; targetSize: number },
): AgendaSlateCandidate[] {
  return deferredCarryover
    .filter((item) => item.state === "DEFERRED" || item.origin === "deferred_carryover")
    .map((item) => ({
      ...item,
      state: "AVAILABLE" as const,
      origin: "deferred_carryover" as const,
      deferredFromBusinessDateKst: item.deferredFromBusinessDateKst,
      deferredFromSlateItemId: item.deferredFromSlateItemId ?? item.slateItemId,
      slateItemId: stableSlateItemId({
        businessDateKst: input.businessDateKst,
        agendaCandidateId: item.agendaCandidateId,
        researchBriefId: item.researchBriefId,
        title: item.title,
        carryoverKey: `${item.deferredFromBusinessDateKst ?? "unknown"}:${item.slateItemId}`,
      }),
    }))
    .slice(0, input.targetSize);
}

function finalizeSlate(input: {
  logicalRunKey: string;
  businessDateKst: string;
  runId: string;
  correlationId: string;
  targetSize: number;
  research: MarketingResearchContext;
  candidates: AgendaSlateCandidate[];
  cooldown?: DailyAgendaSlate["cooldown"];
  curation: DailyAgendaSlate["curation"];
  now: Date;
  metadata?: Record<string, unknown>;
}): DailyAgendaSlate {
  const iso = input.now.toISOString();
  const candidates = input.candidates.slice(0, input.targetSize);
  return {
    contract: DAILY_AGENDA_SLATE_CONTRACT,
    slateId: `das_${createHash("sha256").update(input.logicalRunKey).digest("hex").slice(0, 24)}`,
    logicalRunKey: input.logicalRunKey,
    businessDateKst: input.businessDateKst,
    routineId: DAILY_MARKETING_ROUTINE_ID,
    runId: input.runId,
    correlationId: input.correlationId,
    createdAt: iso,
    updatedAt: iso,
    status: candidates.length > 0 ? "ready_for_human_selection" : "empty_deferred",
    targetSize: input.targetSize,
    researchStatus: input.research.status,
    degraded: input.research.status === "degraded",
    candidates,
    cooldown: input.cooldown ?? {
      days: DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
      excludedAgendaCandidateIds: [],
      excludedBriefIds: [],
    },
    curation: input.curation,
    observability: {
      organicCount: candidates.filter((c) => c.origin === "organic_research").length,
      deferredCarryoverCount: candidates.filter((c) => c.origin === "deferred_carryover").length,
      availableCount: candidates.filter((c) => c.state === "AVAILABLE").length,
      selectedTodayCount: candidates.filter((c) => c.state === "SELECTED_TODAY").length,
    },
    metadata: {
      builtAt: iso,
      researchCandidatePoolSize: input.research.agendaCandidates.length,
      ...(input.metadata ?? {}),
    },
  };
}

/**
 * Prefer deferred carry-over pins, then fill with highest-scoring organic research.
 * Research context must already have Validation Hardening cooldown applied.
 * Deferred pins are NOT subject to organic exact-item cooldown (human override).
 */
export function buildDailyAgendaSlate(input: {
  research: MarketingResearchContext;
  logicalRunKey: string;
  businessDateKst: string;
  runId: string;
  correlationId: string;
  channel?: string | null;
  targetSize?: number;
  deferredCarryover?: AgendaSlateCandidate[];
  cooldown?: DailyAgendaSlate["cooldown"];
  curation?: DailyAgendaSlate["curation"];
  now?: Date;
}): DailyAgendaSlate {
  const now = input.now ?? new Date();
  const targetSize = resolveAgendaSlateTargetSize(input.targetSize);
  const channel = input.channel ?? "threads";

  const carryover = pinDeferredCarryover(input.deferredCarryover ?? [], {
    businessDateKst: input.businessDateKst,
    targetSize,
  });

  const carryoverIdentityKeys = new Set<string>();
  for (const item of carryover) {
    for (const key of identityKeysForSlateItem(item)) {
      carryoverIdentityKeys.add(key);
    }
  }

  const organicSorted = [...input.research.agendaCandidates].sort(
    (a, b) => (b.totalResearchScore ?? 0) - (a.totalResearchScore ?? 0),
  );

  const organic: AgendaSlateCandidate[] = [];
  for (const candidate of organicSorted) {
    if (organic.length + carryover.length >= targetSize) break;
    const ac = candidate.agendaCandidateId ? `ac:${candidate.agendaCandidateId}` : null;
    const rb = candidate.researchBriefId ? `rb:${candidate.researchBriefId}` : null;
    if (ac && carryoverIdentityKeys.has(ac)) continue;
    if (rb && carryoverIdentityKeys.has(rb)) continue;
    const articleIds = canonicalArticleIdsForCandidate(candidate);
    if (articleIds.some((id) => carryoverIdentityKeys.has(`art:${id}`))) continue;

    organic.push(
      mapResearchCandidateToSlateItem(candidate, {
        businessDateKst: input.businessDateKst,
        channel,
        origin: "organic_research",
        rationale: [
          "결정론적 폴백: 연구 점수·신선도 기반 후보",
          ...(candidate.scoreReasons ?? []).slice(0, 3),
        ],
        editorial: {
          koreanTravelerRelevance: "한국 해외여행 관심 독자 기준 후보",
          practicalTravelValue: candidate.travelRelevanceScore != null ? "여행 실무 관련성 점수 참고" : null,
          theAllTourBusinessRelevance:
            (candidate.matchedProductIds?.length ?? 0) > 0
              ? "상품 연계 신호 있음"
              : "정보성 주제(상품 무관 가능)",
          contentPotential: "Threads 등 단기 포맷 적합 후보",
        },
      }),
    );
  }

  return finalizeSlate({
    logicalRunKey: input.logicalRunKey,
    businessDateKst: input.businessDateKst,
    runId: input.runId,
    correlationId: input.correlationId,
    targetSize,
    research: input.research,
    candidates: [...carryover, ...organic],
    cooldown: input.cooldown,
    curation: input.curation ?? {
      mode: "deterministic_fallback",
      managerMessage: "manager_curation_unavailable_or_skipped",
    },
    now,
    metadata: {
      fallback: (input.curation?.mode ?? "deterministic_fallback") === "deterministic_fallback",
    },
  });
}

/** Build slate from one MM multi-candidate curation pass + deferred pins. */
export function buildDailyAgendaSlateFromManagerCuration(input: {
  research: MarketingResearchContext;
  curatedItems: ManagerSlateCurationItem[];
  managerMessage?: string | null;
  logicalRunKey: string;
  businessDateKst: string;
  runId: string;
  correlationId: string;
  channel?: string | null;
  targetSize?: number;
  deferredCarryover?: AgendaSlateCandidate[];
  cooldown?: DailyAgendaSlate["cooldown"];
  now?: Date;
}): DailyAgendaSlate {
  const now = input.now ?? new Date();
  const targetSize = resolveAgendaSlateTargetSize(input.targetSize);
  const channel = input.channel ?? "threads";

  const carryover = pinDeferredCarryover(input.deferredCarryover ?? [], {
    businessDateKst: input.businessDateKst,
    targetSize,
  });

  const carryoverIdentityKeys = new Set<string>();
  for (const item of carryover) {
    for (const key of identityKeysForSlateItem(item)) {
      carryoverIdentityKeys.add(key);
    }
  }

  const curated: AgendaSlateCandidate[] = [];
  for (const item of input.curatedItems) {
    if (curated.length + carryover.length >= targetSize) break;
    const match = findResearchMatch(input.research, item);
    if (!match) continue;
    const articleIds = canonicalArticleIdsForCandidate(match);
    const keys = identityKeysForSlateItem({
      agendaCandidateId: match.agendaCandidateId,
      researchBriefId: match.researchBriefId,
      canonicalArticleIds: articleIds,
    });
    if (keys.some((k) => carryoverIdentityKeys.has(k))) continue;

    curated.push(
      mapResearchCandidateToSlateItem(match, {
        businessDateKst: input.businessDateKst,
        channel,
        origin: "organic_research",
        summary: item.summary,
        rationale: item.rationale.length > 0 ? item.rationale : ["Marketing Manager 추천"],
        recommendedFormats: item.recommendedFormats.length
          ? item.recommendedFormats
          : ["threads_text"],
        recommendedChannel: item.recommendedChannel ?? channel,
        editorial: {
          freshnessWhyNow: item.freshnessWhyNow,
          koreanTravelerRelevance: item.koreanTravelerRelevance,
          practicalTravelValue: item.practicalTravelValue,
          theAllTourBusinessRelevance: item.theAllTourBusinessRelevance,
          contentPotential: item.contentPotential,
        },
      }),
    );
  }

  // If MM returned too few after identity filtering, top up deterministically.
  if (curated.length + carryover.length < Math.min(5, targetSize)) {
    const filler = buildDailyAgendaSlate({
      ...input,
      deferredCarryover: [],
      curation: {
        mode: "deterministic_fallback",
        managerMessage: "manager_curation_undersized_topup",
      },
      now,
    });
    for (const item of filler.candidates) {
      if (curated.length + carryover.length >= targetSize) break;
      const keys = identityKeysForSlateItem(item);
      if (keys.some((k) => carryoverIdentityKeys.has(k))) continue;
      if (
        curated.some((c) =>
          identityKeysForSlateItem(c).some((k) => keys.includes(k)),
        )
      ) {
        continue;
      }
      curated.push(item);
    }
  }

  return finalizeSlate({
    logicalRunKey: input.logicalRunKey,
    businessDateKst: input.businessDateKst,
    runId: input.runId,
    correlationId: input.correlationId,
    targetSize,
    research: input.research,
    candidates: [...carryover, ...curated],
    cooldown: input.cooldown,
    curation: {
      mode: "manager_curated",
      managerMessage: input.managerMessage ?? null,
    },
    now,
    metadata: { fallback: false },
  });
}

/** Mark a slate item DEFERRED (in-memory helper for later human actions / tests). */
export function markAgendaSlateItemDeferred(
  slate: DailyAgendaSlate,
  slateItemId: string,
  now = new Date(),
): DailyAgendaSlate {
  const candidates = slate.candidates.map((item) =>
    item.slateItemId === slateItemId
      ? {
          ...item,
          state: "DEFERRED" as const,
          deferredFromBusinessDateKst: slate.businessDateKst,
          deferredFromSlateItemId: item.slateItemId,
        }
      : item,
  );
  return {
    ...slate,
    candidates,
    updatedAt: now.toISOString(),
    observability: {
      ...slate.observability,
      availableCount: candidates.filter((c) => c.state === "AVAILABLE").length,
      selectedTodayCount: candidates.filter((c) => c.state === "SELECTED_TODAY").length,
    },
  };
}

/**
 * Deferred carry-over is one day only: take DEFERRED items from the immediately
 * previous business-date slate. Older deferred items do not auto-carry further.
 */
export function listDeferredFromPreviousDaySlate(
  previousDaySlate: DailyAgendaSlate | null | undefined,
  expectedPreviousBusinessDateKst: string,
): AgendaSlateCandidate[] {
  if (!previousDaySlate) return [];
  if (previousDaySlate.businessDateKst !== expectedPreviousBusinessDateKst) return [];
  return previousDaySlate.candidates
    .filter((item) => item.state === "DEFERRED")
    .map((item) => ({
      ...item,
      deferredFromBusinessDateKst: item.deferredFromBusinessDateKst ?? previousDaySlate.businessDateKst,
      deferredFromSlateItemId: item.deferredFromSlateItemId ?? item.slateItemId,
    }));
}

/** @deprecated Prefer listDeferredFromPreviousDaySlate for one-day carry semantics. */
export function listDeferredSlateCandidates(slates: DailyAgendaSlate[]): AgendaSlateCandidate[] {
  const out: AgendaSlateCandidate[] = [];
  for (const slate of slates) {
    for (const item of slate.candidates) {
      if (item.state === "DEFERRED") {
        out.push({
          ...item,
          deferredFromBusinessDateKst: item.deferredFromBusinessDateKst ?? slate.businessDateKst,
          deferredFromSlateItemId: item.deferredFromSlateItemId ?? item.slateItemId,
        });
      }
    }
  }
  return out;
}

/** Collect REJECTED exact identities from recent slates for 7-day organic suppression. */
export function collectRejectedResearchIdentities(
  slates: DailyAgendaSlate[],
  businessDateKst: string,
  cooldownDays = DEFAULT_RESEARCH_IDENTITY_COOLDOWN_DAYS,
): {
  agendaCandidateIds: string[];
  researchBriefIds: string[];
  canonicalArticleIds: string[];
} {
  const floor = subtractKstBusinessDays(businessDateKst, cooldownDays);
  const agendaCandidateIds = new Set<string>();
  const researchBriefIds = new Set<string>();
  const canonicalArticleIds = new Set<string>();

  for (const slate of slates) {
    if (slate.businessDateKst < floor || slate.businessDateKst >= businessDateKst) continue;
    for (const item of slate.candidates) {
      if (item.state !== "REJECTED") continue;
      if (item.agendaCandidateId) agendaCandidateIds.add(item.agendaCandidateId);
      if (item.researchBriefId) researchBriefIds.add(item.researchBriefId);
      for (const id of item.canonicalArticleIds) canonicalArticleIds.add(id);
    }
  }

  return {
    agendaCandidateIds: [...agendaCandidateIds],
    researchBriefIds: [...researchBriefIds],
    canonicalArticleIds: [...canonicalArticleIds],
  };
}

export function newCorrelationIdFragment(): string {
  return randomUUID().slice(0, 8);
}
