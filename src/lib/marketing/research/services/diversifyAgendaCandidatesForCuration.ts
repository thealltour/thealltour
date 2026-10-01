/**
 * STEP R-4: Deterministic diversification of the MM curation INPUT pool
 * (and deterministic fallback slate ordering).
 *
 * Relevance remains primary via outbound-aware input order.
 * Soft source/destination caps apply only when credible alternatives exist.
 * No embeddings / vector semantic dedupe.
 */

import { classifyTravelDirection } from "@/lib/marketing/research/services/travelDirection";
import { detectKoreanOutboundDemandBand } from "@/lib/marketing/research/services/koreanOutboundRelevanceScorer";

/** Soft guardrails for first-pass selection (availability-aware, not hard rejects). */
export const CURATION_DIVERSITY_MAX_PER_SOURCE = 2;
export const CURATION_DIVERSITY_MAX_PER_FAMILY = 2;
export const CURATION_DIVERSITY_MIN_FAMILIES_TARGET = 3;
/** Do not promote weak / demoted items merely to satisfy diversity. */
export const CURATION_CREDIBLE_OUTBOUND_FLOOR = 0.4;

export type CurationDiversityDiagnostics = {
  uniqueSourceCount: number;
  uniqueDestinationFamilyCount: number;
  maxCandidatesPerSource: number;
  maxCandidatesPerDestinationFamily: number;
  sourceCounts: Record<string, number>;
  familyCounts: Record<string, number>;
};

export type DiversifyAgendaCandidatesForCurationOptions = {
  limit: number;
  maxPerSource?: number;
  maxPerFamily?: number;
  minFamiliesTarget?: number;
  credibleOutboundFloor?: number;
};

export type CurationDiversityFillStage =
  | "pass1_soft_cap"
  | "pass1b_min_families"
  | "staged_cap_relaxation"
  | "unrestricted_credible_fill"
  | "weak_outbound_fallback";

export type CurationDiversityFillSelection = {
  id: string;
  stage: CurationDiversityFillStage;
  /** Source/family cap in force for staged picks (max of the two); null otherwise. */
  relaxedCap: number | null;
};

export type CurationDiversityFillStats = {
  pass1Picked: number;
  pass1bPicked: number;
  stagedFillPicked: number;
  /** Highest staged cap that admitted at least one pick; null when no staged pick happened. */
  maxRelaxedCapUsed: number | null;
  unrestrictedFillPicked: number;
  weakFallbackPicked: number;
  selections: CurationDiversityFillSelection[];
};

const WEAK_FALLBACK_OUTBOUND_FLOOR = 0.28;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Stable diversification family key from existing destination/topic metadata.
 * Prefer destination country/place; else topic; else a coarse title fallback.
 * Does not hard-code any country.
 *
 * When destinations are article slugs (common in RSS), reuse demand-band place
 * detection so "Vietnam beach" / "Vietnam autumn" share one family.
 */
