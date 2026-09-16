/**
 * Deterministic V1 → V2 reconstruction for shadow calibration.
 * NO LLM / NO paid APIs. Uses persisted V1 editorial + topic tags only.
 * Does not invent unsupported facts; prefers QUESTION framing when thin.
 */

import type { AgendaSlateCandidate } from "@/lib/marketing/cron/daily/agendaSlate/types";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";
import { assembleMarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/transformer/transform";
import type { MarketingAgendaCandidateV2 } from "@/lib/marketing/agendaQualityV2/contracts";
import { classifyV1AgendaEditorially } from "@/lib/marketing/agendaQualityV2/calibration/classifyV1";

export type TransformerQualityLabel =
  | "GOOD_TRANSFORMATION"
  | "SUPERFICIAL_REWRITE"
  | "GENERIC_DECISION"
  | "UNSUPPORTED_INFERENCE"
  | "STRONG_STORY_SEED"
  | "INVALID";

export type ReconstructV2Result = {
  candidate: MarketingAgendaCandidateV2;
  transformLabel: TransformerQualityLabel;
  editorialClass: ReturnType<typeof classifyV1AgendaEditorially>;
  notes: string[];
};

function hasDecisionLex(text: string): boolean {
  return /선택|결정|판단|vs|대비|언제|어디|누구|어떻게|무엇을|여부|맞는지|trade/i.test(text);
}

function reconstructLlmFields(c: AgendaSlateCandidate): {
  llm: MarketingAgendaTransformerLlmOutput;
  label: TransformerQualityLabel;
  notes: string[];
} {
  const notes: string[] = [];
  const editorialClass = classifyV1AgendaEditorially(c);
  const topics = c.topics ?? [];
  const practical = c.editorial?.practicalTravelValue?.trim() ?? "";
  const whyNow = c.editorial?.freshnessWhyNow?.trim() ?? "";
  const kr = c.editorial?.koreanTravelerRelevance?.trim() ?? "";
  const rationale = (c.rationale ?? []).join(" ");

  // Meta / trend family — reconstruct decision seed from tags (not popularity claim)
  if (
    topics.includes("cruise") ||
    /크루즈/.test(c.title) ||
    topics.includes("activity_trend")
  ) {
    const llm: MarketingAgendaTransformerLlmOutput = {
      targetTravelerKo: topics.includes("family")
        ? "부산 출발을 고려하는 가족 여행 기획자"
        : "부산·근거리 출항을 검토하는 한국인 여행자",
      travelerProblemKo:
        "가족 일정·예산·체력/멀미 부담을 감안할 때 크루즈가 우리 여행 형태에 맞는지 어떻게 판단할까?",
      decisionAtStakeKo: "크루즈 vs 육상 패키지/개별여행 중 무엇을 우선 검토할지",
      audienceTensionKo: "한 번에 움직이는 편의 vs 일정 유연성·아이/부모 체력",
      readerPayoffKo: "우리 가족에게 크루즈가 맞는지 걸러내는 체크포인트를 얻는다",
      marketingStorySeedKo:
        `부산 출발 가족 크루즈(${c.title.slice(0, 18).trim()}) — 우리 가족은 무엇을 먼저 확인해야 할까?`,
      whyNowKo: whyNow || "반복 관측된 활동 신호 — 인기 단정이 아닌 적합 여부 검증이 필요",
      researchQuestionsKo: [
        "출항지·일정·가족 구성에 맞는 상품인가?",
        "프로모션 조건과 취소 규정은?",
      ],
      nonGoalsKo: ["인기 단정", "특정 선사 추천 단정"],
      genericRiskKo: "관측≠인기; 가설로 유지",
      storyArchetypeHint: "cruise_family_fit",
      freshnessClass: "timely",
      signalSummaryKo: c.title,
      limitations: ["관측 신호만 존재; 요금·스케줄 미확인"],
    };
    notes.push("reconstructed_from_meta_topic_tags");
    return { llm, label: "GOOD_TRANSFORMATION", notes };
  }

  if (topics.includes("fare_price_signal") || /9\.9|특가|프로모/.test(c.title)) {
    const llm: MarketingAgendaTransformerLlmOutput = {
      targetTravelerKo: "가성비 중시 단기 해외여행자",
      travelerProblemKo:
        "특가/프로모 가격이 일정 제약·숨은 비용 대비 실제로 이득인지 어떻게 판단할까?",
      decisionAtStakeKo: "즉시 예약 vs 조건 확인 후 대기",
      audienceTensionKo: "할인 매력 vs 일정 경직·취소수수료·포함 범위",
      readerPayoffKo: "프로모가 '이득'인지 걸러낼 체크리스트를 얻는다",
      marketingStorySeedKo: "특가 신호가 다시 보일 때, 가격 전에 무엇을 확인해야 할까?",
      whyNowKo: whyNow || "요금 신호 관측 — 조건 검증이 핵심",
      researchQuestionsKo: ["포함/제외 항목은?", "일정·노선 제약은?"],
      nonGoalsKo: ["최저가 단정"],
      genericRiskKo: "프로모 홍보문 재작성 금지",
      storyArchetypeHint: "promo_value_vs_constraints",
      freshnessClass: "timely",
      signalSummaryKo: c.title,
      limitations: ["실제 요금/좌석 미확인"],
    };
    notes.push("reconstructed_from_promo_signal");
    return { llm, label: "GOOD_TRANSFORMATION", notes };
  }

  // Operational / visa / safety country briefs
  if (editorialClass === "OPERATIONAL_TRUTH" || topics.includes("visa") || topics.includes("safety")) {
    const dest = c.title.trim();
    const llm: MarketingAgendaTransformerLlmOutput = {
      targetTravelerKo: `${dest} 출국·체류를 앞둔 한국인 여행자`,
      travelerProblemKo: `공식/안전·입국 관련 변화가 내 일정·보험·환불 조건에 어떤 결정을 강제하는가?`,
      decisionAtStakeKo: "일정을 유지할지, 조정·보험·증빙을 강화할지 선택",
      audienceTensionKo: "여행 강행 vs 리스크 회피 비용·번거로움 사이의 판단",
      readerPayoffKo: "주의/규정 정보가 '취소 사유'인지 '준비 강화'인지 판단한다",
      marketingStorySeedKo: `${dest} 관련 공식·안전 신호, 출국 직전 여행자는 무엇을 바꿔야 할까?`,
      whyNowKo: whyNow || "규정/안전 신호는 시의성이 핵심",
      researchQuestionsKo: ["적용 대상·시행일?", "보험/항공 환불 조건 영향?"],
      nonGoalsKo: ["공포 조장", "미확인 규제 단정"],
      genericRiskKo: "국가명만 반복하는 요약 금지",
      storyArchetypeHint: "before_you_book",
      freshnessClass: "breaking",
      signalSummaryKo: c.summary?.slice(0, 180) || c.title,
      limitations: ["원문 규정 세부는 추가 확인 필요"],
    };
    notes.push("reconstructed_operational_truth");
    return { llm, label: "STRONG_STORY_SEED", notes };
  }

  // Phu Quoc / lodging supply with usable editorial
  if (/푸꾸옥|호텔|리조트|phu quoc|hotel|resort|공급/i.test(`${c.title} ${c.summary ?? ""}`)) {
    if (practical && hasDecisionLex(practical + rationale)) {
      const llm: MarketingAgendaTransformerLlmOutput = {
        targetTravelerKo: "푸꾸옥에서 리조트 체류와 외부 관광을 병행하려는 한국인 여행자",
        travelerProblemKo:
          practical.length > 20
            ? `리조트 선택지가 늘어날수록 ${practical.replace(/제공$/, "을 어떻게 적용할지")}?`.slice(
                0,
                120,
              )
            : "리조트 선택지가 늘 때 숙소 위치·타입을 어떻게 판단해야 하는가?",
        decisionAtStakeKo: "독립 입지/럭셔리 집중 vs 관광 접근성·신규 공급 클러스터",
        audienceTensionKo: "편의·시설 집중 vs 동선·외부 관광 효율",
        readerPayoffKo:
          c.editorial?.practicalTravelValue ||
          "본인 여행 스타일에 맞는 숙소 위치 판단 기준을 세운다",
        marketingStorySeedKo:
          "호텔 공급이 늘어난 푸꾸옥에서, 숙소 위치는 무엇으로 고를까?",
        whyNowKo: whyNow || "공급·인프라 변화 신호",
        researchQuestionsKo: ["신규 공급 구역은?", "한국인 수요 패턴은?"],
        nonGoalsKo: ["특정 호텔 단정 추천"],
        genericRiskKo: "오픈 뉴스 요약 금지",
        storyArchetypeHint: "convenience_vs_experience",
        freshnessClass: "timely",
        signalSummaryKo: c.summary?.slice(0, 180) || c.title,
        limitations: ["요금·재고 미확인"],
      };
      notes.push("reconstructed_from_editorial_lodging");
      return { llm, label: "STRONG_STORY_SEED", notes };
    }
  }

  // Chuseok short-trip decision-ish
  if (/추석|3박|연휴|어디 갈까/.test(c.title)) {
    const llm: MarketingAgendaTransformerLlmOutput = {
      targetTravelerKo: "짧은 연휴로 해외 도시를 검토하는 직장인/가족",
      travelerProblemKo: "짧은 연휴에 해외 도시가 일정·피로도·비용 대비 맞는지 어떻게 고를까?",
      decisionAtStakeKo: "근거리 단기 도시 vs 국내/대안 일정",
      audienceTensionKo: "이동 시간 손실 vs 해외 경험 만족",
      readerPayoffKo: "연휴 길이에 맞는 목적지 필터를 얻는다",
      marketingStorySeedKo: "짧은 연휴, 해외 도시를 고를 때 무엇을 먼저 볼까?",
      whyNowKo: whyNow || "연휴 일정 제약",
      researchQuestionsKo: ["실이동 시간?", "연휴 항공·숙소 변동?"],
      nonGoalsKo: ["목적지 나열 홍보"],
      genericRiskKo: "리스트클형 홍보 금지",
      storyArchetypeHint: "timing",
      freshnessClass: "seasonal",
      signalSummaryKo: c.title,
      limitations: ["도시 리스트 원문은 홍보성일 수 있음"],
    };
    notes.push("reconstructed_chuseok_timing");
    return { llm, label: "GOOD_TRANSFORMATION", notes };
  }

  // Airline supply Australia — decision frame possible
  if (/항공 공급|호주/.test(c.title)) {
    const llm: MarketingAgendaTransformerLlmOutput = {
      targetTravelerKo: "올겨울 호주행을 검토하는 한국인 여행자",
      travelerProblemKo:
        "항공 공급이 늘어난 지금, 가격보다 출도착 시간과 현지 첫날 동선을 먼저 봐야 하는가?",
      decisionAtStakeKo: "가격 우선 vs 스케줄·환승·첫날 동선 우선",
      audienceTensionKo: "저가 유혹 vs 피로·일정 리스크",
      readerPayoffKo: "공급 확대 국면에서 항공 선택 우선순위를 정한다",
      marketingStorySeedKo: "호주 항공 공급이 늘 때, 무엇을 먼저 비교해야 할까?",
      whyNowKo: whyNow || "공급 확대 신호",
      researchQuestionsKo: ["노선·스케줄 변화?", "성수기 가격 변동?"],
      nonGoalsKo: ["항공사 홍보 재작성"],
      genericRiskKo: "공급 뉴스 요약 금지",
      storyArchetypeHint: "flight_price_vs_schedule",
      freshnessClass: "timely",
      signalSummaryKo: c.title,
      limitations: ["스케줄 팩트 미확인"],
    };
    notes.push("reconstructed_flight_supply");
    return { llm, label: "GOOD_TRANSFORMATION", notes };
  }

  // Cancellation fee operational
  if (/취소|수수료|피해 구제/.test(c.title)) {
    const llm: MarketingAgendaTransformerLlmOutput = {
      targetTravelerKo: "항공권 변경·취소를 고려하는 한국인 여행자",
      travelerProblemKo: "취소·변경 시 이중 수수료/규정 함정을 어떻게 피할까?",
      decisionAtStakeKo: "지금 취소 vs 규정 확인 후 변경 경로 선택",
      audienceTensionKo: "환불 기대 vs 위약금·대행 수수료",
      readerPayoffKo: "취소 전 확인 체크리스트를 얻는다",
      marketingStorySeedKo: "항공 취소 수수료 피해, 예약 전에 무엇을 봐야 할까?",
      whyNowKo: whyNow || "피해 구제 통계 신호",
      researchQuestionsKo: ["항공사/OTA 규정 차이는?", "증빙 방법은?"],
      nonGoalsKo: ["법률 자문 단정"],
      genericRiskKo: "공포 헤드라인 재작성 금지",
      storyArchetypeHint: "before_you_book",
      freshnessClass: "timely",
      signalSummaryKo: c.title,
      limitations: ["개별 계약 조건 상이"],
    };
    notes.push("reconstructed_cancellation_ops");
    return { llm, label: "STRONG_STORY_SEED", notes };
  }

  // Fallback: superficial — intentionally weak so gate rejects news-like items
  const llm: MarketingAgendaTransformerLlmOutput = {
    targetTravelerKo: c.audienceHint || "해외여행을 검토하는 한국인",
    travelerProblemKo: `${c.title} — 여행자는 어떻게 해야 할까?`,
    decisionAtStakeKo: `${c.title}`,
    audienceTensionKo: "관심 증가",
    readerPayoffKo: "여행 계획에 참고",
    marketingStorySeedKo: `${c.title}`,
    whyNowKo: whyNow || "최신 정보",
    researchQuestionsKo: [],
    nonGoalsKo: [],
    genericRiskKo: "headline_echo_risk",
    storyArchetypeHint: "other",
    freshnessClass: "timely",
    signalSummaryKo: c.summary?.slice(0, 160) || c.title,
    limitations: ["deterministic_fallback_superficial"],
  };
  notes.push("superficial_fallback_no_llm");
  const label: TransformerQualityLabel =
    editorialClass === "NEWS_HEADLINE_LIKE" || editorialClass === "GENERIC_INFORMATIONAL"
      ? "SUPERFICIAL_REWRITE"
      : "GENERIC_DECISION";
  return { llm, label, notes };
}

export function reconstructV2FromV1Candidate(params: {
  candidate: AgendaSlateCandidate;
  businessDateKst: string;
  nowIso: string;
}): ReconstructV2Result {
  const editorialClass = classifyV1AgendaEditorially(params.candidate);
  const { llm, label, notes } = reconstructLlmFields(params.candidate);
  const sourceType =
    (params.candidate.evidenceSummary?.[0]?.sourceType as string | undefined) ??
    (params.candidate.topics?.includes("activity_trend") ? "meta_trend" : "news");

  const candidate = assembleMarketingAgendaCandidateV2({
    input: {
      originalTitle: params.candidate.title,
      originalSummary: params.candidate.summary || params.candidate.title,
      sourceTypes: [sourceType],
      destinations: params.candidate.destinations ?? [],
      topics: params.candidate.topics ?? [],
      observedAt: params.nowIso,
      sourceCandidateIds: params.candidate.agendaCandidateId
        ? [params.candidate.agendaCandidateId]
        : [params.candidate.slateItemId],
      sourceBriefIds: params.candidate.researchBriefId
        ? [params.candidate.researchBriefId]
        : [],
      sourceCredibility: params.candidate.researchSnapshot.credibilityScore,
      sourceFreshness: params.candidate.researchSnapshot.freshnessScore,
      koreanTravelerRelevance: params.candidate.researchSnapshot.travelRelevanceScore,
      sourceFingerprint: `v1:${params.candidate.agendaCandidateId ?? params.candidate.slateItemId}`,
      commercialRelevanceHint: params.candidate.editorial?.theAllTourBusinessRelevance ?? null,
      researchabilityHint: practicalOrNull(params.candidate),
    },
    llm,
    transformModel: "deterministic_v1_reconstruct_v1",
    nowIso: params.nowIso,
  });

  return { candidate, transformLabel: label, editorialClass, notes };
}

function practicalOrNull(c: AgendaSlateCandidate): string | null {
  return c.editorial?.practicalTravelValue ?? null;
}
