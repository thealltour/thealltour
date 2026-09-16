import { createInMemoryDurableAgendaReservoir } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { createReservoirItemFromQualified } from "@/lib/marketing/agendaQualityV2/reservoir/types";
import {
  markReservoirDeferred,
  markReservoirPresented,
} from "@/lib/marketing/agendaQualityV2/reservoir/transitions";
import { selectDailyAgendaSlateV2 } from "@/lib/marketing/agendaQualityV2/slate/selectDailySlateV2";
import { buildV1V2ComparisonReport } from "@/lib/marketing/agendaQualityV2/shadow/comparisonReport";
import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import { assembleMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/transformer/transform";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";

export type BacktestDayFixture = {
  businessDateKst: string;
  nowIso: string;
  /** Mocked transformed candidates for the day (no LLM). */
  candidates: MarketingAgendaCandidateV2[];
  v1Titles?: string[];
};

export type AgendaQualityV2BacktestResult = {
  contract: "agenda-quality-v2-backtest";
  fromDate: string;
  toDate: string;
  days: Array<{
    businessDateKst: string;
    v2Count: number;
    rejectedCount: number;
    deferredCarryoverCount: number;
    comparisonContract: "agenda-quality-v2-comparison-report";
  }>;
};

function llm(partial: Partial<MarketingAgendaTransformerLlmOutput>): MarketingAgendaTransformerLlmOutput {
  return {
    targetTravelerKo: partial.targetTravelerKo ?? "한국인 여행자",
    travelerProblemKo: partial.travelerProblemKo ?? "무엇을 어떻게 판단해야 하는가?",
    decisionAtStakeKo: partial.decisionAtStakeKo ?? "선택 A vs 선택 B를 어떻게 결정할지",
    audienceTensionKo: partial.audienceTensionKo ?? "편의 vs 경험의 트레이드오프",
    readerPayoffKo: partial.readerPayoffKo ?? "본인 조건에 맞는 판단 기준을 얻는다",
    marketingStorySeedKo: partial.marketingStorySeedKo ?? "이 신호에서 여행자는 무엇을 결정해야 할까?",
    whyNowKo: partial.whyNowKo ?? "관측된 신호가 의사결정 시점을 앞당길 수 있다",
    researchQuestionsKo: partial.researchQuestionsKo ?? ["근거는?", "조건이 바뀌면?"],
    nonGoalsKo: partial.nonGoalsKo ?? ["가격 단정"],
    genericRiskKo: partial.genericRiskKo ?? "가설 유지",
    storyArchetypeHint: partial.storyArchetypeHint ?? "tradeoff",
    freshnessClass: partial.freshnessClass ?? "timely",
    signalSummaryKo: partial.signalSummaryKo,
    limitations: partial.limitations ?? ["미확인 사실 단정 금지"],
  };
}

/** Fixture factory for 2026-09-08..16 style mechanical backtest (no LLM). */
export function buildDefaultPhase2BacktestFixtures(): BacktestDayFixture[] {
  const days: BacktestDayFixture[] = [];
  const base = [
    {
      date: "2026-09-08",
      title: "부산 출발 가족 크루즈 활동 콘텐츠 관측",
      obs: "obs_cruise_1",
      llm: llm({
        targetTravelerKo: "부산 출발 가족 여행 기획자",
        travelerProblemKo: "가족 일정·예산·체력을 감안할 때 크루즈가 맞는지 어떻게 판단할까?",
        decisionAtStakeKo: "크루즈 vs 육상 패키지 중 무엇을 우선 검토할지",
        audienceTensionKo: "한 번에 움직이는 편의 vs 일정 유연성",
        readerPayoffKo: "우리 가족 적합 여부를 걸러내는 체크포인트를 얻는다",
        marketingStorySeedKo: "부산 출발 가족 크루즈, 우리 가족은 무엇을 먼저 확인해야 할까?",
        storyArchetypeHint: "cruise_family_fit",
        signalSummaryKo: "부산 가족 크루즈 메타 관측",
      }),
    },
    {
      date: "2026-09-09",
      title: "부모님과 부산발 크루즈가 뜬다",
      obs: "obs_cruise_2",
      llm: llm({
        targetTravelerKo: "부산 출발 가족 여행 기획자",
        travelerProblemKo: "가족 일정·예산·체력을 감안할 때 크루즈가 맞는지 어떻게 판단할까?",
        decisionAtStakeKo: "크루즈 vs 육상 패키지 중 무엇을 우선 검토할지",
        audienceTensionKo: "한 번에 움직이는 편의 vs 일정 유연성",
        readerPayoffKo: "우리 가족 적합 여부를 걸러내는 체크포인트를 얻는다",
        marketingStorySeedKo: "부산발 가족 크루즈 반응, 적합 판단 기준은?",
        storyArchetypeHint: "cruise_family_fit",
        signalSummaryKo: "부산 가족 크루즈 메타 관측 반복",
      }),
    },
    {
      date: "2026-09-10",
      title: "베트남 9.9 프로모 트렌드",
      obs: "obs_vn99_1",
      llm: llm({
        targetTravelerKo: "가성비 중시 베트남 단기 여행자",
        travelerProblemKo: "프로모 가격이 실제 총비용·일정 제약 대비 이득인지 어떻게 판단할까?",
        decisionAtStakeKo: "프로모 패키지 즉시 예약 vs 조건 확인 후 대기",
        audienceTensionKo: "할인 매력 vs 숨은 제약/일정 경직",
        readerPayoffKo: "프로모가 '이득'인지 걸러낼 체크리스트를 얻는다",
        marketingStorySeedKo: "베트남 9.9 프로모, 가격 전에 무엇을 확인해야 할까?",
        storyArchetypeHint: "promo_value_vs_constraints",
        signalSummaryKo: "베트남 9.9 프로모 관측",
      }),
    },
    {
      date: "2026-09-11",
      title: "베트남 9.9 할인 또 관측",
      obs: "obs_vn99_2",
      llm: llm({
        targetTravelerKo: "가성비 중시 베트남 단기 여행자",
        travelerProblemKo: "프로모 가격이 실제 총비용·일정 제약 대비 이득인지 어떻게 판단할까?",
        decisionAtStakeKo: "프로모 패키지 즉시 예약 vs 조건 확인 후 대기",
        audienceTensionKo: "할인 매력 vs 숨은 제약/일정 경직",
        readerPayoffKo: "프로모가 '이득'인지 걸러낼 체크리스트를 얻는다",
        marketingStorySeedKo: "베트남 9.9 할인 재관측, 조건은 그대로일까?",
        storyArchetypeHint: "promo_value_vs_constraints",
        signalSummaryKo: "베트남 9.9 프로모 관측 반복",
      }),
    },
    {
      date: "2026-09-12",
      title: "웰니스 에코투어리즘 관심",
      obs: "obs_well_1",
      llm: llm({
        targetTravelerKo: "휴식형 장년 여행자",
        travelerProblemKo: "웰니스·에코 상품이 실제 일정/체력에 맞는지 어떻게 고를까?",
        decisionAtStakeKo: "웰니스 리조트 집중 vs 일반 관광 혼합",
        audienceTensionKo: "회복 목적 vs 관광 밀도",
        readerPayoffKo: "본인에게 맞는 웰니스 비중을 정할 기준을 얻는다",
        marketingStorySeedKo: "웰니스 에코 관심 증가, 일정에서 무엇을 줄여야 할까?",
        storyArchetypeHint: "who_is_it_for",
        signalSummaryKo: "웰니스 에코 관측",
      }),
    },
    {
      date: "2026-09-13",
      title: "웰니스 에코투어리즘 관심",
      obs: "obs_well_2",
      llm: llm({
        targetTravelerKo: "휴식형 장년 여행자",
        travelerProblemKo: "웰니스·에코 상품이 실제 일정/체력에 맞는지 어떻게 고를까?",
        decisionAtStakeKo: "웰니스 리조트 집중 vs 일반 관광 혼합",
        audienceTensionKo: "회복 목적 vs 관광 밀도",
        readerPayoffKo: "본인에게 맞는 웰니스 비중을 정할 기준을 얻는다",
        marketingStorySeedKo: "웰니스 에코 재관측, 일정 비중은?",
        storyArchetypeHint: "who_is_it_for",
        signalSummaryKo: "웰니스 에코 관측 반복",
      }),
    },
    {
      date: "2026-09-14",
      title: "FCDO 국가 주의보 라벨",
      obs: "obs_fcdo_1",
      llm: llm({
        targetTravelerKo: "출국 직전 자유여행자",
        travelerProblemKo: "공식 주의 정보가 내 일정·보험·환불 조건에 어떤 결정을 강제하는가?",
        decisionAtStakeKo: "일정 유지 vs 일정 조정/보험 강화",
        audienceTensionKo: "여행 강행 vs 리스크 회피 비용",
        readerPayoffKo: "주의보가 '취소 사유'인지 '준비 강화'인지 판단한다",
        marketingStorySeedKo: "공식 주의 정보, 출국 직전 여행자는 무엇을 바꿔야 할까?",
        storyArchetypeHint: "before_you_book",
        freshnessClass: "breaking",
        signalSummaryKo: "FCDO/공식 주의 라벨 신호",
      }),
    },
    {
      date: "2026-09-15",
      title: "푸꾸옥 호텔 공급 증가",
      obs: "obs_hotel_1",
      llm: llm({
        // Intentionally weak decision frame for gate test — still has some lexicon
        targetTravelerKo: "관광객",
        travelerProblemKo: "푸꾸옥 호텔 공급 증가",
        decisionAtStakeKo: "푸꾸옥 호텔 공급 증가",
        audienceTensionKo: "관심 증가",
        readerPayoffKo: "여행 계획에 참고",
        marketingStorySeedKo: "푸꾸옥 호텔 공급 증가",
        storyArchetypeHint: "other",
        researchQuestionsKo: [],
        signalSummaryKo: "푸꾸옥 호텔 공급 증가",
      }),
    },
    {
      date: "2026-09-16",
      title: "약한 신규 뉴스 vs 강한 deferred",
      obs: "obs_weak_new",
      llm: llm({
        targetTravelerKo: "일반 여행자",
        travelerProblemKo: "관광객에게 유용한 최신 정보",
        decisionAtStakeKo: "최신 정보를 확인",
        audienceTensionKo: "여행자들의 관심이 높다",
        readerPayoffKo: "여행 계획에 참고",
        marketingStorySeedKo: "관광 성장 소식",
        storyArchetypeHint: "other",
        researchQuestionsKo: [],
        signalSummaryKo: "약한 신규 뉴스",
      }),
    },
  ] as const;

  for (const d of base) {
    const candidate = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: d.title,
        originalSummary: d.title,
        sourceTypes: d.obs.startsWith("obs_cruise") || d.obs.includes("vn99") || d.obs.includes("well")
          ? ["meta_trend"]
          : d.obs.includes("fcdo")
            ? ["official"]
            : ["news"],
        destinations: d.title.includes("부산")
          ? ["busan"]
          : d.title.includes("푸꾸옥")
            ? ["phu_quoc"]
            : d.title.includes("베트남")
              ? ["vietnam"]
              : [],
        topics: [],
        sourceFingerprint: `src:${d.obs}`,
        sourceCredibility: 0.7,
        sourceFreshness: 0.8,
        koreanTravelerRelevance: 0.7,
        observedAt: `${d.date}T01:00:00.000Z`,
      },
      llm: d.llm,
      nowIso: `${d.date}T01:00:00.000Z`,
    });
    days.push({
      businessDateKst: d.date,
      nowIso: `${d.date}T01:00:00.000Z`,
      candidates: [candidate],
      v1Titles: [d.title],
    });
  }

  // Inject a strong deferred competitor on 2026-09-16 via earlier day carry — handled in runner
  return days;
}