export function destinationTopicFamilyKey(input: {
  destinations?: string[] | null;
  topics?: string[] | null;
  title?: string | null;
  summary?: string | null;
}): string {
  const demand = detectKoreanOutboundDemandBand({
    title: input.title ?? undefined,
    summary: input.summary ?? undefined,
    destinations: input.destinations ?? undefined,
    topics: input.topics ?? undefined,
  });
  if (demand.matchedId) {
    return `destination:${demand.matchedId}`;
  }

  const destinations = (input.destinations ?? [])
    .map((d) => normalizeToken(String(d).replace(/_/g, " ")))
    .filter((d) => d.length > 1 && !/^\d+$/.test(d) && !/^(ai|mou|travel)$/.test(d));

  // Prefer short place-like tokens; skip long hyphenated article slugs.
  const placeLike = destinations.find((d) => {
    const parts = d.split(/[\s-]+/).filter(Boolean);
    return parts.length <= 3 && d.length <= 40 && !/^(the|after|what|one|top|enjoy|discover|slow|chasing|highland)$/i.test(parts[0] ?? "");
  });

  if (placeLike) {
    const parts = placeLike.split(/[\s-]+/).filter(Boolean);
    const head = parts[0] ?? placeLike;
    const rest = parts.slice(1);
    const collapseToHead =
      rest.length > 0 &&
      head.length >= 3 &&
      /^[a-z\uac00-\ud7a3]+$/i.test(head) &&
      rest.every((p) => /^[a-z\uac00-\ud7a3]+$/i.test(p));
    const family = collapseToHead ? head : placeLike;
    return `destination:${family}`;
  }

  if (destinations[0] && destinations[0].length <= 48) {
    return `destination:${destinations[0]}`;
  }

  const topics = (input.topics ?? [])
    .map((t) => normalizeToken(String(t)))
    .filter((t) => t.length > 1 && t !== "travel");
  if (topics[0]) return `topic:${topics[0]}`;

  const title = normalizeToken(input.title ?? "");
  if (/(visa|entry|passport|safety|advisory|비자|입국|안전|결항|태풍)/.test(title)) {
    return "fallback:planning_safety";
  }
  if (/(season|festival|autumn|spring|winter|summer|가을|봄|여름|겨울|축제|성수기|트렌드)/.test(title)) {
    return "fallback:seasonal_inspiration";
  }
  if (title) {
    // Keep unknowns from collapsing into one bucket when titles differ meaningfully.
    const stub = title.split(" ").slice(0, 3).join(" ").slice(0, 48);
    return `fallback:${stub || "general"}`;
  }
  return "fallback:general";
}

export function curationSourceKey(input: {
  sourceName?: string | null;
  sourceId?: string | null;
}): string {
  const name = normalizeToken(input.sourceName ?? "");
  if (name) return `source:${name}`;
  const id = normalizeToken(input.sourceId ?? "");
  if (id) return `source:${id}`;
  return "source:unknown";
}

export function isCredibleForCurationDiversity(input: {
  koreanOutboundRelevanceScore?: number | null;
  scoreReasons?: string[] | null;
  title?: string | null;
  summary?: string | null;
  destinations?: string[] | null;
  topics?: string[] | null;
  credibleOutboundFloor?: number;
}): boolean {
  const floor = input.credibleOutboundFloor ?? CURATION_CREDIBLE_OUTBOUND_FLOOR;
  const score = input.koreanOutboundRelevanceScore ?? 0;
  if (score < floor) return false;

  const reasons = input.scoreReasons ?? [];
  if (
    reasons.some(
      (r) =>
        r.includes("inbound_demoted") ||
        r.includes("domestic_demoted") ||
        r.includes("industry_b2b_demoted"),
    )
  ) {
    return false;
  }

  const direction = classifyTravelDirection({
    title: input.title ?? undefined,
    summary: input.summary ?? undefined,
    destinations: input.destinations ?? undefined,
    topics: input.topics ?? undefined,
  });
  if (direction === "inbound" || direction === "domestic" || direction === "industry_b2b") {
    return false;
  }
  return true;
}

function countMapMax(counts: Map<string, number>): number {
  let max = 0;
  for (const value of counts.values()) max = Math.max(max, value);
  return max;
}

export function computeCurationPoolDiversityDiagnostics(
  candidates: Array<{
    sourceKey: string;
    familyKey: string;
  }>,
): CurationDiversityDiagnostics {
  const sourceCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  for (const row of candidates) {
    sourceCounts.set(row.sourceKey, (sourceCounts.get(row.sourceKey) ?? 0) + 1);
    familyCounts.set(row.familyKey, (familyCounts.get(row.familyKey) ?? 0) + 1);
  }
  const sourceRecord: Record<string, number> = {};
  const familyRecord: Record<string, number> = {};
  for (const [k, v] of sourceCounts) sourceRecord[k] = v;
  for (const [k, v] of familyCounts) familyRecord[k] = v;
  return {
    uniqueSourceCount: sourceCounts.size,
    uniqueDestinationFamilyCount: familyCounts.size,
    maxCandidatesPerSource: countMapMax(sourceCounts),
    maxCandidatesPerDestinationFamily: countMapMax(familyCounts),
    sourceCounts: sourceRecord,
    familyCounts: familyRecord,
  };
}

