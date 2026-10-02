/**
 * Pure builder for instagram-cardnews-chatgpt-handoff-v1.
 * No fs / network — the server loader supplies asset + domain context.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";
import { INSTAGRAM_HASHTAG_MAX } from "@/lib/marketing/publishable/validate";
import {
  INSTAGRAM_CARD_COPY_FIELD_LIMITS,
  INSTAGRAM_COVER_TITLE_MAX_LENGTH,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";
import {
  EDITORIAL_CONTEXT_NOTE_KO,
  TERMINOLOGY_RULES_KO,
  projectApprovedCanonical,
  projectProposition,
  projectStory,
  uniqueTerms,
} from "@/lib/marketing/editorialDirector/researchHandoff/buildResearchHandoff";
import type {
  ResearchHandoffCitationPolicy,
  ResearchHandoffEditorialContext,
  ResearchHandoffTerminologyPolicy,
} from "@/lib/marketing/editorialDirector/researchHandoff/contracts";

import {
  INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT,
  INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT_VERSION,
  INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE,
  INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO,
  type InstagramCardnewsChatGptHandoff,
  type InstagramCardnewsHandoffConstraints,
} from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/contracts";
import { buildInstagramCardnewsOutputContract } from "@/lib/marketing/editorialDirector/instagramCardnewsHandoff/outputContract";

export type BuildInstagramCardnewsHandoffInput = {
  candidateId: string;
  asset: CanonicalMarketingAsset | null;
  storyPoint?: StoryContentPoint | null;
  proposition?: ContentProposition | null;
  canonicalLockedTerms?: readonly string[];
  now?: Date;
};

export type InstagramCardnewsHandoffFailureCode = "canonical_asset_missing" | "canonical_not_approved";

export type BuildInstagramCardnewsHandoffResult =
  | { ok: true; payload: InstagramCardnewsChatGptHandoff; warnings: string[] }
  | { ok: false; code: InstagramCardnewsHandoffFailureCode; messageKo: string };

const CITATION_RULES_KO: readonly string[] = [
  "카드 문안과 캡션에는 인용 표기, 각주, 출처명 나열, URL을 넣지 않습니다.",
  "근거 연결은 evidenceRefs로만 합니다.",
];

export const INSTAGRAM_CARDNEWS_WRITING_RULES_KO: readonly string[] = [
  "approvedCanonical이 사실의 기준입니다. 원문에 없는 사실·수치·고유명사를 새로 만들지 않습니다.",
  "supportedClaimBoundaryKo를 넘는 주장을 하지 않고, forbiddenClaimsKo에 있는 주장은 쓰지 않습니다.",
  "editorialContext는 기획 배경입니다. 독자·긴장·약속을 이해하는 데만 쓰고 사실 근거로 쓰지 않습니다.",
  "카드뉴스는 모바일에서 넘겨 보는 글입니다. 카드 한 장에 한 가지 메시지만 담습니다.",
  "headline은 카드의 핵심을 한 문장으로 말합니다. body는 headline을 반복하지 않고 구체적인 장소·사람·사실로 받쳐 줍니다.",
  "body는 모바일 기준 2–4줄 분량을 목표로 합니다. 같은 뜻의 문장을 합치고, 구체적인 맥락과 근거는 지우지 않습니다.",
  "첫 카드(hook_cover)는 짧은 제목으로 시선을 잡습니다. 설명을 길게 늘어놓지 않습니다.",
  "마지막 카드는 앞 카드에서 쌓은 내용을 구체적인 결론으로 거둡니다. 기획 용어(관점, 인사이트, 다양성 등)로 마무리하지 않습니다.",
  "자연스러운 한국어 소비자 말투로 씁니다. 기획서 문체나 번역투를 피합니다.",
  "caption은 카드뉴스를 보완합니다. 카드 문장을 그대로 반복하지 않고, opening·body·cta와 hashtags를 나눠 씁니다.",
  "coverTitleKo는 1:1 썸네일에 얹을 짧은 제목 제안입니다. 첫 카드 headline과 같아도 됩니다.",
];

export function buildInstagramCardnewsHandoff(
  input: BuildInstagramCardnewsHandoffInput,
): BuildInstagramCardnewsHandoffResult {
  const asset = input.asset;
  if (!asset) {
    return {
      ok: false,
      code: "canonical_asset_missing",
      messageKo: INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO.canonicalMissing,
    };
  }
  if (!isApprovedCanonicalAsset(asset)) {
    return {
      ok: false,
      code: "canonical_not_approved",
      messageKo: INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO.canonicalNotApproved,
    };
  }

  const identity = {
    candidateId: input.candidateId,
    assetId: asset.assetId,
    canonicalVersion: asset.version,
    sourceRevision: asset.sourceRevision,
  };

  const editorialContext: ResearchHandoffEditorialContext = {
    authority: "background_only_not_factual",
    noteKo: EDITORIAL_CONTEXT_NOTE_KO,
    story: projectStory(asset, input.storyPoint),
    proposition: projectProposition(input.proposition),
  };

  const terminology: ResearchHandoffTerminologyPolicy = {
    preserveCanonicalSpelling: true,
    allowUnverifiedKoreanTransliteration: false,
    canonicalLockedTerms: uniqueTerms(input.canonicalLockedTerms),
    rulesKo: [...TERMINOLOGY_RULES_KO],
  };

  const citationPolicy: ResearchHandoffCitationPolicy = {
    researchProvenanceRequired: true,
    surfaceCitations: "none",
    surfaceSourceUrls: false,
    rulesKo: [...CITATION_RULES_KO],
  };

  const constraints: InstagramCardnewsHandoffConstraints = {
    cardCount: INSTAGRAM_CARDNEWS_HANDOFF_CARD_RANGE,
    fieldMaxLength: { ...INSTAGRAM_CARD_COPY_FIELD_LIMITS, coverTitleKo: INSTAGRAM_COVER_TITLE_MAX_LENGTH },
    hashtagMax: INSTAGRAM_HASHTAG_MAX,
    aspectRatio: "4:5",
  };

  const researchApplied = Boolean(asset.researchRevision);
  return {
    ok: true,
    payload: {
      contract: INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT,
      contractVersion: INSTAGRAM_CARDNEWS_CHATGPT_HANDOFF_CONTRACT_VERSION,
      ...identity,
      exportedAt: (input.now ?? new Date()).toISOString(),
      canonicalStatus: "approved",
      researchApplied,
      approvedCanonical: projectApprovedCanonical(asset),
      editorialContext,
      terminology,
      citationPolicy,
      constraints,
      writingRulesKo: [...INSTAGRAM_CARDNEWS_WRITING_RULES_KO],
      outputContract: buildInstagramCardnewsOutputContract(identity),
    },
    warnings: researchApplied ? [] : [INSTAGRAM_CARDNEWS_HANDOFF_MESSAGES_KO.researchNotApplied],
  };
}

export function serializeInstagramCardnewsHandoff(payload: InstagramCardnewsChatGptHandoff): string {
  return JSON.stringify(payload, null, 2);
}
