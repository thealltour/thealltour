/**
 * STEP R-5: Post-MM diversity repair for a valid manager-curated slate.
 *
 * Preserves MM selections in order; replaces only excess same-source /
 * same-family picks when credible alternatives exist in the MM input pool.
 * Availability-aware — never shrinks below target; never invents candidates.
 */

import type { ManagerSlateCurationItem } from "@/lib/marketing/cron/daily/agendaSlate/curateManagerAgendaSlate";
import type { CompactManagerAgendaCandidate } from "@/lib/marketing/research/manager/types";
import {
  CURATION_CREDIBLE_OUTBOUND_FLOOR,
  CURATION_DIVERSITY_MAX_PER_FAMILY,
  CURATION_DIVERSITY_MAX_PER_SOURCE,
  curationSourceKey,
  destinationTopicFamilyKey,
  diversityDiagnosticsForCompactCandidates,
  isCredibleForCurationDiversity,
  type CurationDiversityDiagnostics,
} from "@/lib/marketing/research/services/diversifyAgendaCandidatesForCuration";

export type ManagerSelectionOrigin = "manager" | "manager_diversity_repair";

export type DiversityRepairViolation = "source" | "family" | "source_and_family";

export type DiversityRepairSlotReport = {
  slotIndex: number;
  violatedCap: DiversityRepairViolation;
  removed: {
    agendaCandidateId: string;
    title: string;
    sourceKey: string;
    familyKey: string;
  };
  replacement: {
    agendaCandidateId: string;
    title: string;
    sourceKey: string;
    familyKey: string;
    poolRank: number;
  };
  whyEligible: string;
};

export type PostMmDiversityRepairDiagnostics = CurationDiversityDiagnostics & {
  originalManagerSelectionCount: number;
  retainedManagerSelectionCount: number;
  repairedSelectionCount: number;
  repairs: DiversityRepairSlotReport[];
};

export type RepairedManagerSelection = {
  selectionOrigin: ManagerSelectionOrigin;
  /** Present only when origin is manager (genuine MM pick). */
  curatedItem: ManagerSlateCurationItem | null;
  match: CompactManagerAgendaCandidate;
  poolRank: number;
  repair: DiversityRepairSlotReport | null;
};

export type RepairManagerSlateDiversityInput = {
  selected: Array<{
    item: ManagerSlateCurationItem;
    match: CompactManagerAgendaCandidate;
  }>;
  /** Diversified MM input pool (order = outbound-aware diversified rank). */
  mmPool: CompactManagerAgendaCandidate[];
  targetSize: number;
  maxPerSource?: number;
  maxPerFamily?: number;
  credibleOutboundFloor?: number;
};

function sourceKeyOf(c: CompactManagerAgendaCandidate): string {
  return curationSourceKey({
    sourceName: c.evidence?.[0]?.sourceName,
    sourceId: c.evidence?.[0]?.sourceId,
  });
}

function familyKeyOf(c: CompactManagerAgendaCandidate): string {
  return destinationTopicFamilyKey({
    destinations: c.destinations,
    topics: c.topics,
    title: c.title,
    summary: c.summary,
  });
}

function candidateId(c: CompactManagerAgendaCandidate): string {
  return c.agendaCandidateId;
}

function isCredible(
  c: CompactManagerAgendaCandidate,
  floor: number,
): boolean {
  return isCredibleForCurationDiversity({
    koreanOutboundRelevanceScore: c.koreanOutboundRelevanceScore,
    scoreReasons: c.scoreReasons,
    title: c.title,
    summary: c.summary,
    destinations: c.destinations,
    topics: c.topics,
    credibleOutboundFloor: floor,
  });
}

function violationType(overSource: boolean, overFamily: boolean): DiversityRepairViolation {
  if (overSource && overFamily) return "source_and_family";
  if (overSource) return "source";
  return "family";
}

function hasCredibleUnderCapAlternative(
  pool: CompactManagerAgendaCandidate[],
  usedIds: Set<string>,
  sourceCount: Map<string, number>,
  familyCount: Map<string, number>,
  maxPerSource: number,
  maxPerFamily: number,
  floor: number,
): boolean {
  for (const c of pool) {
    const id = candidateId(c);
    if (usedIds.has(id)) continue;
    if (!isCredible(c, floor)) continue;
    const sk = sourceKeyOf(c);
    const fk = familyKeyOf(c);
    if ((sourceCount.get(sk) ?? 0) < maxPerSource && (familyCount.get(fk) ?? 0) < maxPerFamily) {
      return true;
    }
  }
  return false;
}