export type DiversifiableCurationCandidate = {
  id: string;
  sourceKey: string;
  familyKey: string;
  koreanOutboundRelevanceScore: number;
  title: string;
  summary: string;
  destinations: string[];
  topics: string[];
  scoreReasons: string[];
};

export type DiversifyAgendaCandidatesAccessors<T> = {
  getId: (item: T) => string;
  getSourceKey: (item: T) => string;
  getFamilyKey: (item: T) => string;
  getOutboundScore: (item: T) => number;
  isCredible: (item: T) => boolean;
};

function emptyFillStats(): CurationDiversityFillStats {
  return {
    pass1Picked: 0,
    pass1bPicked: 0,
    stagedFillPicked: 0,
    maxRelaxedCapUsed: null,
    unrestrictedFillPicked: 0,
    weakFallbackPicked: 0,
    selections: [],
  };
}

/**
 * Select up to `limit` candidates from an already outbound-aware ranked list.
 *
 * Soft source/destination caps apply while any under-cap credible alternative
 * remains. When they run out, caps are raised one step at a time (2/2 → 3/3 →
 * 4/4 …) so repetition grows evenly; only then does an unrestricted credible
 * fill run, followed by the weak-outbound fallback.
 * Demoted inbound/domestic/B2B items are never used to invent diversity.
 */
export function diversifyAgendaCandidatesForCuration<T>(
  ranked: T[],
  accessors: DiversifyAgendaCandidatesAccessors<T>,
  options: DiversifyAgendaCandidatesForCurationOptions,
): T[] {
  return diversifyAgendaCandidatesForCurationWithStats(ranked, accessors, options).picked;
}

