import { NARRATIVE_BEAT_PURPOSES } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import {
  INSTAGRAM_CAROUSEL_ROLES,
  INSTAGRAM_VISUAL_PRIORITIES,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  NAVER_BAND_COPY_ENDING_INTENTS,
  NAVER_BAND_COPY_OPENING_INTENTS,
} from "@/lib/marketing/publishable/naverBandCopy/contracts";
import {
  NAVER_BLOG_SECTION_PURPOSES,
  NAVER_BLOG_TARGET_DEPTHS,
} from "@/lib/marketing/publishable/naverBlogEditorial/contracts";
import { THREADS_COPY_ENDING_INTENTS } from "@/lib/marketing/publishable/threadsCopy/contracts";

import {
  EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
  RESEARCH_FINDING_SUPPORT_LEVELS,
  RESEARCH_OUTPUT_STATUSES,
  RESEARCH_SOURCE_TIERS,
  type ResearchHandoffOutputContract,
} from "@/lib/marketing/editorialDirector/researchHandoff/contracts";

function oneOf(values: readonly string[]): string {
  return values.join(" | ");
}

const EVIDENCE_REFS_NOTE = "string[] (research.findings[].findingId 또는 approvedCanonical.evidenceRefs[].evidenceId)";

export const RESEARCH_OUTPUT_SCHEMA = {
  status: oneOf(RESEARCH_OUTPUT_STATUSES),
  questions: ["string"],
  findings: [
    {
      findingId: "string (예: F1, F2 — 결과 JSON 안에서 고유)",
      claim: "string",
      supportLevel: oneOf(RESEARCH_FINDING_SUPPORT_LEVELS),
      usableForEditorial: "boolean",
      freshness: "string | null",
      sources: [
        {
          title: "string",
          publisher: "string",
          date: "string | null (YYYY-MM-DD, 확인 불가 시 null)",
          url: "string",
          sourceTier: oneOf(RESEARCH_SOURCE_TIERS),
        },
      ],
    },
  ],
  unresolved: ["string"],
  canonicalConflicts: [
    {
      canonicalField: "string (approvedCanonical 필드명)",
      canonicalText: "string (충돌하는 Canonical 문장 그대로)",
      findingIds: ["string"],
      explanation: "string",
    },
  ],
} as const;

export const NARRATIVE_OUTPUT_SCHEMA = {
  editorialArchetype: "string | null",
  narrativePromise: "string",
  audienceTakeaway: "string",
  beats: [
    {
      beatId: "string",
      purpose: oneOf(NARRATIVE_BEAT_PURPOSES),
      message: "string",
      evidenceRefs: EVIDENCE_REFS_NOTE,
    },
  ],
} as const;

export const THREADS_OUTPUT_SCHEMA = {
  body: "string (권장 180–420자)",
  selectedNarrativeBeats: ["string (narrative.beats[].beatId)"],
  endingIntent: oneOf(THREADS_COPY_ENDING_INTENTS),
  evidenceRefs: EVIDENCE_REFS_NOTE,
} as const;

export const INSTAGRAM_CAROUSEL_PLAN_OUTPUT_SCHEMA = {
  cards: [
    {
      cardId: "string",
      role: oneOf(INSTAGRAM_CAROUSEL_ROLES),
      beatIds: ["string (narrative.beats[].beatId)"],
      communicationGoal: "string",
      visualPriority: oneOf(INSTAGRAM_VISUAL_PRIORITIES),
    },
  ],
} as const;

export const INSTAGRAM_CARD_COPY_OUTPUT_SCHEMA = {
  cards: [
    {
      cardId: "string (carouselPlan.cards[].cardId)",
      kicker: "string | null",
      headline: "string",
      body: "string | null",
      microcopy: "string | null",
      evidenceRefs: EVIDENCE_REFS_NOTE,
    },
  ],
} as const;

export const INSTAGRAM_CAPTION_OUTPUT_SCHEMA = {
  opening: "string",
  body: "string",
  cta: "string | null",
  hashtags: ["string"],
  altText: "string",
} as const;

export const NAVER_BLOG_STRUCTURE_OUTPUT_SCHEMA = {
  titleStrategy: "string",
  selectedTitle: "string",
  titleCandidates: ["string"],
  sectionPlan: [
    {
      sectionId: "string",
      purpose: oneOf(NAVER_BLOG_SECTION_PURPOSES),
      heading: "string",
      narrativeBeatRefs: ["string (narrative.beats[].beatId)"],
      evidenceRefs: EVIDENCE_REFS_NOTE,
      targetDepth: oneOf(NAVER_BLOG_TARGET_DEPTHS),
    },
  ],
  openingIntent: "string",
  conclusionIntent: "string",
  ctaIntent: "string | null",
  faqPlan: [{ question: "string", answerability: "supported | unsupported" }],
  searchIntent: "string | null",
  primaryTopic: "string",
  evidenceCoverage: "string",
} as const;

