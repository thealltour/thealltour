import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";

/** Shared Phase-5-aware LLM fixture (decision-oriented default). */
export function goodLlmEditorial(
  overrides?: Partial<MarketingAgendaTransformerLlmOutput>,
): MarketingAgendaTransformerLlmOutput {
  return {
    targetTravelerKo: "푸꾸옥에서 리조트 체류와 외부 관광을 병행하려는 한국인 여행자",
    travelerProblemKo:
      "리조트 선택지가 늘어날수록 외부 관광이 많은 여행자는 숙소 위치를 어떻게 판단해야 하는가?",
    decisionAtStakeKo: "숙소를 리조트 클러스터에 둘지, 관광 접근성이 좋은 구역에 둘지",
    audienceTensionKo: "편의·부대시설 집중 vs 이동시간·현지 동선 효율",
    readerPayoffKo: "본인 여행 스타일에 맞는 숙소 위치 판단 기준을 세울 수 있다",
    marketingStorySeedKo:
      "호텔 공급이 늘어난 지금, 외부 관광형 여행자는 숙소 위치를 무엇으로 고를까?",
    whyNowKo: "공급 확대 신호가 관측되어 위치 선택의 기준이 더 중요해질 수 있다",
    researchQuestionsKo: ["신규 공급이 어느 구역에 집중되는가?", "이동 수단 옵션은?"],
    nonGoalsKo: ["특정 호텔 추천", "가격 단정"],
    genericRiskKo: "공급 증가를 사실처럼 단정하지 않고 가설로 유지",
    storyArchetypeHint: "convenience_vs_experience",
    freshnessClass: "timely",
    signalSummaryKo: "푸꾸옥 호텔 공급 증가 관련 신호",
    limitations: ["정확한 객실 수·요금은 미확인"],
    editorialArchetype: "DECISION",
    whyInterestingKo:
      "호텔이 늘었다는 소식 자체보다, 내 동선에 맞는 숙소 위치가 달라질 수 있다는 점이 흥미롭다",
    curiosityHookKo: "리조트가 늘수록 어디에 묵느냐가 여행 체감을 더 가를 수 있다",
    hiddenDetailKo:
      "공급 증가의 표면 신호 뒤에서 구역별 관광 접근성·프라이빗함 차이가 놓치기 쉬운 포인트다",
    whyKoreanTravelerCaresKo:
      "한국 여행자가 푸꾸옥을 리조트 휴양지로 볼 때 숙소 위치가 일정 효율을 좌우한다",
    familiarReferenceKo: "전 객실 오션뷰·올인클루시브 중심의 익숙한 푸꾸옥 리조트 이미지",
    alternativeAppealKo: "리조트 밀집 구역 대신 이동이 쉬운 위치 선택지",
    explorationPayoffKo: "공급이 늘어난 구역과 내 일정에 맞는 숙소 위치를 더 비교해볼 수 있다",
    contentImaginabilityKo:
      "헤드라인(위치 선택) + 훅 + 구역 대비 2~3섹션 + 체크리스트 시각 구성이 바로 그려진다",
    ...overrides,
  };
}

/** Discovery / cultural fixture — no forced decision fields. */
export function goodDiscoveryLlm(
  overrides?: Partial<MarketingAgendaTransformerLlmOutput>,
): MarketingAgendaTransformerLlmOutput {
  return goodLlmEditorial({
    editorialArchetype: "DISCOVERY",
    storyArchetypeHint: "other",
    targetTravelerKo: "다낭·나트랑식 리조트 베트남에 익숙한 한국 여행자",
    travelerProblemKo: "",
    decisionAtStakeKo: "",
    audienceTensionKo: "",
    readerPayoffKo:
      "리조트 베트남과 다른 북부 전통마을 경험을 상상하고 더 알아보고 싶어진다",
    marketingStorySeedKo:
      "다낭·나트랑처럼 익숙한 베트남이 지겹다면, 랑선 소수민족 마을과 흙담집 여행은 어떨까?",
    whyNowKo: "북부 국경지대 전통 가옥·소수민족 생활문화 신호가 관측됨",
    whyInterestingKo:
      "흔히 떠올리는 해안 리조트 베트남과 다른, 북부 전통 가옥·소수민족 생활 장면이 있다",
    curiosityHookKo: "이런 베트남도 있었네 — 랑선의 흙담집과 소수민족 마을",
    hiddenDetailKo:
      "랑선 등 북부 국경지대에는 흙담집과 소수민족 생활문화가 남아 있다는 구체 포인트",
    whyKoreanTravelerCaresKo:
      "한국 여행자가 익숙한 다낭·나트랑 대안을 찾을 때 색다른 문화 여행 선택지로 호기심을 자극할 수 있는지 살펴볼 만하다",
    familiarReferenceKo: "다낭·나트랑 리조트 중심의 익숙한 베트남 이미지",
    alternativeAppealKo: "해안 휴양 대신 북부 전통마을·생활문화 탐방 대안",
    explorationPayoffKo:
      "어떤 문화적 특징이 있는지, 누구에게 색다른 대안이 될 수 있는지 더 찾아보게 된다",
    contentImaginabilityKo:
      "헤드라인(리조트 말고 이런 베트남) + 익숙한 대비 훅 + 흙담집/소수민족 2~3섹션 + 사진 포인트",
    researchQuestionsKo: [
      "랑선에서 실제로 볼 수 있는 전통 가옥·생활 장면은 무엇인가?",
      "한국 여행자가 익숙하게 느낄 문화적 요소가 실제로 있는가?",
    ],
    nonGoalsKo: ["보존 윤리 강의", "현지 부담 가치판단"],
    genericRiskKo: "학술·윤리 프레임으로 무게를 키우지 않음",
    signalSummaryKo: "베트남 북부 랑선 전통 가옥·소수민족 생활문화 신호",
    limitations: ["구체 일정·접근 방법은 미확인 — 연구 질문으로 유지"],
    ...overrides,
  });
}