export function diversifyAgendaCandidatesForCurationWithStats<T>(
  ranked: T[],
  accessors: DiversifyAgendaCandidatesAccessors<T>,
  options: DiversifyAgendaCandidatesForCurationOptions,
): { picked: T[]; stats: CurationDiversityFillStats } {
  const stats = emptyFillStats();
  const limit = Math.max(0, Math.floor(options.limit));
  if (limit === 0 || ranked.length === 0) return { picked: [], stats };

  const maxPerSource = options.maxPerSource ?? CURATION_DIVERSITY_MAX_PER_SOURCE;
  const maxPerFamily = options.maxPerFamily ?? CURATION_DIVERSITY_MAX_PER_FAMILY;

  const picked: T[] = [];
  const pickedIds = new Set<string>();
  const sourceCount = new Map<string, number>();
  const familyCount = new Map<string, number>();

  const tryPick = (
    item: T,
    stage: CurationDiversityFillStage,
    relaxedCap: number | null = null,
  ): boolean => {
    const id = accessors.getId(item);
    if (pickedIds.has(id)) return false;
    const sk = accessors.getSourceKey(item);
    const fk = accessors.getFamilyKey(item);
    picked.push(item);
    pickedIds.add(id);
    sourceCount.set(sk, (sourceCount.get(sk) ?? 0) + 1);
    familyCount.set(fk, (familyCount.get(fk) ?? 0) + 1);
    stats.selections.push({ id, stage, relaxedCap });
    return true;
  };

  const hasUnderCapCredibleAlternative = (): boolean => {
    for (const item of ranked) {
      const id = accessors.getId(item);
      if (pickedIds.has(id)) continue;
      if (!accessors.isCredible(item)) continue;
      const sk = accessors.getSourceKey(item);
      const fk = accessors.getFamilyKey(item);
      if ((sourceCount.get(sk) ?? 0) < maxPerSource && (familyCount.get(fk) ?? 0) < maxPerFamily) {
        return true;
      }
    }
    return false;
  };

  // Pass 1 — soft caps while under-cap credible alternatives remain
  for (const item of ranked) {
    if (picked.length >= limit) break;
    if (!accessors.isCredible(item)) continue;
    const sk = accessors.getSourceKey(item);
    const fk = accessors.getFamilyKey(item);
    const overSource = (sourceCount.get(sk) ?? 0) >= maxPerSource;
    const overFamily = (familyCount.get(fk) ?? 0) >= maxPerFamily;
    if (overSource || overFamily) {
      // Availability-aware: skip monopoly only while a better under-cap option exists.
      if (hasUnderCapCredibleAlternative()) continue;
      // No under-cap alternative left — fall through to relax below.
      break;
    }
    tryPick(item, "pass1_soft_cap");
  }

  const minFamilies = options.minFamiliesTarget ?? CURATION_DIVERSITY_MIN_FAMILIES_TARGET;

  // Pass 1b — explicitly cover additional families/sources still under soft caps
  if (picked.length < limit && familyCount.size < minFamilies) {
    for (const item of ranked) {
      if (picked.length >= limit) break;
      if (!accessors.isCredible(item)) continue;
      const sk = accessors.getSourceKey(item);
      const fk = accessors.getFamilyKey(item);
      if ((sourceCount.get(sk) ?? 0) >= maxPerSource) continue;
      if ((familyCount.get(fk) ?? 0) >= maxPerFamily) continue;
      tryPick(item, "pass1b_min_families");
    }
  }

  // Pass 2 — staged credible fill: raise source/family caps together one step at a time.
  // Within a stage the least-represented source goes first; rank order breaks ties.
  if (picked.length < limit) {
    const credibleRows = ranked
      .map((item) => ({
        item,
        id: accessors.getId(item),
        sourceKey: accessors.getSourceKey(item),
        familyKey: accessors.getFamilyKey(item),
        credible: accessors.isCredible(item),
      }))
      .filter((row) => row.credible);

    const fillStage = (sourceCap: number, familyCap: number): number => {
      let added = 0;
      while (picked.length < limit) {
        let best: (typeof credibleRows)[number] | null = null;
        let bestSourceCount = Number.POSITIVE_INFINITY;
        for (const row of credibleRows) {
          if (pickedIds.has(row.id)) continue;
          const sc = sourceCount.get(row.sourceKey) ?? 0;
          if (sc >= sourceCap) continue;
          if ((familyCount.get(row.familyKey) ?? 0) >= familyCap) continue;
          if (sc < bestSourceCount) {
            best = row;
            bestSourceCount = sc;
          }
        }
        if (!best) break;
        if (tryPick(best.item, "staged_cap_relaxation", Math.max(sourceCap, familyCap))) added += 1;
      }
      return added;
    };

    // A cap >= limit can no longer bind, so the progression ends there at the latest.
    for (let step = 1; picked.length < limit; step += 1) {
      if (!credibleRows.some((row) => !pickedIds.has(row.id))) break;
      const sourceCap = maxPerSource + step;
      const familyCap = maxPerFamily + step;
      if (fillStage(sourceCap, familyCap) > 0) {
        stats.maxRelaxedCapUsed = Math.max(sourceCap, familyCap);
      }
      if (sourceCap >= limit && familyCap >= limit) break;
    }
  }

  // Pass 2b — unrestricted credible fill. The staged progression normally exhausts credible
  // capacity first; this stays as the last credible resort before the weak fallback.
  if (picked.length < limit) {
    for (const item of ranked) {
      if (picked.length >= limit) break;
      if (!accessors.isCredible(item)) continue;
      tryPick(item, "unrestricted_credible_fill");
    }
  }

  // Pass 3 — non-credible capacity only; never demoted inbound/domestic/B2B for diversity.
  // (isCredible already excludes those demotions; remaining non-credible may be weak/unknown.)
  if (picked.length < limit) {
    for (const item of ranked) {
      if (picked.length >= limit) break;
      // Skip hard demotions even for capacity: score floor failures that are intent-demoted
      // are already non-credible; additionally skip very low outbound scores.
      if (accessors.getOutboundScore(item) < WEAK_FALLBACK_OUTBOUND_FLOOR) continue;
      tryPick(item, "weak_outbound_fallback");
    }
  }

  for (const selection of stats.selections) {
    if (selection.stage === "pass1_soft_cap") stats.pass1Picked += 1;
    else if (selection.stage === "pass1b_min_families") stats.pass1bPicked += 1;
    else if (selection.stage === "staged_cap_relaxation") stats.stagedFillPicked += 1;
    else if (selection.stage === "unrestricted_credible_fill") stats.unrestrictedFillPicked += 1;
    else stats.weakFallbackPicked += 1;
  }

  return { picked, stats };
}