export const NAVER_BLOG_COPY_OUTPUT_SCHEMA = {
  title: "string",
  bodyMarkdown: "string",
  sectionOutputs: [
    {
      sectionId: "string (structure.sectionPlan[].sectionId)",
      heading: "string",
      bodyMarkdown: "string",
    },
  ],
  faq: [{ question: "string", answer: "string" }],
  cta: "string | null",
  evidenceRefs: EVIDENCE_REFS_NOTE,
} as const;

export const NAVER_BAND_OUTPUT_SCHEMA = {
  title: "string | null",
  body: "string (권장 250–700자)",
  selectedNarrativeBeats: ["string (narrative.beats[].beatId)"],
  openingIntent: oneOf(NAVER_BAND_COPY_OPENING_INTENTS),
  keyPoints: ["string"],
  endingIntent: oneOf(NAVER_BAND_COPY_ENDING_INTENTS),
  engagementIntent: "string | null",
  evidenceRefs: EVIDENCE_REFS_NOTE,
} as const;

export const KAKAO_OUTPUT_SCHEMA = {
  title: "string | null",
  body: "string",
} as const;

export const SHORTFORM_OUTPUT_SCHEMA = {
  body: "string",
  segments: [
    {
      narrationText: "string",
      purpose: "string",
      visualIntent: "string",
    },
  ],
} as const;

export const EDITORIAL_RESEARCH_TOP_LEVEL_KEY_ORDER = [
  "contract",
  "candidateId",
  "assetId",
  "canonicalVersion",
  "sourceRevision",
  "research",
  "narrative",
  "threads",
  "instagram",
  "naverBlog",
  "naverBand",
  "kakao",
  "shortform",
] as const;

export const EDITORIAL_RESEARCH_OUTPUT_RULES_KO: readonly string[] = [
  "JSON 객체 하나만 반환합니다. 코드 펜스, 설명 문장, 주석을 붙이지 않습니다.",
  "requiredEcho의 contract·candidateId·assetId·canonicalVersion·sourceRevision 값을 최상위에 그대로 복사합니다.",
  "research 객체는 필수이며 narrative·채널 결과보다 먼저 작성하고 완료합니다. research가 없으면 결과 전체가 무효입니다.",
  "research.status가 blocked이면 narrative와 모든 채널 결과(threads, instagram, naverBlog, naverBand, kakao, shortform)는 null로 둡니다.",
  "approvedCanonical이 사실 기준선입니다. research가 Canonical과 충돌하면 채널 문안에 반영하지 말고 research.canonicalConflicts에 기록합니다.",
  "Canonical에 없는 새 사실은 usableForEditorial=true이고 supportLevel이 verified 또는 corroborated인 finding만 채널 문안에 사용할 수 있습니다. qualified는 한정 표현으로만 사용하고, weak·conflicting은 사용하지 않습니다.",
  "approvedCanonical.forbiddenClaimsKo에 해당하는 주장은 어떤 채널에서도 쓰지 않습니다.",
  "editorialContext는 기획 배경일 뿐 사실 근거가 아닙니다. editorialContext만으로 사실을 주장하지 않습니다.",
  "research.findings[].sources에는 실제로 확인한 출처만 적습니다. 제목·발행처·URL을 추측하거나 만들어 내지 않습니다. 날짜를 확인할 수 없으면 null입니다.",
  "채널 결과에는 contract·fingerprint·provenance 같은 서버 소유 필드를 쓰지 않습니다. schema에 있는 필드만 작성합니다.",
];

export function buildEditorialResearchOutputContract(echo: {
  candidateId: string;
  assetId: string;
  canonicalVersion: number;
  sourceRevision: string;
}): ResearchHandoffOutputContract {
  return {
    format: "single_json_object",
    researchRequired: true,
    topLevelKeyOrder: EDITORIAL_RESEARCH_TOP_LEVEL_KEY_ORDER,
    requiredEcho: {
      contract: EDITORIAL_RESEARCH_BUNDLE_CHATGPT_RESULT_CONTRACT,
      candidateId: echo.candidateId,
      assetId: echo.assetId,
      canonicalVersion: echo.canonicalVersion,
      sourceRevision: echo.sourceRevision,
    },
    rulesKo: [...EDITORIAL_RESEARCH_OUTPUT_RULES_KO],
    schema: {
      research: RESEARCH_OUTPUT_SCHEMA,
      narrative: NARRATIVE_OUTPUT_SCHEMA,
      threads: THREADS_OUTPUT_SCHEMA,
      instagram: {
        carouselPlan: INSTAGRAM_CAROUSEL_PLAN_OUTPUT_SCHEMA,
        cardCopy: INSTAGRAM_CARD_COPY_OUTPUT_SCHEMA,
        caption: INSTAGRAM_CAPTION_OUTPUT_SCHEMA,
      },
      naverBlog: {
        structure: NAVER_BLOG_STRUCTURE_OUTPUT_SCHEMA,
        copy: NAVER_BLOG_COPY_OUTPUT_SCHEMA,
      },
      naverBand: NAVER_BAND_OUTPUT_SCHEMA,
      kakao: KAKAO_OUTPUT_SCHEMA,
      shortform: SHORTFORM_OUTPUT_SCHEMA,
    },
  };
}
