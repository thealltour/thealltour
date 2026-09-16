import { describe, expect, it } from "vitest";

import { classifyV1AgendaEditorially } from "@/lib/marketing/agendaQualityV2/calibration/classifyV1";
import { reconstructV2FromV1Candidate } from "@/lib/marketing/agendaQualityV2/calibration/reconstructFromV1";
import { explainAgendaV2Inclusion } from "@/lib/marketing/agendaQualityV2/calibration/explain";
import {
  AGENDA_V2_SCORE_BASELINE,
  AGENDA_V2_SCORE_CALIBRATED,
} from "@/lib/marketing/agendaQualityV2/scoring/calibrationConfig";
import { scoreMarketingAgendaV2 } from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import { runAgendaQualityV2Calibration } from "@/lib/marketing/agendaQualityV2/calibration/runCalibration";
import { createInMemoryDurableAgendaReservoir } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import type { AgendaSlateCandidate, DailyAgendaSlate } from "@/lib/marketing/cron/daily/agendaSlate/types";

function cand(partial: Partial<AgendaSlateCandidate> & { title: string }): AgendaSlateCandidate {
  return {
    contract: "agenda-slate-candidate-v1",
    slateItemId: partial.slateItemId ?? `si_${partial.title.slice(0, 8)}`,
    state: partial.state ?? "AVAILABLE",
    origin: partial.origin ?? "organic_research",
    deferredFromBusinessDateKst: null,
    deferredFromSlateItemId: null,
    agendaCandidateId: partial.agendaCandidateId ?? `ac_${partial.title.slice(0, 8)}`,
    researchBriefId: null,
    canonicalArticleIds: [],
    title: partial.title,
    summary: partial.summary ?? partial.title,
    score: partial.score ?? 0.7,
    scoreReasons: [],
    destinations: partial.destinations ?? [],
    topics: partial.topics ?? [],
    entities: [],
    audienceHint: null,
    rationale: partial.rationale ?? [],
    recommendedFormats: [],
    recommendedChannel: null,
    evidenceSummary: [],
    matchedProductIds: [],
    riskFlags: [],
    editorial: partial.editorial ?? {
      freshnessWhyNow: null,
      koreanTravelerRelevance: null,
      practicalTravelValue: null,
      theAllTourBusinessRelevance: null,
      contentPotential: null,
    },
    researchSnapshot: partial.researchSnapshot ?? {
      freshnessScore: 0.8,
      credibilityScore: 0.7,
      travelRelevanceScore: 0.7,
      totalResearchScore: 0.7,
    },
  };
}

function slate(date: string, candidates: AgendaSlateCandidate[]): DailyAgendaSlate {
  return {
    contract: "daily-agenda-slate-v1",
    slateId: `slate_${date}`,
    logicalRunKey: `lrk_${date}`,
    businessDateKst: date,
    routineId: "r",
    runId: "run",
    correlationId: "c",
    createdAt: `${date}T01:00:00.000Z`,
    updatedAt: `${date}T01:00:00.000Z`,
    status: "ready_for_human_selection",
    targetSize: 6,
    researchStatus: null,
    degraded: false,
    candidates,
    cooldown: { days: 3, excludedAgendaCandidateIds: [], excludedBriefIds: [] },
    curation: { mode: "manager_curated", managerMessage: null },
    observability: {
      organicCount: candidates.length,
      deferredCarryoverCount: 0,
      availableCount: candidates.length,
      selectedTodayCount: 0,
    },
    metadata: {},
  };
}

