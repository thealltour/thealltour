import { MEDIA_BRIEF_CONTRACT, type MediaBrief } from "@/lib/marketing/assets/contracts";

export const CARDNEWS_VERIFICATION_CANDIDATE_ID = "dev-cardnews-a3-verification" as const;
export const CARDNEWS_VERIFICATION_BUSINESS_DATE = "2026-09-03" as const;

export function createCardNewsVerificationBrief(): MediaBrief {
  return {
    contract: MEDIA_BRIEF_CONTRACT,
    candidateId: CARDNEWS_VERIFICATION_CANDIDATE_ID,
    businessDateKst: CARDNEWS_VERIFICATION_BUSINESS_DATE,
    sourceChannel: "instagram",
    targetChannels: ["instagram"],
    contentIntent: "informational",
    audience: "가을 일본 여행을 준비하는 한국 여행객",
    coreMessage: "홋카이도 가을 여행 공식 안내가 바뀌었습니다.",
    factualClaims: [
      {
        factId: "claim-jnto",
        statement: "일본정부관광국이 가을 여행 안내를 업데이트했습니다.",
        evidenceRefs: ["ev-official"],
        confidence: "high",
      },
    ],
    evidenceRefs: [
      {
        evidenceId: "ev-official",
        sourceId: "src-official",
        sourceType: "official_government",
        sourceName: "일본정부관광국",
        isOfficial: true,
        evidenceType: "official_statement",
        url: "https://www.japan.travel/korea/",
        reference: null,
        excerpt: "가을 여행 안내가 업데이트되었습니다.",
        publishedAt: "2026-09-01T00:00:00.000Z",
        observedAt: "2026-09-02T00:00:00.000Z",
        credibilityHint: 0.9,
      },
    ],
    cta: "일정 확인 후 공식 안내를 다시 살펴보세요.",
    formats: {
      text: {
        enabled: true,
        title: "가을 홋카이도 안내",
        body: "공식 안내가 바뀌었습니다.",
      },
      cardnews: {
        enabled: true,
        aspectRatio: "4:5",
        cards: [
          {
            cardId: "card-cover",
            role: "cover",
            headline: "가을 홋카이도, 공식 안내가 바뀌었습니다",
            body: "개발 검증용 샘플입니다. 더올투어 카드뉴스 v0.",
            visualIntent: "",
            evidenceRefs: [],
          },
          {
            cardId: "card-info-01",
            role: "information",
            headline: "왜 지금 다시 봐야 하나요",
            body: "가을 단풍 시즌을 앞두고 이동·예약 정보가 바뀌었습니다. 출발 전에 최신 공지를 확인하면 일정을 덜 흔들립니다.",
            visualIntent: "",
            evidenceRefs: [],
          },
          {
            cardId: "card-info-02",
            role: "information",
            headline: "여행자가 확인할 것",
            body: "교통편 운행 시간, 입장 예약, 날씨에 따른 우천 대책을 순서대로 점검하세요. 추측하지 말고 공개된 안내만 사용합니다.",
            visualIntent: "",
            evidenceRefs: [],
          },
          {
            cardId: "card-info-03",
            role: "information",
            headline: "일정에 여유를 두는 이유",
            body: "성수기에는 같은 구간도 이동 시간이 늘어날 수 있습니다. 핵심 일정 앞뒤로 버퍼를 두면 현장에서 덜 급해집니다.",
            visualIntent: "",
            evidenceRefs: [],
          },
          {
            cardId: "card-evidence",
            role: "evidence",
            headline: "확인된 사실",
            body: "일본정부관광국이 가을 여행 안내를 업데이트했습니다. 이 카드는 연결된 출처만 표시합니다.",
            visualIntent: "",
            evidenceRefs: ["ev-official"],
          },
          {
            cardId: "card-cta",
            role: "cta",
            headline: "출발 전, 공식 안내를 한 번 더",
            body: "일정 확인 후 공식 안내를 다시 살펴보세요. 더올투어가 확인된 정보만 정리합니다.",
            visualIntent: "",
            evidenceRefs: [],
          },
        ],
        brandingIntent: "thealltour",
      },
      shortform: {
        enabled: false,
        orientation: "vertical",
        targetDurationRange: null,
        narrationSegments: [],
        cta: null,
        voiceProfileId: null,
      },
    },
    provenance: {
      builtFrom: "completed-marketing-candidate",
      candidateContract: "completed-marketing-candidate-v1",
      assignmentId: "ca_dev_cardnews_a3",
      selectedAgendaId: "sa_dev_cardnews_a3",
      governanceReviewId: null,
      evidenceRefIds: ["ev-official"],
    },
  };
}