/**
 * Deterministic/mocked backtest over fixture days. No LLM / no external APIs.
 */
export async function runAgendaQualityV2Backtest(params?: {
  fixtures?: BacktestDayFixture[];
  /** Extra strong agenda introduced early and deferred for later competition */
  strongDeferredSeed?: MarketingAgendaCandidateV2;
}): Promise<AgendaQualityV2BacktestResult> {
  const fixtures = params?.fixtures ?? buildDefaultPhase2BacktestFixtures();
  const reservoir = createInMemoryDurableAgendaReservoir();

  if (params?.strongDeferredSeed) {
    let item = createReservoirItemFromQualified(params.strongDeferredSeed, fixtures[0]?.nowIso);
    item = markReservoirPresented(item, fixtures[0]?.nowIso);
    item = markReservoirDeferred(item, fixtures[0]?.nowIso);
    await reservoir.upsert(item);
  } else {
    // Default strong deferred: resort location decision
    const strong = assembleMarketingAgendaCandidateV2({
      input: {
        originalTitle: "리조트 위치 선택 이슈",
        originalSummary: "리조트 선택지 증가에 따른 위치 판단",
        sourceTypes: ["news"],
        destinations: ["phu_quoc"],
        sourceFingerprint: "src:strong_deferred",
        sourceCredibility: 0.75,
        sourceFreshness: 0.6,
        koreanTravelerRelevance: 0.8,
        observedAt: "2026-09-08T01:00:00.000Z",
      },
      llm: llm({
        targetTravelerKo: "외부 관광이 많은 푸꾸옥 여행자",
        travelerProblemKo:
          "리조트 선택지가 늘어날수록 외부 관광이 많은 여행자는 숙소 위치를 어떻게 판단해야 하는가?",
        decisionAtStakeKo: "숙소를 리조트 클러스터에 둘지, 관광 접근성 구역에 둘지",
        audienceTensionKo: "편의·부대시설 집중 vs 이동시간·현지 동선 효율",
        readerPayoffKo: "본인 스타일에 맞는 숙소 위치 판단 기준을 세운다",
        marketingStorySeedKo: "호텔 공급이 늘어난 지금, 숙소 위치는 무엇으로 고를까?",
        storyArchetypeHint: "convenience_vs_experience",
        researchQuestionsKo: ["신규 공급 구역은?", "이동 수단은?"],
        signalSummaryKo: "리조트 위치 판단 Agenda",
      }),
      nowIso: "2026-09-08T01:00:00.000Z",
    });
    let item = createReservoirItemFromQualified(strong, "2026-09-08T01:00:00.000Z");
    item = markReservoirPresented(item, "2026-09-08T01:00:00.000Z");
    item = markReservoirDeferred(item, "2026-09-08T01:00:00.000Z");
    await reservoir.upsert(item);
  }

  const dayResults: AgendaQualityV2BacktestResult["days"] = [];

  for (const day of fixtures) {
    const newly = [];
    for (const c of day.candidates) {
      const item = createReservoirItemFromQualified(c, day.nowIso);
      newly.push(item);
      await reservoir.upsert(item);
    }
    const all = await reservoir.list();
    const slate = selectDailyAgendaSlateV2({
      businessDateKst: day.businessDateKst,
      nowIso: day.nowIso,
      newlyQualified: newly,
      reservoirItems: all,
    });
    const comparison = buildV1V2ComparisonReport({
      businessDateKst: day.businessDateKst,
      generatedAt: day.nowIso,
      v1: (day.v1Titles ?? []).map((title, i) => ({
        rank: i + 1,
        title,
        source: "v1_fixture",
      })),
      v2Slate: slate,
    });

    // Shadow lifecycle: presented → deferred for selected
    for (const row of slate.selected) {
      let item = row.item;
      if (item.status === "QUALIFIED" || item.status === "DEFERRED") {
        try {
          item = markReservoirPresented(item, day.nowIso);
          item = markReservoirDeferred(item, day.nowIso);
          await reservoir.upsert(item);
        } catch {
          // already transitioned
        }
      }
    }

    dayResults.push({
      businessDateKst: day.businessDateKst,
      v2Count: slate.selected.length,
      rejectedCount: slate.rejected.length,
      deferredCarryoverCount: comparison.deferredResurfaced.length,
      comparisonContract: "agenda-quality-v2-comparison-report",
    });
  }

  return {
    contract: "agenda-quality-v2-backtest",
    fromDate: fixtures[0]?.businessDateKst ?? "",
    toDate: fixtures[fixtures.length - 1]?.businessDateKst ?? "",
    days: dayResults,
  };
}