function pickReplacement(input: {
  pool: CompactManagerAgendaCandidate[];
  poolRankById: Map<string, number>;
  usedIds: Set<string>;
  sourceCount: Map<string, number>;
  familyCount: Map<string, number>;
  maxPerSource: number;
  maxPerFamily: number;
  floor: number;
  violated: DiversityRepairViolation;
}): { candidate: CompactManagerAgendaCandidate; poolRank: number; whyEligible: string } | null {
  const scored: Array<{
    candidate: CompactManagerAgendaCandidate;
    poolRank: number;
    outbound: number;
    fixesSource: boolean;
    fixesFamily: boolean;
    newFamily: boolean;
  }> = [];

  for (const candidate of input.pool) {
    const id = candidateId(candidate);
    if (input.usedIds.has(id)) continue;
    if (!isCredible(candidate, input.floor)) continue;
    const sk = sourceKeyOf(candidate);
    const fk = familyKeyOf(candidate);
    if ((input.sourceCount.get(sk) ?? 0) >= input.maxPerSource) continue;
    if ((input.familyCount.get(fk) ?? 0) >= input.maxPerFamily) continue;

    const poolRank = input.poolRankById.get(id) ?? Number.MAX_SAFE_INTEGER;
    const fixesSource =
      input.violated === "source" || input.violated === "source_and_family"
        ? (input.sourceCount.get(sk) ?? 0) < input.maxPerSource
        : true;
    const fixesFamily =
      input.violated === "family" || input.violated === "source_and_family"
        ? (input.familyCount.get(fk) ?? 0) < input.maxPerFamily
        : true;
    if (!fixesSource || !fixesFamily) continue;

    scored.push({
      candidate,
      poolRank,
      outbound: candidate.koreanOutboundRelevanceScore ?? 0,
      fixesSource,
      fixesFamily,
      newFamily: !input.familyCount.has(fk),
    });
  }

  if (scored.length === 0) return null;

  scored.sort(
    (a, b) =>
      b.outbound - a.outbound ||
      Number(b.newFamily) - Number(a.newFamily) ||
      a.poolRank - b.poolRank ||
      a.candidate.agendaCandidateId.localeCompare(b.candidate.agendaCandidateId),
  );

  const best = scored[0]!;
  const why = [
    `credible_outbound=${best.outbound.toFixed(3)}`,
    `under_cap_source_and_family`,
    best.newFamily ? "adds_new_family" : "reuses_under_cap_family",
    `pool_rank=${best.poolRank}`,
  ].join(";");

  return { candidate: best.candidate, poolRank: best.poolRank, whyEligible: why };
}

/**
 * Deterministically repair excess same-source / same-family MM selections
 * using only unselected candidates from the supplied MM input pool.
 */