type CompactCurationCandidate = {
  agendaCandidateId: string;
  title: string;
  summary: string;
  destinations?: string[] | null;
  topics?: string[] | null;
  koreanOutboundRelevanceScore?: number | null;
  scoreReasons?: string[] | null;
  evidence?: Array<{ sourceName?: string | null; sourceId?: string | null }> | null;
};

/** Convenience accessors for compact MM / fallback candidates. */
export function diversifyCompactCurationCandidates<T extends CompactCurationCandidate>(
  ranked: T[],
  options: DiversifyAgendaCandidatesForCurationOptions,
): T[] {
  return diversifyCompactCurationCandidatesWithStats(ranked, options).picked;
}

export function diversifyCompactCurationCandidatesWithStats<T extends CompactCurationCandidate>(
  ranked: T[],
  options: DiversifyAgendaCandidatesForCurationOptions,
): { picked: T[]; stats: CurationDiversityFillStats } {
  const floor = options.credibleOutboundFloor ?? CURATION_CREDIBLE_OUTBOUND_FLOOR;
  return diversifyAgendaCandidatesForCurationWithStats(
    ranked,
    {
      getId: (item) => item.agendaCandidateId,
      getSourceKey: (item) =>
        curationSourceKey({
          sourceName: item.evidence?.[0]?.sourceName,
          sourceId: item.evidence?.[0]?.sourceId,
        }),
      getFamilyKey: (item) =>
        destinationTopicFamilyKey({
          destinations: item.destinations,
          topics: item.topics,
          title: item.title,
          summary: item.summary,
        }),
      getOutboundScore: (item) => item.koreanOutboundRelevanceScore ?? 0,
      isCredible: (item) =>
        isCredibleForCurationDiversity({
          koreanOutboundRelevanceScore: item.koreanOutboundRelevanceScore,
          scoreReasons: item.scoreReasons,
          title: item.title,
          summary: item.summary,
          destinations: item.destinations,
          topics: item.topics,
          credibleOutboundFloor: floor,
        }),
    },
    options,
  );
}

export function diversityDiagnosticsForCompactCandidates<
  T extends {
    title: string;
    destinations?: string[] | null;
    topics?: string[] | null;
    evidence?: Array<{ sourceName?: string | null; sourceId?: string | null }> | null;
  },
>(candidates: T[]): CurationDiversityDiagnostics {
  return computeCurationPoolDiversityDiagnostics(
    candidates.map((item) => ({
      sourceKey: curationSourceKey({
        sourceName: item.evidence?.[0]?.sourceName,
        sourceId: item.evidence?.[0]?.sourceId,
      }),
      familyKey: destinationTopicFamilyKey({
        destinations: item.destinations,
        topics: item.topics,
        title: item.title,
        summary: (item as { summary?: string }).summary,
      }),
    })),
  );
}
