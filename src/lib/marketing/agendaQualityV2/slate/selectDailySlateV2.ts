import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import type { AgendaReservoirItem } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  isReservoirEligibleForFutureSlate,
  toMemorySnapshot,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { applyReservoirExpiryIfNeeded } from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import { assessAgendaReuse } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import { buildStorySeedFingerprint } from "@/lib/marketing/agendaQualityV2/memory/storySeedFingerprint";
import {
  isAgendaV2SlateEligible,
  scoreMarketingAgendaV2,
  type AgendaQualityTier,
  type AgendaV2ScoreBreakdown,
} from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import { AGENDA_V2_DECISION_AXIS_SOFT_CAP } from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";

export const AGENDA_V2_SLATE_MAX = 6;
export const AGENDA_V2_SLATE_MIN = 0;

export type ScoredAgendaV2 = {
  item: AgendaReservoirItem;
  score: AgendaV2ScoreBreakdown;
  origin: "NEW" | "CARRYOVER";
  carriedFromDate: string | null;
};

export type DailyAgendaSlateV2 = {
  contract: "daily-agenda-slate-v2-shadow";
  businessDateKst: string;
  generatedAt: string;
  max: typeof AGENDA_V2_SLATE_MAX;
  min: typeof AGENDA_V2_SLATE_MIN;
  forceFill: false;
  weakBackfill: false;
  selected: ScoredAgendaV2[];
  rejected: Array<{
    agendaId: string;
    qualityTier: AgendaQualityTier;
    reason: string;
    totalScore: number;
    origin: "NEW" | "CARRYOVER";
    /** Observability only — full breakdown when scored before exclusion. */
    score?: AgendaV2ScoreBreakdown;
    carriedFromDate?: string | null;
  }>;
};

export type SelectDailyAgendaSlateV2Params = {
  businessDateKst: string;
  nowIso: string;
  /** Newly qualified candidates for the day */
  newlyQualified: AgendaReservoirItem[];
  /** Full reservoir history for memory / carryover */
  reservoirItems: AgendaReservoirItem[];
};

function softDiversityKey(item: AgendaReservoirItem): string {
  return item.decisionAxisFingerprint ?? "unknown_axis";
}

/**
 * V2 shadow Daily Slate: max 6, min 0, NO weak backfill.
 * NEW + DEFERRED (+ PRESENTED undecided) compete on current score.
 */
export function selectDailyAgendaSlateV2(
  params: SelectDailyAgendaSlateV2Params,
): DailyAgendaSlateV2 {
  const historySnapshots = params.reservoirItems.map(toMemorySnapshot);
  const byId = new Map<string, AgendaReservoirItem>();
  for (const item of params.reservoirItems) byId.set(item.agendaId, item);
  for (const item of params.newlyQualified) byId.set(item.agendaId, item);

  const poolIds = new Set<string>();
  for (const item of params.newlyQualified) poolIds.add(item.agendaId);
  for (const item of params.reservoirItems) {
    const expired = applyReservoirExpiryIfNeeded(item, params.nowIso);
    if (expired.status !== item.status) {
      byId.set(item.agendaId, expired);
    }
    const current = byId.get(item.agendaId)!;
    if (isReservoirEligibleForFutureSlate(current, params.nowIso)) {
      poolIds.add(current.agendaId);
    }
  }

  const scored: ScoredAgendaV2[] = [];
  const rejected: DailyAgendaSlateV2["rejected"] = [];

  for (const id of poolIds) {
    const item = byId.get(id)!;
    const origin: "NEW" | "CARRYOVER" =
      params.newlyQualified.some((n) => n.agendaId === id) && item.status === "QUALIFIED"
        ? "NEW"
        : item.status === "DEFERRED" || item.status === "PRESENTED" || item.presentedCount > 0
          ? "CARRYOVER"
          : "NEW";

    const reuse = assessAgendaReuse({
      candidate: {
        agendaId: item.agendaId,
        sourceFingerprint: item.sourceFingerprint,
        topicFingerprint: item.topicFingerprint,
        decisionAxisFingerprint: item.decisionAxisFingerprint,
        storySeedFingerprint:
          item.storySeedFingerprint ??
          buildStorySeedFingerprint(item.candidate.editorial.marketingStorySeedKo),
        signalSummaryKo: item.candidate.signalContext.signalSummaryKo,
        whyNowKo: item.candidate.editorial.whyNowKo,
      },
      history: historySnapshots.filter((h) => h.agendaId !== item.agendaId),
      nowIso: params.nowIso,
    });

    const score = scoreMarketingAgendaV2({
      candidate: item.candidate,
      reuse,
      nowIso: params.nowIso,
      presentedCount: item.presentedCount,
      lastPresentedAt: item.lastPresentedAt,
      originalTitle: item.candidate.signalContext.signalSummaryKo,
    });

    const carriedFromDate =
      origin === "CARRYOVER"
        ? (item.deferredAt ?? item.lastPresentedAt ?? item.firstQualifiedAt)?.slice(0, 10) ?? null
        : null;

    if (!isAgendaV2SlateEligible(score.qualityTier)) {
      rejected.push({
        agendaId: item.agendaId,
        qualityTier: score.qualityTier,
        reason:
          score.qualityTier === "WEAK"
            ? "weak_no_backfill"
            : score.qualityTier === "REJECT"
              ? "quality_gate_reject"
              : "not_eligible",
        totalScore: score.totalScore,
        origin,
        score,
        carriedFromDate,
      });
      continue;
    }

    scored.push({ item, score, origin, carriedFromDate });
  }

  scored.sort((a, b) => b.score.totalScore - a.score.totalScore);

  // Soft decision-axis diversity after quality sort
  const selected: ScoredAgendaV2[] = [];
  const axisCounts = new Map<string, number>();
  for (const row of scored) {
    if (selected.length >= AGENDA_V2_SLATE_MAX) {
      rejected.push({
        agendaId: row.item.agendaId,
        qualityTier: row.score.qualityTier,
        reason: "slate_max_cap",
        totalScore: row.score.totalScore,
        origin: row.origin,
        score: row.score,
        carriedFromDate: row.carriedFromDate,
      });
      continue;
    }
    const axis = softDiversityKey(row.item);
    const count = axisCounts.get(axis) ?? 0;
    // Allow at most soft-cap of same decision axis unless slate still empty of alternatives
    if (count >= AGENDA_V2_DECISION_AXIS_SOFT_CAP) {
      const remainingStrong = scored
        .slice(scored.indexOf(row) + 1)
        .filter((r) => !selected.includes(r) && softDiversityKey(r.item) !== axis);
      if (remainingStrong.length > 0 && selected.length < AGENDA_V2_SLATE_MAX - 1) {
        rejected.push({
          agendaId: row.item.agendaId,
          qualityTier: row.score.qualityTier,
          reason: "decision_axis_soft_diversity",
          totalScore: row.score.totalScore,
          origin: row.origin,
          score: row.score,
          carriedFromDate: row.carriedFromDate,
        });
        continue;
      }
    }
    selected.push(row);
    axisCounts.set(axis, count + 1);
  }

  return {
    contract: "daily-agenda-slate-v2-shadow",
    businessDateKst: params.businessDateKst,
    generatedAt: params.nowIso,
    max: AGENDA_V2_SLATE_MAX,
    min: AGENDA_V2_SLATE_MIN,
    forceFill: false,
    weakBackfill: false,
    selected,
    rejected,
  };
}

export function candidateFromItem(item: AgendaReservoirItem): MarketingAgendaCandidateV2 {
  return item.candidate;
}
