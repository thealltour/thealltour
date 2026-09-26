/**
 * Cross-Channel Copy — Natural Korean Syntax Contracts.
 *
 * Shared instructional guidance for channel writers after Approved Canonical
 * is already natural Korean. Prevents re-introducing English-like nominalization,
 * unnecessary passives, planner jargon leakage, and forced abstract synthesis endings.
 *
 * NOT a marketing-expression ban. NOT a blacklist / replacement map.
 * Channel tone differences live in per-channel addenda / SOUL sections.
 */

import { CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";

const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;

/** Channels covered by this shared syntax contract (instructional scope). */
export const CROSS_CHANNEL_NATURAL_KOREAN_CHANNELS = [
  "threads",
  "instagram_caption",
  "instagram_card_copy",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "shortform",
] as const;

export type CrossChannelNaturalKoreanChannel =
  (typeof CROSS_CHANNEL_NATURAL_KOREAN_CHANNELS)[number];

/**
 * Abstract nouns — allowed when concrete detail exists.
 * Problem = standing in for concrete content (instructional, not enforced).
 */
export const CROSS_CHANNEL_ABSTRACT_NOUNS_RECONSIDER = [
  "프레임",
  "리듬",
  "맥락",
  "관점",
  "면모",
  "단서",
  "의미",
  "다양성",
  "인식",
  "경험",
] as const;

/**
 * Habitual translationese scaffolds (pattern labels only — do not paste long bad samples repeatedly).
 */
export const CROSS_CHANNEL_TRANSLATIONESE_SCAFFOLDS = [
  "~하는 것은 …",
  "~로 인식하는 것은 …",
  "~을 통해 …할 수 있습니다",
  "~라는 점에서 의미가 있습니다",
  "~에 대한 이해를 제공합니다",
] as const;

/** Shared invariant — concrete endings are valid; abstract synthesis is not forced. */
export const CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN =
  "A concrete fact, contrast, or observation is a valid ending. Do not force an abstract synthesis about perspective, meaning, awareness, insight, or decision criteria." as const;

export const CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_KO =
  "구체적인 사실·차이·관찰로 끝나도 충분하다. 마지막 문장을 관점·의미·인식·시야·통찰·판단 기준으로 억지로 추상화하지 않는다." as const;

/** Qualitative scan patterns for Dao review reports (zero-count NOT required). */
export const CROSS_CHANNEL_REVIEW_SCAN_PATTERNS = [
  { id: "nominalized_subject", labelKo: "~하는 것은", pattern: "하는 것은" },
  { id: "recognition_scaffold", labelKo: "~로 인식하는 것은", pattern: "인식하는 것은" },
  { id: "through_can", labelKo: "~을 통해 ~할 수 있다", pattern: "을 통해" },
  { id: "understanding_provides", labelKo: "~에 대한 이해", pattern: "에 대한 이해" },
  { id: "meaning_has", labelKo: "의미가 있", pattern: "의미가 있" },
  { id: "passive_filled", labelKo: "채워져 있", pattern: "채워져 있" },
  { id: "abstract_cluster_hint", labelKo: "추상명사 병치 힌트", pattern: "문화적 맥락" },
  { id: "planner_frame", labelKo: "planner jargon: 프레임", pattern: "프레임" },
  { id: "planner_rhythm", labelKo: "planner jargon: 리듬", pattern: "리듬" },
  { id: "interpret_read", labelKo: "해석 동사: 읽어내", pattern: "읽어내" },
] as const;

/** Promotional framing — allowed; not the target of this PR. */
export const CROSS_CHANNEL_PROMOTIONAL_FRAMING_ALLOWED = [
  "전혀 다른 베트남이 기다립니다",
  "새로운 풍경을 만납니다",
  "잘 알려지지 않은 모습",
  "숨은 여행지",
  "익숙한 여행과 다른 선택",
] as const;

/** Shared English block — embed in channel SOUL / writing contracts. */
export const CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN = [
  "NATURAL KOREAN SYNTAX (cross-channel shared):",
  "Preserve upstream semantics/facts/Story intent/evidence boundary.",
  "Rewrite into Korean that real readers of THIS channel would actually read.",
  "Natural Korean syntax ≠ shorter copy and ≠ stripping marketing energy.",
  "",
  `## ${U.title}`,
  `- ${U.semanticNotPhrasing}`,
  `- ${U.rewriteMeaning}`,
  "- Upstream wording is semantic instruction, not phrasing to preserve.",
  `- ${U.preserveMeaningNotForm}`,
  "",
  "NO FORCED ABSTRACT SYNTHESIS:",
  CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN,
  "Payoff may remain a semantic outcome — it does not require a separate abstract closing sentence.",
  "CTA rules and promotional hooks are unchanged; this only blocks forced perspective/meaning/insight/criteria endings.",
  "",
  "ANTI-OVER-NOMINALIZATION:",
  "Do not build English-like subjects from long noun phrases.",
  "Prefer saying what differs (place / people / building / action) over abstract→abstract explanation.",
  "One contrast is enough — do not inventory long bad phrase lists.",
  "",
  "TRANSLATIONESE SCAFFOLDS (pattern labels — not a phrase inventory to paste):",
  ...CROSS_CHANNEL_TRANSLATIONESE_SCAFFOLDS.map((s) => `- ${s}`),
  "Do not default to these skeletons. Passive is allowed when it is the natural Korean choice.",
  "",
  "ABSTRACT NOUNS (not a blacklist):",
  `Words such as ${CROSS_CHANNEL_ABSTRACT_NOUNS_RECONSIDER.join(" / ")} are ALLOWED.`,
  "Problem is when they replace concrete content. Prefer concrete place/people/object/action/difference when you can.",
  "No deterministic replacement. Zero-count is NOT required.",
  "",
  "PLANNER / EDITORIAL JARGON LEAKAGE:",
  "Do not paste planner/editorial synthesis (frame/rhythm/context stacks, interpretive reading verbs)",
  "as finished channel copy. Re-express meaning in channel-native Korean.",
  "",
  "PROMOTIONAL FRAMING:",
  "Marketing energy is allowed (curiosity hooks, 'another side of…', hidden-gem tone) when evidence-safe.",
  "Do NOT invent uniqueness/monopoly/secret-place claims. Follow supportedClaimBoundary / forbiddenClaims / limitations.",
  "Headline/hook marketing framing ≠ body factual claim — keep them distinct.",
  "",
  "EVIDENCE SAFETY UNCHANGED:",
  "Natural Korean rewrite must NOT strengthen claims.",
  "No invented facts, causality, popularity, on-site experience, or travel feasibility.",
  "Keep hedges for partial support.",
  "",
  "DENSITY:",
  "Natural Korean ≠ shorter copy. Keep this channel's length/density contract.",
].join("\n");

/** Compact note for INPUT_JSON / writing-contract append. */
export const CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_NOTE = [
  "Rewrite upstream meaning into natural Korean syntax for this channel.",
  CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN,
  "Anti-over-nominalization; prefer direct/active when more natural; no blacklist.",
  "Upstream wording is semantic instruction, not phrasing to preserve.",
  "Evidence safety unchanged — do not strengthen claims.",
].join(" ");

export const CROSS_CHANNEL_NATURAL_KOREAN_SEMANTIC_NOTES = [
  "NATURAL KOREAN SYNTAX: channel writers own surface wording; upstream Canonical/Narrative/Planner are semantic sources, not lexical authority.",
  "NO FORCED ABSTRACT SYNTHESIS: concrete fact/contrast/observation is a valid ending; do not force perspective/meaning/insight/criteria closings.",
  "Anti-over-nominalization and direct/active preference are instructional — not blacklists or replacement maps.",
  "Promotional framing allowed when evidence-safe; factual body claims stay within supportedClaimBoundary.",
  "Natural Korean ≠ less information — preserve channel density contracts.",
] as const;

/** Threads — conversational; concrete ending OK. */
export const THREADS_NATURAL_KOREAN_TONE_EN = [
  "CHANNEL TONE — THREADS:",
  "Conversational compression. Valid endings: concrete observation, concrete contrast, light question, or no ending.",
  "Do not force abstract editorial synthesis as the last sentence.",
  '"rhythm" is an internal craft term — not a consumer lexical seed.',
].join("\n");

/** Instagram Caption. */
export const INSTAGRAM_CAPTION_NATURAL_KOREAN_TONE_EN = [
  "CHANNEL TONE — INSTAGRAM CAPTION:",
  "Roles: hook → context → evidence-safe explanation → optional CTA.",
  "Promotional framing and curiosity hooks are allowed when evidence-safe.",
  "Do not force a final abstract sentence about perspective / awareness / broader view / decision criteria.",
  "Problem to avoid: English-like nominalization and abstract synthesis — not marketing tone itself.",
].join("\n");

/** Naver Blog — written Korean, longer breath OK. */
export const NAVER_BLOG_NATURAL_KOREAN_TONE_EN = [
  "CHANNEL TONE — NAVER BLOG:",
  "Longer written Korean is OK. Natural article flow: concrete example → explanation → limitations.",
  "Avoid report/academic nominalization stacks and habitual scaffolds.",
  "Do not pile multiple abstractions into one sentence.",
  "Not every sentence must be colloquial — aim for natural written Korean blog prose.",
  "Section headings should name concrete topics — not abstract perspective slogans.",
].join("\n");

/** Naver Band — direct, community-friendly. */
export const NAVER_BAND_NATURAL_KOREAN_TONE_EN = [
  "CHANNEL TONE — NAVER BAND:",
  "More direct and friendly than Blog. Short paragraphs; immediately understandable.",
  "Sound like a community post explaining to a person — not a strategy memo or report.",
  "Keep needed context; do not over-cut information while naturalizing.",
  "Prefer one concrete takeaway or observation — not forced abstract conclusions.",
].join("\n");

/** Kakao — fast comprehension; promotional OK. */
export const KAKAO_NATURAL_KOREAN_TONE_EN = [
  "CHANNEL TONE — KAKAO CHANNEL:",
  "Fast comprehension. Short direct sentences; put core interest/benefit early.",
  "Natural promotional Korean is OK. CTA clear and light when present.",
  "Discovery/cultural stories: concrete observation or factual contrast; optional informational close.",
  "Decision/practical stories: compact decision aid / actionable next step when grounded.",
  "Do not force action/decision synthesis when there is no CTA.",
  "Looking like an ad is fine — unnatural Korean is not.",
].join("\n");

/** Shortform — spoken Korean. */
export const SHORTFORM_NATURAL_KOREAN_TONE_EN = [
  "CHANNEL TONE — SHORTFORM:",
  "Strongest spoken-Korean priority. Must sound natural when read aloud (voice-over).",
  "Preferred arc: hook → concrete fact/context → concrete contrast/detail → natural close.",
  "Close/action is optional. Payoff is a semantic outcome — not a mandatory abstract sentence.",
  "Do not force spoken closings like forced awareness / criteria / perspective-widening formulations.",
].join("\n");

export function buildCrossChannelNaturalKoreanSoulSection(
  channel: CrossChannelNaturalKoreanChannel,
): string {
  const tone =
    channel === "threads"
      ? THREADS_NATURAL_KOREAN_TONE_EN
      : channel === "instagram_caption"
        ? INSTAGRAM_CAPTION_NATURAL_KOREAN_TONE_EN
        : channel === "naver_blog"
          ? NAVER_BLOG_NATURAL_KOREAN_TONE_EN
          : channel === "naver_band"
            ? NAVER_BAND_NATURAL_KOREAN_TONE_EN
            : channel === "kakao_channel"
              ? KAKAO_NATURAL_KOREAN_TONE_EN
              : channel === "shortform"
                ? SHORTFORM_NATURAL_KOREAN_TONE_EN
                : "";
  return ["## Natural Korean syntax", CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN, tone]
    .filter(Boolean)
    .join("\n\n");
}

export function countCrossChannelReviewPatternHits(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of CROSS_CHANNEL_REVIEW_SCAN_PATTERNS) {
    let n = 0;
    let i = 0;
    while (true) {
      const j = text.indexOf(row.pattern, i);
      if (j < 0) break;
      n += 1;
      i = j + row.pattern.length;
    }
    out[row.id] = n;
  }
  return out;
}