describe("AGENDA_QUALITY_V2 Phase3 calibration", () => {
  it("classifies V1 editorial types", () => {
    expect(
      classifyV1AgendaEditorially(
        cand({ title: "부산 출발 크루즈 가족 여행 활동 콘텐츠 관측", topics: ["activity_trend", "cruise"] }),
      ),
    ).toBe("TREND_REPEAT");
    expect(classifyV1AgendaEditorially(cand({ title: "ireland", topics: ["visa", "travel"] }))).toBe(
      "OPERATIONAL_TRUTH",
    );
    expect(
      classifyV1AgendaEditorially(
        cand({ title: "모두투어, ‘메이플 로드’ 기획전 출시", topics: ["travel"] }),
      ),
    ).toBe("PROMOTIONAL");
  });

  it("deterministic reconstruct does not call LLM and cruise gets decision frame", () => {
    const r = reconstructV2FromV1Candidate({
      candidate: cand({
        title: "부산 출발 크루즈 가족 여행 활동 콘텐츠 관측",
        topics: ["activity_trend", "cruise", "family"],
      }),
      businessDateKst: "2026-09-12",
      nowIso: "2026-09-12T01:00:00.000Z",
    });
    expect(r.candidate.provenance.transformModel).toBe("deterministic_v1_reconstruct_v1");
    expect(r.candidate.traveler.decisionAtStakeKo).toMatch(/크루즈|패키지/);
    expect(r.transformLabel).toBe("GOOD_TRANSFORMATION");
  });

  it("calibrated thresholds differ from baseline only where intended", () => {
    expect(AGENDA_V2_SCORE_CALIBRATED.strongMin).toBe(AGENDA_V2_SCORE_BASELINE.strongMin);
    expect(AGENDA_V2_SCORE_CALIBRATED.publishableMin).toBeLessThan(
      AGENDA_V2_SCORE_BASELINE.publishableMin,
    );
    expect(AGENDA_V2_SCORE_CALIBRATED.marketingFloorForPublishable).toBeLessThan(
      AGENDA_V2_SCORE_BASELINE.marketingFloorForPublishable,
    );
  });

  it("explain helpers produce readable reasons", () => {
    const candidate = reconstructV2FromV1Candidate({
      candidate: cand({
        title: "항공권 취소했더니 수수료 두 번",
        topics: ["travel"],
      }),
      businessDateKst: "2026-09-15",
      nowIso: "2026-09-15T01:00:00.000Z",
    }).candidate;
    const score = scoreMarketingAgendaV2({
      candidate,
      reuse: {
        kind: "NOVEL",
        topicRepeat: false,
        decisionRepeat: false,
        storySeedRepeat: false,
        materialUpdate: false,
        matchedAgendaId: null,
        matchedStatus: null,
        daysSinceFirstSeen: null,
        priorSeenCount: 0,
        reusePenalty: 0,
        staleTrendPenalty: 0,
        decisionAxisRepeatPenalty: 0,
        notes: [],
      },
      nowIso: "2026-09-15T01:00:00.000Z",
    });
    const included = explainAgendaV2Inclusion({ included: true, score });
    expect(included.length).toBeGreaterThan(10);
  });

  it("multi-day calibration shadow: meta repeat weakens; slate 0-6; no production mutation", async () => {
    const days = [
      slate("2026-09-12", [
        cand({
          title: "부산 출발 크루즈 가족 여행 활동 콘텐츠 관측",
          topics: ["activity_trend", "cruise", "family"],
          agendaCandidateId: "ac_cruise_1",
        }),
        cand({
          title: "베트남 노선 9.9 특가 프로모션 관측",
          topics: ["fare_price_signal"],
          agendaCandidateId: "ac_99_1",
        }),
      ]),
      slate("2026-09-13", [
        cand({
          title: "부산 출발 크루즈 추석 탑승 가이드 콘텐츠 관측",
          topics: ["activity_trend", "cruise", "family"],
          agendaCandidateId: "ac_cruise_2",
        }),
        cand({
          title: "베트남 노선 9.9 특가 프로모션 관측",
          topics: ["fare_price_signal"],
          agendaCandidateId: "ac_99_2",
        }),
      ]),
      slate("2026-09-14", [
        cand({
          title: "ireland",
          topics: ["visa", "travel"],
          agendaCandidateId: "ac_ie",
        }),
        cand({
          title: "chasing gold and clouds: vietnam’s best september escapes",
          topics: ["event", "travel"],
          destinations: ["vietnam"],
          agendaCandidateId: "ac_vn_escape",
        }),
      ]),
    ];

    const report = await runAgendaQualityV2Calibration({
      days: days.map((s) => ({ businessDateKst: s.businessDateKst, slate: s })),
      reservoir: createInMemoryDurableAgendaReservoir(),
    });

    expect(report.realPersistedDataUsed).toBe(true);
    expect(report.llmExternalCalls).toBe(0);
    expect(report.productionSlateUnchanged).toBe(true);
    const counts = report.totals.dailySlateCounts as number[];
    expect(counts.every((n) => n >= 0 && n <= 6)).toBe(true);

    const cruise = report.metaFatigue.cruise_case as Array<{ reusePenalty: number; date: string }>;
    expect(cruise.length).toBeGreaterThanOrEqual(2);
    if (cruise.length >= 2) {
      expect(cruise[1]!.reusePenalty).toBeGreaterThanOrEqual(cruise[0]!.reusePenalty);
    }
  });
});
