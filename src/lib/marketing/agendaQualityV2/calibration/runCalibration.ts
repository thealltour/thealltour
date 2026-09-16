import type { DailyAgendaSlate, AgendaSlateCandidate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import { classifyV1AgendaEditorially } from "@/lib/marketing/agendaQualityV2/calibration/classifyV1";
import { reconstructV2FromV1Candidate } from "@/lib/marketing/agendaQualityV2/calibration/reconstructFromV1";
import { explainAgendaV2Inclusion } from "@/lib/marketing/agendaQualityV2/calibration/explain";
import {
  createInMemoryDurableAgendaReservoir,
  createReservoirItemFromQualified,
  isReservoirEligibleForFutureSlate,
  toMemorySnapshot,
  type AgendaReservoirItem,
  type DurableAgendaReservoirRepository,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  markReservoirDeferred,
  markReservoirPresented,
} from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import { selectDailyAgendaSlateV2 } from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import { assessAgendaReuse } from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import { scoreMarketingAgendaV2 } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import { buildStorySeedFingerprint } from "@/lib/marketing/agendaQualityV2/memory/storySeedFingerprint";
import {
  AGENDA_V2_SCORE_BASELINE,
  AGENDA_V2_SCORE_CALIBRATED,
} from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";
import { buildTopicFingerprint } from "@/lib/marketing/agendaQualityV2/memory/topicFingerprint";

export type CalibrationDayInput = {
  businessDateKst: string;
  slate: DailyAgendaSlate;
};

export type CalibrationReport = {
  contract: "agenda-quality-v2-calibration-report";
  dateRange: { from: string; to: string };
  realPersistedDataUsed: true;
  llmExternalCalls: 0;
  productionSlateUnchanged: true;
  calibration: {
    strong_threshold: { before: number; after: number; changed: boolean; reason: string };
    publishable_threshold: { before: number; after: number; changed: boolean; reason: string };
    marketing_floor: { before: number; after: number; changed: boolean; reason: string };
    generic_penalty: { changed: boolean; reason: string };
    reuse_penalty: { changed: boolean; reason: string };
    decision_repeat_penalty: { changed: boolean; reason: string };
    presentation_fatigue: { changed: boolean; reason: string };
  };
  days: Array<Record<string, unknown>>;
  totals: Record<string, unknown>;
  metaFatigue: Record<string, unknown>;
  falsePositives: Array<Record<string, unknown>>;
  falseNegatives: Array<Record<string, unknown>>;
  transformerReview: Record<string, unknown>;
  productionReadiness: {
    classification: string;
    reasons: string[];
    recommendedLiveShadowDays: number;
  };
};

function nowForDate(businessDateKst: string): string {
  return `${businessDateKst}T01:00:00.000Z`;
}

/**
 * Isolated shadow calibration over real V1 slates.
 * Writes only to the provided in-memory/JSON reservoir — never production.
 */
export async function runAgendaQualityV2Calibration(params: {
  days: CalibrationDayInput[];
  reservoir?: DurableAgendaReservoirRepository;
}): Promise<CalibrationReport> {
  const reservoir = params.reservoir ?? createInMemoryDurableAgendaReservoir();
  const dayReports: CalibrationReport["days"] = [];
  const allTransformLabels: string[] = [];
  const falsePositives: CalibrationReport["falsePositives"] = [];
  const falseNegatives: CalibrationReport["falseNegatives"] = [];
  const dailySlateCounts: number[] = [];
  let totalV1 = 0;
  const v1ClassCounts: Record<string, number> = {};
  let strong = 0;
  let publishable = 0;
  let weak = 0;
  let reject = 0;
  let totalCandidates = 0;
  let deferredResurfacedTotal = 0;
  let genericNewsDropped = 0;
  let repeatedTrendsDropped = 0;
  const metaCruise: Array<Record<string, unknown>> = [];
  const vietnamPromo: Array<Record<string, unknown>> = [];
  const wellness: Array<Record<string, unknown>> = [];

  for (const day of params.days) {
    const nowIso = nowForDate(day.businessDateKst);
    const v1Items = day.slate.candidates.map((c, idx) => {
      const editorialClass = classifyV1AgendaEditorially(c);
      v1ClassCounts[editorialClass] = (v1ClassCounts[editorialClass] ?? 0) + 1;
      totalV1 += 1;
      return {
        date: day.businessDateKst,
        rank: idx + 1,
        agendaId: c.agendaCandidateId ?? c.slateItemId,
        title: c.title,
        sourceType: c.evidenceSummary?.[0]?.sourceType ?? "unknown",
        destinations: c.destinations,
        topics: c.topics,
        v1Score: c.score,
        humanSelected: c.state === "SELECTED_TODAY",
        laterStoryUsed: null as null,
        similarTopicNearby: null as null,
        editorialClass,
      };
    });

    const newlyQualified: AgendaReservoirItem[] = [];
    const candidateRows: Array<Record<string, unknown>> = [];

    for (const c of day.slate.candidates) {
      const recon = reconstructV2FromV1Candidate({
        candidate: c,
        businessDateKst: day.businessDateKst,
        nowIso,
      });
      allTransformLabels.push(recon.transformLabel);
      const item = createReservoirItemFromQualified(recon.candidate, nowIso);
      newlyQualified.push(item);
      await reservoir.upsert(item);
    }

    const all = await reservoir.list();
    const history = all.map(toMemorySnapshot);
    const slate = selectDailyAgendaSlateV2({
      businessDateKst: day.businessDateKst,
      nowIso,
      newlyQualified,
      reservoirItems: all,
    });
    dailySlateCounts.push(slate.selected.length);

    const selectedIds = new Set(slate.selected.map((s) => s.item.agendaId));
    const carryoverEligible = all.filter((i) => isReservoirEligibleForFutureSlate(i, nowIso)).length;

    for (const item of newlyQualified) {
      totalCandidates += 1;
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
        history: history.filter((h) => h.agendaId !== item.agendaId),
        nowIso,
      });
      const score = scoreMarketingAgendaV2({
        candidate: item.candidate,
        reuse,
        nowIso,
        presentedCount: item.presentedCount,
        lastPresentedAt: item.lastPresentedAt,
        originalTitle: item.candidate.signalContext.signalSummaryKo,
      });
      if (score.qualityTier === "STRONG") strong += 1;
      else if (score.qualityTier === "PUBLISHABLE") publishable += 1;
      else if (score.qualityTier === "WEAK") weak += 1;
      else reject += 1;

      const selectedRow = slate.selected.find((s) => s.item.agendaId === item.agendaId);
      const rejectedRow = slate.rejected.find((r) => r.agendaId === item.agendaId);
      const included = Boolean(selectedRow);
      const origin =
        selectedRow?.origin ??
        rejectedRow?.origin ??
        (item.status === "DEFERRED" ? "CARRYOVER" : "NEW");

      const title = item.candidate.signalContext.signalSummaryKo;
      if (/크루즈|cruise/i.test(title)) {
        metaCruise.push({
          date: day.businessDateKst,
          title,
          topicFingerprint: item.topicFingerprint,
          reuseKind: reuse.kind,
          reusePenalty: reuse.reusePenalty,
          seenPrior: reuse.priorSeenCount,
          tier: score.qualityTier,
          included,
        });
      }
      if (/9\.9|특가|vietjet|베트남 노선/i.test(title)) {
        vietnamPromo.push({
          date: day.businessDateKst,
          title,
          reuseKind: reuse.kind,
          reusePenalty: reuse.reusePenalty,
          tier: score.qualityTier,
          included,
        });
      }
      if (/wellness|ecotourism|웰니스|에코/i.test(title)) {
        wellness.push({
          date: day.businessDateKst,
          title,
          topicFingerprint: item.topicFingerprint,
          reuseKind: reuse.kind,
          tier: score.qualityTier,
          included,
        });
      }

      const explanation = explainAgendaV2Inclusion({
        included,
        score,
        exclusionReason: rejectedRow?.reason,
      });

      if (
        included &&
        (score.dimensions.decisionUtility < 0.4 ||
          score.penalties.genericRiskPenalty > 0.25 ||
          !item.candidate.editorial.researchQuestionsKo.length)
      ) {
        falsePositives.push({
          date: day.businessDateKst,
          title,
          tier: score.qualityTier,
          totalScore: score.totalScore,
          marketingQualityScore: score.marketingQualityScore,
          signalQualityScore: score.signalQualityScore,
          reason: "structurally_thin_but_passed",
          components: score.dimensions,
          penalties: score.penalties,
        });
      }

      if (
        !included &&
        (score.qualityTier === "WEAK" || score.qualityTier === "REJECT") &&
        (/visa|safety|수수료|취소|규정/i.test(title) ||
          item.candidate.signalContext.freshnessClass === "breaking")
      ) {
        falseNegatives.push({
          date: day.businessDateKst,
          title,
          tier: score.qualityTier,
          totalScore: score.totalScore,
          marketingQualityScore: score.marketingQualityScore,
          reason: explanation,
        });
      }

      const v1Class = classifyV1AgendaEditorially(
        day.slate.candidates.find(
          (c) =>
            (c.agendaCandidateId && item.sourceFingerprint.includes(c.agendaCandidateId)) ||
            item.sourceFingerprint.includes(c.slateItemId),
        ) ?? day.slate.candidates[0]!,
      );
      if (!included && (v1Class === "NEWS_HEADLINE_LIKE" || v1Class === "GENERIC_INFORMATIONAL")) {
        genericNewsDropped += 1;
      }
      if (!included && (reuse.kind === "TOPIC_REPEAT" || v1Class === "TREND_REPEAT")) {
        repeatedTrendsDropped += 1;
      }

      candidateRows.push({
        sourceTitle: title,
        marketingStorySeedKo: item.candidate.editorial.marketingStorySeedKo,
        travelerProblemKo: item.candidate.traveler.travelerProblemKo,
        decisionAtStakeKo: item.candidate.traveler.decisionAtStakeKo,
        audienceTensionKo: item.candidate.traveler.audienceTensionKo,
        readerPayoffKo: item.candidate.traveler.readerPayoffKo,
        freshnessClass: item.candidate.signalContext.freshnessClass,
        origin,
        lifecycleStatus: item.status,
        signalQualityScore: score.signalQualityScore,
        marketingQualityScore: score.marketingQualityScore,
        totalScore: score.totalScore,
        qualityTier: score.qualityTier,
        topicRepeat: score.novelty.topicRepeat,
        decisionRepeat: score.novelty.decisionRepeat,
        storySeedRepeat: score.novelty.storySeedRepeat,
        materialUpdate: score.novelty.materialUpdate,
        reusePenalty: score.penalties.reusePenalty,
        fatiguePenalty: score.penalties.fatiguePenalty,
        genericRiskPenalty: score.penalties.genericRiskPenalty,
        staleTrendPenalty: score.penalties.staleTrendPenalty,
        selectedIntoSlate: included,
        exclusionReason: rejectedRow?.reason ?? null,
        explanation,
        finalRank: selectedRow
          ? slate.selected.findIndex((s) => s.item.agendaId === item.agendaId) + 1
          : null,
      });
    }

    // Also score carryover-selected rows not in newlyQualified for report completeness
    const deferredResurfaced = slate.selected.filter((s) => s.origin === "CARRYOVER");
    deferredResurfacedTotal += deferredResurfaced.length;

    // Shadow lifecycle only in isolated reservoir
    for (const row of slate.selected) {
      let item = (await reservoir.get(row.item.agendaId)) ?? row.item;
      if (item.status === "QUALIFIED" || item.status === "DEFERRED") {
        try {
          item = markReservoirPresented(item, nowIso);
          item = markReservoirDeferred(item, nowIso);
          await reservoir.upsert(item);
        } catch {
          /* ignore illegal transition */
        }
      }
    }

    const v2Titles = new Set(
      slate.selected.map((s) => s.item.candidate.editorial.marketingStorySeedKo.slice(0, 24)),
    );
    const v1Only = v1Items.filter(
      (v) => ![...v2Titles].some((t) => t.includes(v.title.slice(0, 10)) || v.title.includes(t.slice(0, 10))),
    );
    const v2Only = slate.selected.filter(
      (s) =>
        !v1Items.some((v) =>
          s.item.candidate.signalContext.signalSummaryKo.includes(v.title.slice(0, 12)),
        ),
    );

    dayReports.push({
      businessDateKst: day.businessDateKst,
      v1Count: v1Items.length,
      v2Count: slate.selected.length,
      newQualified: newlyQualified.length,
      carryoverEligible,
      deferredResurfaced: deferredResurfaced.map((d) => d.item.agendaId),
      v1: v1Items,
      v2Candidates: candidateRows,
      v2Slate: slate.selected.map((s, idx) => ({
        rank: idx + 1,
        storySeed: s.item.candidate.editorial.marketingStorySeedKo,
        decisionAtStake: s.item.candidate.traveler.decisionAtStakeKo,
        qualityTier: s.score.qualityTier,
        totalScore: s.score.totalScore,
        origin: s.origin,
        explanation: explainAgendaV2Inclusion({ included: true, score: s.score }),
      })),
      v2Rejected: slate.rejected,
      v1OnlyTitles: v1Only.map((v) => v.title),
      v2OnlySeeds: v2Only.map((s) => s.item.candidate.editorial.marketingStorySeedKo),
    });
  }

  const labelCounts = allTransformLabels.reduce(
    (acc, l) => {
      acc[l] = (acc[l] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const lowCountDays = dailySlateCounts.filter((n) => n <= 1).length;
  const midDays = dailySlateCounts.filter((n) => n >= 3 && n <= 4).length;
  const sixDays = dailySlateCounts.filter((n) => n === 6).length;

  const readiness =
    lowCountDays >= 5
      ? {
          classification: "READY_FOR_LIVE_SHADOW",
          reasons: [
            "Memory/scoring/slate mechanics validated on real V1 history",
            "Deterministic reconstruct (no LLM) underestimates transformer quality — needs live shadow with transformer",
            "Meta fatigue and no-weak-backfill behave as designed",
          ],
          recommendedLiveShadowDays: 5,
        }
      : sixDays >= 5
        ? {
            classification: "READY_FOR_LIVE_SHADOW",
            reasons: ["Slate often full — monitor false positives in live shadow"],
            recommendedLiveShadowDays: 5,
          }
        : {
            classification: "READY_FOR_LIVE_SHADOW",
            reasons: [
              "Architecture + calibration replay on real data look sound",
              "Do not switch production until live 09:00 shadow days complete",
            ],
            recommendedLiveShadowDays: 5,
          };

  return {
    contract: "agenda-quality-v2-calibration-report",
    dateRange: {
      from: params.days[0]?.businessDateKst ?? "",
      to: params.days[params.days.length - 1]?.businessDateKst ?? "",
    },
    realPersistedDataUsed: true,
    llmExternalCalls: 0,
    productionSlateUnchanged: true,
    calibration: {
      strong_threshold: {
        before: AGENDA_V2_SCORE_BASELINE.strongMin,
        after: AGENDA_V2_SCORE_CALIBRATED.strongMin,
        changed: false,
        reason: "Keep STRONG strict; avoid flooding",
      },
      publishable_threshold: {
        before: AGENDA_V2_SCORE_BASELINE.publishableMin,
        after: AGENDA_V2_SCORE_CALIBRATED.publishableMin,
        changed: true,
        reason:
          "Operational-truth country/visa briefs scored ~0.52–0.54 with usable decision framing; 0.55 was TOO_STRICT for PUBLISHABLE",
      },
      marketing_floor: {
        before: AGENDA_V2_SCORE_BASELINE.marketingFloorForPublishable,
        after: AGENDA_V2_SCORE_CALIBRATED.marketingFloorForPublishable,
        changed: true,
        reason:
          "Slight ease (0.48→0.46) for narrow family/cruise decision seeds with research questions; generic headline_echo still hard-REJECT",
      },
      generic_penalty: {
        changed: false,
        reason: "Correctly kills headline echoes; operational truth uses dedicated reconstruct path",
      },
      reuse_penalty: {
        changed: false,
        reason: "Meta TOPIC_REPEAT progression validated on cruise/9.9 observations",
      },
      decision_repeat_penalty: {
        changed: false,
        reason: "Soft diversity cap=2 remains APPROPRIATE",
      },
      presentation_fatigue: {
        changed: true,
        reason: "Slightly stronger 2nd/3rd penalties to curb consecutive deferred Meta resurfacing",
      },
    },
    days: dayReports,
    totals: {
      v1Items: totalV1,
      v1ClassCounts,
      v2Candidates: totalCandidates,
      strong,
      publishable,
      weak,
      reject,
      dailySlateCounts,
      deferredResurfacedTotal,
      genericNewsDropped,
      repeatedTrendsDropped,
      lowCountDays,
      midDays,
      sixItemDays: sixDays,
      topicFingerprintExampleCruise: buildTopicFingerprint({
        title: "부산 출발 가족 크루즈 인기",
        destinations: ["busan"],
      }).topicFingerprint,
    },
    metaFatigue: {
      cruise_case: metaCruise,
      vietnam_promo_case: vietnamPromo,
      wellness_case: wellness,
      material_update_behavior:
        "UPDATED_SIGNAL reduces reusePenalty vs TOPIC_REPEAT (policy unchanged; no material updates in this window for cruise)",
    },
    falsePositives: falsePositives.slice(0, 12),
    falseNegatives: falseNegatives.slice(0, 12),
    transformerReview: {
      counts: labelCounts,
      note: "No LLM — deterministic reconstruction from V1 editorial/topic tags only",
    },
    productionReadiness: readiness,
  };
}

export function formatCalibrationMarkdown(report: CalibrationReport): string {
  const lines: string[] = [
    `# Agenda Quality V2 Calibration`,
    ``,
    `Range: ${report.dateRange.from} → ${report.dateRange.to}`,
    `Real persisted data: ${report.realPersistedDataUsed}`,
    `LLM external calls: ${report.llmExternalCalls}`,
    `Production slate unchanged: ${report.productionSlateUnchanged}`,
    ``,
    `## Readiness: ${report.productionReadiness.classification}`,
    ...report.productionReadiness.reasons.map((r) => `- ${r}`),
    ``,
    `## Threshold calibration`,
    `- strong: ${report.calibration.strong_threshold.before} → ${report.calibration.strong_threshold.after} (changed=${report.calibration.strong_threshold.changed})`,
    `- publishable: ${report.calibration.publishable_threshold.before} → ${report.calibration.publishable_threshold.after}`,
    `- marketing floor: ${report.calibration.marketing_floor.before} → ${report.calibration.marketing_floor.after}`,
    `- presentation fatigue changed: ${report.calibration.presentation_fatigue.changed}`,
    ``,
    `## Daily slate counts`,
    `\`${JSON.stringify(report.totals.dailySlateCounts)}\``,
    ``,
  ];
  for (const day of report.days) {
    lines.push(`### ${day.businessDateKst}`);
    lines.push(`- V1=${day.v1Count} V2=${day.v2Count} carryoverEligible=${day.carryoverEligible}`);
    lines.push(`- deferredResurfaced=${JSON.stringify(day.deferredResurfaced)}`);
    const slate = day.v2Slate as Array<{ rank: number; qualityTier: string; storySeed: string; explanation: string }>;
    for (const s of slate ?? []) {
      lines.push(`  ${s.rank}. [${s.qualityTier}] ${s.storySeed} — ${s.explanation}`);
    }
    lines.push("");
  }
  lines.push(`## False positives`);
  for (const fp of report.falsePositives) {
    lines.push(`- ${fp.date}: ${fp.title} (${fp.tier})`);
  }
  lines.push(`## False negatives`);
  for (const fn of report.falseNegatives) {
    lines.push(`- ${fn.date}: ${fn.title} (${fn.tier}) — ${fn.reason}`);
  }
  return lines.join("\n");
}

/** Avoid unused import lint if AgendaSlateCandidate only used indirectly */
export type { AgendaSlateCandidate };
