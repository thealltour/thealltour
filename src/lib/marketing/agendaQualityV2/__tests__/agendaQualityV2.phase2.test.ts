import { describe, expect, it } from "vitest";

import { assembleMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/transformer/transform";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";
import { buildTopicFingerprint } from "@/lib/marketing/agendaQualityV2/memory/topicFingerprint";
import {
  buildDecisionAxisFingerprint,
  deriveDecisionAxisId,
} from "@/lib/marketing/agendaQualityV2/memory/decisionAxisFingerprint";
import { buildStorySeedFingerprint } from "@/lib/marketing/agendaQualityV2/memory/storySeedFingerprint";
import {
  assessAgendaReuse,
  detectMaterialUpdate,
} from "@/lib/marketing/agendaQualityV2/memory/reuseDetection";
import { computeFreshnessDecayScore } from "@/lib/marketing/agendaQualityV2/decay/freshnessDecay";
import { computePresentationFatiguePenalty } from "@/lib/marketing/agendaQualityV2/decay/freshnessDecay";
import {
  isAgendaV2SlateEligible,
  scoreMarketingAgendaV2,
} from "@/lib/marketing/agendaQualityV2/scoring/storyabilityScore";
import {
  createInMemoryDurableAgendaReservoir,
  createReservoirItemFromQualified,
  isReservoirEligibleForFutureSlate,
  toMemorySnapshot,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  markReservoirDeferred,
  markReservoirPresented,
  markReservoirRejected,
  markReservoirSelected,
  applyReservoirExpiryIfNeeded,
} from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import { selectDailyAgendaSlateV2 } from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import { runAgendaQualityV2ShadowPhase2 } from "@/lib/marketing/agendaQualityV2/shadow/runShadowPhase2";
import { runAgendaQualityV2Backtest } from "@/lib/marketing/agendaQualityV2/shadow/backtest";
import { evaluateSupersedeEvidence } from "@/lib/marketing/agendaQualityV2/reservoir/supersede";

const NOW = "2026-09-16T01:00:00.000Z";

function goodLlm(overrides?: Partial<MarketingAgendaTransformerLlmOutput>): MarketingAgendaTransformerLlmOutput {
  return {
    targetTravelerKo: "외부 관광이 많은 푸꾸옥 여행자",
    travelerProblemKo:
      "리조트 선택지가 늘어날수록 외부 관광이 많은 여행자는 숙소 위치를 어떻게 판단해야 하는가?",
    decisionAtStakeKo: "숙소를 리조트 클러스터에 둘지, 관광 접근성 구역에 둘지",
    audienceTensionKo: "편의·부대시설 집중 vs 이동시간·현지 동선 효율",
    readerPayoffKo: "본인 스타일에 맞는 숙소 위치 판단 기준을 세운다",
    marketingStorySeedKo: "호텔 공급이 늘어난 지금, 숙소 위치는 무엇으로 고를까?",
    whyNowKo: "공급 확대 신호가 관측되어 위치 선택 기준이 더 중요해질 수 있다",
    researchQuestionsKo: ["신규 공급 구역은?", "이동 수단은?"],
    nonGoalsKo: ["특정 호텔 추천"],
    genericRiskKo: "가설 유지",
    storyArchetypeHint: "convenience_vs_experience",
    freshnessClass: "timely",
    signalSummaryKo: "푸꾸옥 호텔 공급 관련 신호",
    limitations: ["요금 미확인"],
    ...overrides,
  };
}

function makeCandidate(opts?: {
  title?: string;
  sourceFingerprint?: string;
  llm?: Partial<MarketingAgendaTransformerLlmOutput>;
  destinations?: string[];
  observedAt?: string;
  credibility?: number;
  freshness?: number;
}) {
  return assembleMarketingAgendaCandidateV2({
    input: {
      originalTitle: opts?.title ?? "푸꾸옥 호텔 공급 증가",
      originalSummary: opts?.title ?? "푸꾸옥 호텔 공급 증가",
      sourceTypes: ["news"],
      destinations: opts?.destinations ?? ["phu_quoc"],
      sourceFingerprint: opts?.sourceFingerprint ?? "src:hotel_1",
      sourceCredibility: opts?.credibility ?? 0.8,
      sourceFreshness: opts?.freshness ?? 0.8,
      koreanTravelerRelevance: 0.75,
      observedAt: opts?.observedAt ?? NOW,
    },
    llm: goodLlm(opts?.llm),
    nowIso: opts?.observedAt ?? NOW,
  });
}

describe("AGENDA_QUALITY_V2 Phase2 memory", () => {
  it("same Meta topic with new observationId shares topic fingerprint", () => {
    const a = buildTopicFingerprint({
      title: "부산 출발 가족 크루즈 인기",
      summary: "메타 관측",
      destinations: ["busan"],
    });
    const b = buildTopicFingerprint({
      title: "부모님과 부산발 크루즈가 뜬다",
      summary: "다른 observation",
      destinations: ["busan"],
    });
    const c = buildTopicFingerprint({
      title: "부산 출발 크루즈 가족여행 반응 증가",
      summary: "또 다른 관측",
      destinations: ["busan"],
    });
    expect(a.topicFingerprint).toBe(b.topicFingerprint);
    expect(b.topicFingerprint).toBe(c.topicFingerprint);
  });

  it("exact topic repeat penalized; material update distinguished", () => {
    const cand = makeCandidate({ sourceFingerprint: "src:meta_new_obs" });
    const prior = createReservoirItemFromQualified(
      makeCandidate({ sourceFingerprint: "src:meta_old_obs", observedAt: "2026-09-10T01:00:00.000Z" }),
      "2026-09-10T01:00:00.000Z",
    );
    prior.seenCount = 2;
    prior.topicFingerprint = cand.provenance.topicFingerprint;
    prior.storySeedFingerprint = buildStorySeedFingerprint(cand.editorial.marketingStorySeedKo);

    const repeat = assessAgendaReuse({
      candidate: {
        agendaId: cand.agendaId,
        sourceFingerprint: cand.provenance.sourceFingerprint,
        topicFingerprint: cand.provenance.topicFingerprint,
        decisionAxisFingerprint: cand.provenance.decisionAxisFingerprint,
        storySeedFingerprint: prior.storySeedFingerprint,
        signalSummaryKo: cand.signalContext.signalSummaryKo,
        whyNowKo: cand.editorial.whyNowKo,
      },
      history: [toMemorySnapshot(prior)],
      nowIso: NOW,
    });
    expect(repeat.kind).toBe("TOPIC_REPEAT");
    expect(repeat.reusePenalty).toBeGreaterThan(0.2);

    expect(
      detectMaterialUpdate({
        previousSummary: "항공 노선 신규 취항",
        newSummary: "항공 노선 취항 지연 발표",
      }),
    ).toBe(true);

    const updated = assessAgendaReuse({
      candidate: {
        sourceFingerprint: "src:route_delay",
        topicFingerprint: prior.topicFingerprint,
        decisionAxisFingerprint: "da_other",
        storySeedFingerprint: "ss_other",
        signalSummaryKo: "노선 취항 지연 발표",
        whyNowKo: "일정이 변경되었다",
      },
      history: [
        {
          ...toMemorySnapshot(prior),
          signalSummaryKo: "항공 노선 신규 취항",
          whyNowKo: "신규 취항",
        },
      ],
      nowIso: NOW,
    });
    expect(updated.kind).toBe("UPDATED_SIGNAL");
    expect(updated.reusePenalty).toBeLessThan(repeat.reusePenalty);
  });

  it("decision-axis repeat recognized across destinations", () => {
    const baliAxis = deriveDecisionAxisId({
      decisionAtStakeKo: "stay inside resort vs explore outside",
      audienceTensionKo: "convenience vs experience",
    });
    const pqAxis = deriveDecisionAxisId({
      decisionAtStakeKo: "숙소를 리조트 안에 둘지 외부 관광 접근성에 둘지",
      audienceTensionKo: "편의 vs 경험",
    });
    expect(baliAxis).toBe("resort_location_fit");
    expect(pqAxis).toBe("resort_location_fit");
    expect(buildDecisionAxisFingerprint({ decisionAtStakeKo: "숙소 위치 판단", audienceTensionKo: "외부 관광" })).toBe(
      "da_resort_location_fit",
    );
  });
});

describe("AGENDA_QUALITY_V2 Phase2 decay", () => {
  it("breaking decays faster than timely; seasonal; evergreen slowest", () => {
    const observedAt = "2026-09-10T01:00:00.000Z";
    const breaking = computeFreshnessDecayScore({
      freshnessClass: "breaking",
      observedAt,
      nowIso: NOW,
    });
    const timely = computeFreshnessDecayScore({
      freshnessClass: "timely",
      observedAt,
      nowIso: NOW,
    });
    const seasonal = computeFreshnessDecayScore({
      freshnessClass: "seasonal",
      observedAt,
      nowIso: NOW,
    });
    const evergreen = computeFreshnessDecayScore({
      freshnessClass: "evergreen",
      observedAt,
      nowIso: NOW,
    });
    expect(breaking).toBeLessThan(timely);
    expect(timely).toBeLessThan(seasonal);
    expect(seasonal).toBeLessThan(evergreen);
  });

  it("presentation fatigue increases with count", () => {
    const first = computePresentationFatiguePenalty({
      presentedCount: 0,
      lastPresentedAt: null,
      nowIso: NOW,
    });
    const second = computePresentationFatiguePenalty({
      presentedCount: 1,
      lastPresentedAt: "2026-09-15T01:00:00.000Z",
      nowIso: NOW,
    });
    const third = computePresentationFatiguePenalty({
      presentedCount: 3,
      lastPresentedAt: "2026-09-15T01:00:00.000Z",
      nowIso: NOW,
    });
    expect(first).toBe(0);
    expect(second).toBeGreaterThan(0);
    expect(third).toBeGreaterThan(second);
  });
});

describe("AGENDA_QUALITY_V2 Phase2 scoring + gate", () => {
  it("newsworthy but generic candidate fails; strong decision-oriented passes", () => {
    const generic = makeCandidate({
      title: "새 호텔이 오픈했다",
      credibility: 0.95,
      freshness: 0.95,
      llm: {
        targetTravelerKo: "관광객",
        travelerProblemKo: "새 호텔이 오픈했다",
        decisionAtStakeKo: "새 호텔이 오픈했다",
        audienceTensionKo: "관심이 높다",
        readerPayoffKo: "여행 계획에 참고",
        marketingStorySeedKo: "새 호텔이 오픈했다",
        researchQuestionsKo: [],
        storyArchetypeHint: "other",
      },
    });
    const genericScore = scoreMarketingAgendaV2({
      candidate: generic,
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
      nowIso: NOW,
      originalTitle: "새 호텔이 오픈했다",
    });
    expect(isAgendaV2SlateEligible(genericScore.qualityTier)).toBe(false);

    const strong = makeCandidate();
    const strongScore = scoreMarketingAgendaV2({
      candidate: strong,
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
      nowIso: NOW,
    });
    expect(isAgendaV2SlateEligible(strongScore.qualityTier)).toBe(true);
    expect(strongScore.marketingQualityScore).toBeGreaterThan(strongScore.signalQualityScore * 0.5);
  });

  it("reuse penalty lowers effective score/tier pressure", () => {
    const strong = makeCandidate();
    const novel = scoreMarketingAgendaV2({
      candidate: strong,
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
      nowIso: NOW,
    });
    const reused = scoreMarketingAgendaV2({
      candidate: strong,
      reuse: {
        kind: "TOPIC_REPEAT",
        topicRepeat: true,
        decisionRepeat: true,
        storySeedRepeat: true,
        materialUpdate: false,
        matchedAgendaId: "x",
        matchedStatus: "DEFERRED",
        daysSinceFirstSeen: 3,
        priorSeenCount: 3,
        reusePenalty: 0.7,
        staleTrendPenalty: 0.55,
        decisionAxisRepeatPenalty: 0.2,
        notes: [],
      },
      nowIso: NOW,
      presentedCount: 3,
      lastPresentedAt: "2026-09-15T01:00:00.000Z",
    });
    expect(reused.totalScore).toBeLessThan(novel.totalScore);
  });
});

describe("AGENDA_QUALITY_V2 Phase2 reservoir + slate", () => {
  it("deferred survives next-day pool; selected/rejected/expired excluded", () => {
    let deferred = createReservoirItemFromQualified(makeCandidate({ sourceFingerprint: "d1" }), "2026-09-14T01:00:00.000Z");
    deferred = markReservoirPresented(deferred, "2026-09-14T01:00:00.000Z");
    deferred = markReservoirDeferred(deferred, "2026-09-14T01:00:00.000Z");
    expect(isReservoirEligibleForFutureSlate(deferred, NOW)).toBe(true);

    let selected = createReservoirItemFromQualified(makeCandidate({ sourceFingerprint: "s1" }), NOW);
    selected = markReservoirPresented(selected, NOW);
    selected = markReservoirSelected(selected, NOW);
    expect(isReservoirEligibleForFutureSlate(selected, NOW)).toBe(false);

    let rejected = createReservoirItemFromQualified(makeCandidate({ sourceFingerprint: "r1" }), NOW);
    rejected = markReservoirRejected(rejected, NOW);
    expect(isReservoirEligibleForFutureSlate(rejected, NOW)).toBe(false);

    let expired = createReservoirItemFromQualified(
      makeCandidate({ sourceFingerprint: "e1" }),
      NOW,
    );
    expired = { ...expired, expiresAt: "2026-09-01T00:00:00.000Z" };
    expired = applyReservoirExpiryIfNeeded(expired, NOW);
    expect(expired.status).toBe("EXPIRED");
    expect(isReservoirEligibleForFutureSlate(expired, NOW)).toBe(false);
  });

  it("strong deferred can beat weak new; max 6 min 0 no weak backfill", () => {
    let deferred = createReservoirItemFromQualified(
      makeCandidate({ sourceFingerprint: "strong_def" }),
      "2026-09-10T01:00:00.000Z",
    );
    deferred = markReservoirPresented(deferred, "2026-09-10T01:00:00.000Z");
    deferred = markReservoirDeferred(deferred, "2026-09-10T01:00:00.000Z");

    const weakNew = createReservoirItemFromQualified(
      makeCandidate({
        title: "관광 성장 소식",
        sourceFingerprint: "weak_new",
        llm: {
          targetTravelerKo: "관광객",
          travelerProblemKo: "여행자들의 관심이 높다",
          decisionAtStakeKo: "최신 정보를 확인",
          audienceTensionKo: "관심 증가",
          readerPayoffKo: "여행 계획에 참고",
          marketingStorySeedKo: "관광 성장 소식",
          researchQuestionsKo: [],
          storyArchetypeHint: "other",
        },
      }),
      NOW,
    );

    const slate = selectDailyAgendaSlateV2({
      businessDateKst: "2026-09-16",
      nowIso: NOW,
      newlyQualified: [weakNew],
      reservoirItems: [deferred, weakNew],
    });

    expect(slate.max).toBe(6);
    expect(slate.min).toBe(0);
    expect(slate.forceFill).toBe(false);
    expect(slate.weakBackfill).toBe(false);
    expect(slate.selected.length).toBeGreaterThanOrEqual(1);
    expect(slate.selected.length).toBeLessThanOrEqual(6);
    expect(slate.selected.some((s) => s.item.agendaId === deferred.agendaId)).toBe(true);
    expect(slate.selected.every((s) => isAgendaV2SlateEligible(s.score.qualityTier))).toBe(true);
    expect(slate.rejected.some((r) => r.agendaId === weakNew.agendaId)).toBe(true);
  });

  it("decision diversity soft-applied; no artificial source quota", () => {
    const items = [1, 2, 3, 4, 5, 6, 7].map((i) =>
      createReservoirItemFromQualified(
        makeCandidate({
          sourceFingerprint: `src_axis_${i}`,
          title: `숙소 위치 이슈 ${i}`,
          llm: {
            decisionAtStakeKo: "숙소를 리조트 클러스터에 둘지 관광 접근성에 둘지",
            audienceTensionKo: "편의 vs 경험",
            travelerProblemKo: "숙소 위치를 어떻게 판단해야 하는가?",
            marketingStorySeedKo: `숙소 위치 판단 시드 ${i}`,
            researchQuestionsKo: ["구역?", "이동?"],
          },
        }),
        NOW,
      ),
    );
    const slate = selectDailyAgendaSlateV2({
      businessDateKst: "2026-09-16",
      nowIso: NOW,
      newlyQualified: items,
      reservoirItems: items,
    });
    expect(slate.selected.length).toBeLessThanOrEqual(6);
    // Soft diversity may reject extras of same axis
    expect(slate.selected.length + slate.rejected.length).toBeGreaterThanOrEqual(items.length);
  });
});

describe("AGENDA_QUALITY_V2 Phase2 shadow + backtest", () => {
  it("shadow disabled → no report; enabled → comparison only", async () => {
    const off = await runAgendaQualityV2ShadowPhase2({
      businessDateKst: "2026-09-16",
      nowIso: NOW,
      newlyQualifiedCandidates: [makeCandidate()],
      env: {},
    });
    expect(off.enabled).toBe(false);
    expect(off.productionSlateUnchanged).toBe(true);

    const on = await runAgendaQualityV2ShadowPhase2({
      businessDateKst: "2026-09-16",
      nowIso: NOW,
      newlyQualifiedCandidates: [makeCandidate()],
      v1Slate: [{ rank: 1, title: "푸꾸옥 호텔 공급 증가", source: "news" }],
      env: { AGENDA_QUALITY_V2_SHADOW_ENABLED: "true" },
      reservoir: createInMemoryDurableAgendaReservoir(),
    });
    expect(on.enabled).toBe(true);
    if (!on.enabled) return;
    expect(on.productionSlateUnchanged).toBe(true);
    expect(on.comparison.contract).toBe("agenda-quality-v2-comparison-report");
    expect(on.comparisonMarkdown).toContain("V2 Slate");
  });

  it("historical backtest runs without LLM", async () => {
    const result = await runAgendaQualityV2Backtest();
    expect(result.contract).toBe("agenda-quality-v2-backtest");
    expect(result.fromDate).toBe("2026-09-08");
    expect(result.toDate).toBe("2026-09-16");
    expect(result.days.length).toBe(9);
    expect(result.days.every((d) => d.v2Count <= 6)).toBe(true);
  });

  it("supersede evidence helper for same-topic material update", () => {
    const older = createReservoirItemFromQualified(
      makeCandidate({
        sourceFingerprint: "old",
        observedAt: "2026-09-10T01:00:00.000Z",
        llm: { signalSummaryKo: "항공 노선 신규 취항", whyNowKo: "취항" },
      }),
      "2026-09-10T01:00:00.000Z",
    );
    const newer = createReservoirItemFromQualified(
      makeCandidate({
        sourceFingerprint: "new",
        observedAt: NOW,
        llm: { signalSummaryKo: "항공 노선 취항 지연 발표", whyNowKo: "지연" },
      }),
      NOW,
    );
    newer.topicFingerprint = older.topicFingerprint;
    const evidence = evaluateSupersedeEvidence({ older, newer });
    expect(evidence.shouldSupersede).toBe(true);
  });
});