export function repairManagerSlateDiversity(
  input: RepairManagerSlateDiversityInput,
): {
  selections: RepairedManagerSelection[];
  diagnostics: PostMmDiversityRepairDiagnostics;
} {
  const maxPerSource = input.maxPerSource ?? CURATION_DIVERSITY_MAX_PER_SOURCE;
  const maxPerFamily = input.maxPerFamily ?? CURATION_DIVERSITY_MAX_PER_FAMILY;
  const floor = input.credibleOutboundFloor ?? CURATION_CREDIBLE_OUTBOUND_FLOOR;
  const targetSize = Math.max(0, Math.floor(input.targetSize));

  const selected = input.selected.slice(0, targetSize);
  const pool = input.mmPool;
  const poolRankById = new Map<string, number>();
  pool.forEach((c, i) => {
    if (!poolRankById.has(candidateId(c))) poolRankById.set(candidateId(c), i);
  });

  type Tentative =
    | { kind: "keep"; item: ManagerSlateCurationItem; match: CompactManagerAgendaCandidate; index: number }
    | {
        kind: "replaceable";
        item: ManagerSlateCurationItem;
        match: CompactManagerAgendaCandidate;
        index: number;
        violated: DiversityRepairViolation;
      };

  const tentative: Tentative[] = [];
  const sourceCount = new Map<string, number>();
  const familyCount = new Map<string, number>();

  // Pass 1: walk MM order; mark only excess slots replaceable when alternatives exist.
  const provisionalUsed = new Set<string>();
  for (let index = 0; index < selected.length; index += 1) {
    const row = selected[index]!;
    const sk = sourceKeyOf(row.match);
    const fk = familyKeyOf(row.match);
    const overSource = (sourceCount.get(sk) ?? 0) >= maxPerSource;
    const overFamily = (familyCount.get(fk) ?? 0) >= maxPerFamily;

    if (overSource || overFamily) {
      const violated = violationType(overSource, overFamily);
      const altsExist = hasCredibleUnderCapAlternative(
        pool,
        provisionalUsed,
        sourceCount,
        familyCount,
        maxPerSource,
        maxPerFamily,
        floor,
      );
      if (altsExist) {
        tentative.push({ kind: "replaceable", item: row.item, match: row.match, index, violated });
        continue;
      }
    }

    tentative.push({ kind: "keep", item: row.item, match: row.match, index });
    provisionalUsed.add(candidateId(row.match));
    sourceCount.set(sk, (sourceCount.get(sk) ?? 0) + 1);
    familyCount.set(fk, (familyCount.get(fk) ?? 0) + 1);
  }

  // Pass 2: emit final selections in MM order; replace excess; skip already-used keeps.
  const selections: RepairedManagerSelection[] = [];
  const repairs: DiversityRepairSlotReport[] = [];
  const finalUsed = new Set<string>();
  const finalSource = new Map<string, number>();
  const finalFamily = new Map<string, number>();

  const bump = (c: CompactManagerAgendaCandidate) => {
    finalUsed.add(candidateId(c));
    const sk = sourceKeyOf(c);
    const fk = familyKeyOf(c);
    finalSource.set(sk, (finalSource.get(sk) ?? 0) + 1);
    finalFamily.set(fk, (finalFamily.get(fk) ?? 0) + 1);
  };

  for (const slot of tentative) {
    if (slot.kind === "keep") {
      if (finalUsed.has(candidateId(slot.match))) {
        // Already placed as an earlier diversity repair replacement — skip duplicate.
        continue;
      }
      selections.push({
        selectionOrigin: "manager",
        curatedItem: slot.item,
        match: slot.match,
        poolRank: poolRankById.get(candidateId(slot.match)) ?? slot.index,
        repair: null,
      });
      bump(slot.match);
      continue;
    }

    const replacement = pickReplacement({
      pool,
      poolRankById,
      usedIds: finalUsed,
      sourceCount: finalSource,
      familyCount: finalFamily,
      maxPerSource,
      maxPerFamily,
      floor,
      violated: slot.violated,
    });

    if (!replacement) {
      if (finalUsed.has(candidateId(slot.match))) continue;
      selections.push({
        selectionOrigin: "manager",
        curatedItem: slot.item,
        match: slot.match,
        poolRank: poolRankById.get(candidateId(slot.match)) ?? slot.index,
        repair: null,
      });
      bump(slot.match);
      continue;
    }

    const report: DiversityRepairSlotReport = {
      slotIndex: slot.index,
      violatedCap: slot.violated,
      removed: {
        agendaCandidateId: candidateId(slot.match),
        title: slot.match.title,
        sourceKey: sourceKeyOf(slot.match),
        familyKey: familyKeyOf(slot.match),
      },
      replacement: {
        agendaCandidateId: candidateId(replacement.candidate),
        title: replacement.candidate.title,
        sourceKey: sourceKeyOf(replacement.candidate),
        familyKey: familyKeyOf(replacement.candidate),
        poolRank: replacement.poolRank,
      },
      whyEligible: replacement.whyEligible,
    };
    repairs.push(report);
    selections.push({
      selectionOrigin: "manager_diversity_repair",
      curatedItem: null,
      match: replacement.candidate,
      poolRank: replacement.poolRank,
      repair: report,
    });
    bump(replacement.candidate);
  }

  // Never shrink below target: fill remaining from pool (credible, under soft caps when possible).
  if (selections.length < targetSize) {
    for (const pass of ["under_cap", "any_credible"] as const) {
      for (const c of pool) {
        if (selections.length >= targetSize) break;
        if (finalUsed.has(candidateId(c))) continue;
        if (!isCredible(c, floor)) continue;
        const sk = sourceKeyOf(c);
        const fk = familyKeyOf(c);
        if (pass === "under_cap") {
          if ((finalSource.get(sk) ?? 0) >= maxPerSource) continue;
          if ((finalFamily.get(fk) ?? 0) >= maxPerFamily) continue;
        }
        selections.push({
          selectionOrigin: "manager_diversity_repair",
          curatedItem: null,
          match: c,
          poolRank: poolRankById.get(candidateId(c)) ?? 999,
          repair: null,
        });
        bump(c);
      }
    }
  }

  const retainedManagerSelectionCount = selections.filter((s) => s.selectionOrigin === "manager").length;
  const compactForDiag = selections.map((s) => s.match);
  const baseDiag = diversityDiagnosticsForCompactCandidates(compactForDiag);

  return {
    selections,
    diagnostics: {
      ...baseDiag,
      originalManagerSelectionCount: selected.length,
      retainedManagerSelectionCount,
      repairedSelectionCount: repairs.length,
      repairs,
    },
  };
}
