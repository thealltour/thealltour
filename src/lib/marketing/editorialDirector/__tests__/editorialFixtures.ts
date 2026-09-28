import type { DailyAgendaSlate, AgendaSlateCandidate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import {
  AGENDA_SLATE_CANDIDATE_CONTRACT,
  DAILY_AGENDA_SLATE_CONTRACT,
} from "@/lib/marketing/cron/daily/agendaSlate/types";
import { EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT } from "@/lib/marketing/editorialDirector/contracts";

export function slateItem(n: number, overrides: Partial<AgendaSlateCandidate> = {}): AgendaSlateCandidate {
  return {
    contract: AGENDA_SLATE_CANDIDATE_CONTRACT,
    slateItemId: `asc_${String(n).padStart(24, "a")}`,
    state: "AVAILABLE",
    origin: "organic_research",
    deferredFromBusinessDateKst: null,
    deferredFromSlateItemId: null,
    agendaCandidateId: `ac_${n}`,
    researchBriefId: `rb_${n}`,
    canonicalArticleIds: [],
    title: `베트남 닌빈 웰니스 후보 ${n}`,
    summary: `닌빈 숨은 성소와 한국 여행자 회복 욕구 연결 ${n}`,
    score: 0.7 + n * 0.01,
    scoreReasons: ["fresh"],
    destinations: ["베트남", "닌빈"],
    topics: ["웰니스", "휴양"],
    entities: ["닌빈"],
    audienceHint: "한국 여행자",
    rationale: ["MM 추천"],
    recommendedFormats: ["threads_text"],
    recommendedChannel: "threads",
    evidenceSummary: [
      {
        evidenceId: `ev_${n}`,
        sourceId: `src_${n}`,
        sourceName: "Vietnam Tourism RSS",
        sourceType: "rss",
        isOfficial: true,
        url: "https://example.com/ninh-binh",
        excerpt: "Ninh Binh sanctuary resorts",
      },
    ],
    matchedProductIds: [],
    riskFlags: [],
    editorial: {
      freshnessWhyNow: "최근 관측",
      koreanTravelerRelevance: "회복 욕구",
      practicalTravelValue: null,
      theAllTourBusinessRelevance: null,
      contentPotential: "story 확장 가능",
    },
    researchSnapshot: {
      freshnessScore: 0.8,
      credibilityScore: 0.7,
      travelRelevanceScore: 0.75,
      totalResearchScore: 0.78,
    },
    ...overrides,
  };
}

export function makeSlate(count = 6): DailyAgendaSlate {
  return {
    contract: DAILY_AGENDA_SLATE_CONTRACT,
    slateId: "das_test_hybrid",
    logicalRunKey: "daily-agenda:2026-09-15",
    businessDateKst: "2026-09-15",
    routineId: "daily-marketing",
    runId: "run_test",
    correlationId: "corr_test",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "ready_for_human_selection",
    targetSize: 6,
    researchStatus: "complete",
    degraded: false,
    candidates: Array.from({ length: count }, (_, i) => slateItem(i + 1)),
    cooldown: {
      days: 7,
      excludedAgendaCandidateIds: [],
      excludedBriefIds: [],
    },
    curation: { mode: "manager_curated", managerMessage: "test" },
    observability: {
      organicCount: count,
      deferredCarryoverCount: 0,
      availableCount: count,
      selectedTodayCount: 0,
    },
    metadata: {},
  };
}

export function validExternalPayload(agendaId: string) {
  return {
    contract: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
    agendaEvaluation: [
      {
        agendaId,
        overallRank: 1,
        marketingPotential: 82,
        koreanAudienceRelevance: 80,
        decisionUtility: 78,
        storyExpandability: 85,
        researchability: 70,
        businessRelevance: 60,
        channelPotential: {
          threads: 80,
          naverBlog: 70,
          naverBand: 55,
          kakaoChannel: 50,
          shortform: 75,
        },
        reasonKo: "회복 욕구와 의사결정 연결이 분명함",
        weaknessKo: "인과 비약 위험",
      },
    ],
    selectedAgenda: {
      agendaId,
      rank: 1,
      reasonKo: "한국 여행자 회복 욕구와 맞닿음",
      noneStrongEnough: false,
    },
    storyCandidates: [
      {
        externalStoryId: "ext_1",
        storyTitleKo: "닌빈은 스마트폰 피로의 해답인가",
        storyQuestionKo: "도시 피로를 푸려고 닌빈을 고르는 게 타당한가?",
        storyClaimKo: null,
        audienceProblemKo: "군중·스크린 피로",
        decisionAtStakeKo: "휴양지 선택",
        stakes: ["시간", "비용"],
        whyKoreanTravelerCaresKo: "짧은 휴가에 회복을 못 하면 손해가 큼",
        whyInterestingKo: "피로→닌빈 선택 인과가 흔하지만 증거가 약할 수 있음",
        audienceTensionKo: "유명 휴양 vs 고요한 회복 사이 갈등",
        curiosityGapKo: "실제로 한국 여행자가 닌빈을 회복 목적으로 고르는지 불명",
        readerPayoffKo: "회복 목적 여행지 판단 기준을 얻음",
        editorialArchetype: "worth_it_or_not",
        researchNeededKo: ["닌빈 wellness 수요 신호"],
        researchQuestionsKo: [
          "닌빈이 smartphone fatigue 대안으로 실제로 언급되는가?",
          "한국 여행자 후기에서 회복/고요함이 반복되는가?",
        ],
        recommendedChannels: ["threads", "naver_blog", "shortform"],
        channelReasonKo: "질문형 스레드 + 검색형 블로그",
        riskKo: "인과 비약",
        nonGoalsKo: ["베트남 전역 가이드"],
      },
      {
        externalStoryId: "ext_2",
        storyTitleKo: "누구에게 닌빈이 맞는가",
        storyQuestionKo: "부모님 동반이면 닌빈보다 다른 곳이 나을까?",
        storyClaimKo: null,
        audienceProblemKo: "가족 구성에 맞는 목적지 선택",
        decisionAtStakeKo: "가족 여행지 확정",
        stakes: ["이동 부담", "만족도"],
        whyKoreanTravelerCaresKo: "부모님 체력과 동선이 성패를 가름",
        whyInterestingKo: "성소 이미지와 실제 이동 난이도가 충돌할 수 있음",
        audienceTensionKo: "감성 성소 vs 접근성",
        curiosityGapKo: "가족 동반 후기에서 이동 불만이 반복되는지",
        readerPayoffKo: "가족 구성별 적합도 판단",
        editorialArchetype: "who_is_it_for",
        researchNeededKo: ["가족 동반 후기"],
        researchQuestionsKo: [
          "부모님 동반 닌빈 후기에서 이동 불편이 반복되는가?",
          "대안 목적지가 동일 니즈로 더 자주 추천되는가?",
        ],
        recommendedChannels: ["threads", "naver_band", "kakao_channel"],
        channelReasonKo: "가족 상담형",
        riskKo: "일반론",
        nonGoalsKo: ["호텔 랭킹"],
      },
    ],
  };
}
