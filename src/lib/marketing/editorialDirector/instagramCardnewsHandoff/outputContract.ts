import {
  INSTAGRAM_CAPTION_OUTPUT_SCHEMA,
  INSTAGRAM_CAROUSEL_PLAN_OUTPUT_SCHEMA,
  INSTAGRAM_CARD_COPY_OUTPUT_SCHEMA,
  NARRATIVE_OUTPUT_SCHEMA,
} from "@/lib/marketing/editorialDirector/researchHandoff/outputContract";

import {
  INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
  INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE,
  INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS,
  type InstagramCardnewsHandoffOutputContract,
} from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/contracts";

const CANONICAL_EVIDENCE_REFS_NOTE = "string[] (approvedCanonical.evidenceRefs[].evidenceId만)";

const range = INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE;

export const INSTAGRAM_CARDNEWS_NARRATIVE_SCHEMA = {
  ...NARRATIVE_OUTPUT_SCHEMA,
  beats: [{ ...NARRATIVE_OUTPUT_SCHEMA.beats[0], evidenceRefs: CANONICAL_EVIDENCE_REFS_NOTE }],
} as const;

export const INSTAGRAM_CARDNEWS_CAROUSEL_PLAN_SCHEMA = {
  cards: [
    {
      ...INSTAGRAM_CAROUSEL_PLAN_OUTPUT_SCHEMA.cards[0],
      cardId: "string (예: card-1 — 결과 안에서 고유)",
    },
  ],
} as const;

export const INSTAGRAM_CARDNEWS_CARD_COPY_SCHEMA = {
  cards: [
    {
      ...INSTAGRAM_CARD_COPY_OUTPUT_SCHEMA.cards[0],
      evidenceRefs: CANONICAL_EVIDENCE_REFS_NOTE,
    },
  ],
} as const;

export const INSTAGRAM_CARDNEWS_COVER_TITLE_SCHEMA =
  "string | null (1:1 썸네일 제목 제안, 80자 이하. 없으면 null)" as const;

export const INSTAGRAM_CARDNEWS_OUTPUT_RULES_KO: readonly string[] = [
  "JSON 객체 하나만 반환합니다. 코드 펜스, 설명 문장, 주석을 붙이지 않습니다.",
  "requiredEcho의 contract·candidateId·assetId·canonicalVersion·sourceRevision 값을 최상위에 그대로 복사합니다.",
  "narrative와 instagram(carouselPlan, cardCopy, caption, coverTitleKo)만 작성합니다. research나 다른 채널 결과는 쓰지 않습니다.",
  `카드는 ${range.min}–${range.max}장, 권장 ${range.preferredMin}–${range.preferredMax}장입니다. 카드뉴스 렌더는 ${range.min}장 미만이면 실패합니다.`,
  "carouselPlan.cards와 cardCopy.cards는 같은 cardId를 같은 순서로 같은 개수만큼 가집니다.",
  "첫 카드 role은 hook_cover입니다. 마지막 카드는 closing 또는 cta가 자연스럽습니다.",
  "carouselPlan.cards[].beatIds는 narrative.beats[].beatId만 씁니다. 모든 카드는 beat를 하나 이상 가집니다.",
  "evidenceRefs에는 approvedCanonical.evidenceRefs[].evidenceId만 씁니다. 근거 연결이 없으면 빈 배열입니다.",
  "contract·fingerprint·provenance 같은 서버 소유 필드를 쓰지 않습니다. schema에 있는 필드만 작성합니다.",
];

export function buildInstagramCardnewsOutputContract(echo: {
  candidateId: string;
  assetId: string;
  canonicalVersion: number;
  sourceRevision: string;
}): InstagramCardnewsHandoffOutputContract {
  return {
    format: "single_json_object",
    topLevelKeyOrder: INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS,
    requiredEcho: {
      contract: INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT,
      candidateId: echo.candidateId,
      assetId: echo.assetId,
      canonicalVersion: echo.canonicalVersion,
      sourceRevision: echo.sourceRevision,
    },
    rulesKo: [...INSTAGRAM_CARDNEWS_OUTPUT_RULES_KO],
    schema: {
      narrative: INSTAGRAM_CARDNEWS_NARRATIVE_SCHEMA,
      instagram: {
        carouselPlan: INSTAGRAM_CARDNEWS_CAROUSEL_PLAN_SCHEMA,
        cardCopy: INSTAGRAM_CARDNEWS_CARD_COPY_SCHEMA,
        caption: INSTAGRAM_CAPTION_OUTPUT_SCHEMA,
        coverTitleKo: INSTAGRAM_CARDNEWS_COVER_TITLE_SCHEMA,
      },
    },
  };
}
