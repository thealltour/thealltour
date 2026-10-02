/**
 * Instagram cardnews ChatGPT handoff — confirmed (research-applied, approved) Canonical →
 * ChatGPT writes the Instagram carousel plan, card copy, and caption → JSON import.
 * The imported card copy is reviewed and approved by a human before Shared Visual Plan,
 * Astra handoff, and cardnews render use it. Contract doc:
 * docs/marketing/instagram-cardnews-chatgpt-handoff-contract.md
 */

import type {
  ResearchHandoffApprovedCanonical,
  ResearchHandoffCitationPolicy,
  ResearchHandoffEditorialContext,
  ResearchHandoffSchemaSpec,
  ResearchHandoffTerminologyPolicy,
} from "@/lib/marketing/editorialDirector/researchHandoff/contracts";

export const INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT = "instagram-cardnews-chatgpt-handoff-v1" as const;
export const INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT_VERSION = 1 as const;
export const INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT = "instagram-cardnews-chatgpt-result-v1" as const;

/** Cardnews render needs at least 4 slides; the carousel planner allows up to 10. */
export const INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE = { min: 4, max: 10, preferredMin: 4, preferredMax: 6 } as const;

export const INSTAGRAM_CARDNEWS_RESULT_TOP_LEVEL_KEYS = [
  "contract",
  "candidateId",
  "assetId",
  "canonicalVersion",
  "sourceRevision",
  "narrative",
  "instagram",
] as const;

export const INSTAGRAM_CARDNEWS_RESULT_INSTAGRAM_KEYS = [
  "carouselPlan",
  "cardCopy",
  "caption",
  "coverTitleKo",
] as const;

export const INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO = {
  canonicalMissing: "공통 마케팅 원문이 없어 Instagram 카드뉴스 JSON을 만들 수 없습니다.",
  canonicalNotApproved:
    "현재 버전이 승인된 공통 원문만 Instagram 카드뉴스 JSON으로 내보낼 수 있습니다. 먼저 원문을 승인하세요.",
  researchNotApplied:
    "이 원문에는 아직 research 결과가 반영되지 않았습니다. 필요하면 Research 결과를 먼저 반영해 승인한 뒤 다시 복사하세요.",
} as const;

export type InstagramCardnewsHandoffConstraints = {
  cardCount: typeof INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE;
  fieldMaxLength: { kicker: number; headline: number; body: number; microcopy: number; coverTitleKo: number };
  hashtagMax: number;
  aspectRatio: "4:5";
};

export type InstagramCardnewsHandoffOutputContract = {
  format: "single_json_object";
  topLevelKeyOrder: readonly string[];
  requiredEcho: {
    contract: typeof INSTAGRAM_CARDNEWS_CHATGPT_RESULT_CONTRACT;
    candidateId: string;
    assetId: string;
    canonicalVersion: number;
    sourceRevision: string;
  };
  rulesKo: string[];
  schema: {
    narrative: ResearchHandoffSchemaSpec;
    instagram: {
      carouselPlan: ResearchHandoffSchemaSpec;
      cardCopy: ResearchHandoffSchemaSpec;
      caption: ResearchHandoffSchemaSpec;
      coverTitleKo: ResearchHandoffSchemaSpec;
    };
  };
};

export type InstagramCardnewsChatGptHandoff = {
  contract: typeof INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT;
  contractVersion: typeof INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT_VERSION;
  candidateId: string;
  assetId: string;
  canonicalVersion: number;
  sourceRevision: string;
  exportedAt: string;
  canonicalStatus: "approved";
  /** True when the approved Canonical carries an applied External research revision. */
  researchApplied: boolean;
  approvedCanonical: ResearchHandoffApprovedCanonical;
  editorialContext: ResearchHandoffEditorialContext;
  terminology: ResearchHandoffTerminologyPolicy;
  citationPolicy: ResearchHandoffCitationPolicy;
  constraints: InstagramCardnewsHandoffConstraints;
  writingRulesKo: string[];
  outputContract: InstagramCardnewsHandoffOutputContract;
};
