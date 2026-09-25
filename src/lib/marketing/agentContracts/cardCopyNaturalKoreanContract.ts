/**
 * Instagram Card Copy — Natural Korean Consumer Voice contract.
 *
 * Card Copy owns final surface realization. Upstream Narrative/Carousel fields
 * are semantic input only. This is NOT a blacklist / replacement map —
 * instructional guidance for the LLM writer only.
 */

import { CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";

const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;

/** Abstract / editorial expressions to reconsider (instructional — not enforced). */
export const CARD_COPY_ABSTRACT_EDITORIAL_FAMILIES = [
  "프레임",
  "리듬",
  "맥락",
  "면모",
  "관점",
  "렌즈",
  "다양성",
  "단서",
  "결",
  "읽어내다",
  "읽히다",
  "드러내다",
  "핵심 증거",
  "생활문화 기록",
  "문화적 맥락",
  "건축적 맥락",
  "~을 보여주는 단서",
  "~을 통해 읽을 수 있다",
] as const;

/** Interpretive verbs that often sound AI-editorial — prefer direct alternatives when evidence supports. */
export const CARD_COPY_INTERPRETIVE_VERBS_RECONSIDER = [
  "읽어내다",
  "읽히다",
  "드러나다",
  "보여주는 단서다",
  "환기하다",
  "재구성하다",
  "조명하다",
] as const;

export const CARD_COPY_PREFERRED_DIRECT_VERBS = [
  "볼 수 있다",
  "나타난다",
  "다르다",
  "이어져 있다",
  "사용한다",
  "지어졌다",
  "소개된다",
  "확인된다",
] as const;

/** Unnatural noun stacks — instructional examples only. */
export const CARD_COPY_NOUN_STACK_EXAMPLES = [
  "생활문화 기록",
  "생활 리듬",
  "휴양 프레임",
  "문화적 맥락",
  "건축적 맥락",
  "문화 다양성 경험",
  "지역 정체성 단서",
] as const;

/**
 * English contract block for Card Copy SOUL / prompt.
 * Instructional examples only — never destination hardcodes / replacement maps.
 */
export const CARD_COPY_NATURAL_KOREAN_CONTRACT_EN = [
  "NATURAL KOREAN CONSUMER VOICE (final surface ownership):",
  "You own headline/body wording and natural Korean surface realization.",
  "You are NOT polishing or lightly editing planner phrases — you REWRITE meaning into Korean travel/editorial cardnews that everyday educated readers understand on first read.",
  "Sound like: concise Korean Instagram cardnews — direct, concrete, not slogan-like.",
  "Do NOT sound like: planning memo, strategy deck, academic commentary, translated editorial English, or AI insight summary.",
  "",
  `## ${U.title}`,
  `- ${U.semanticNotPhrasing}`,
  `- ${U.rewriteMeaning}`,
  `- ${U.fieldsNotSeeds}`,
  `- ${U.preserveMeaningNotForm}`,
  `- ${U.plannerNotPreferred}`,
  "",
  "CONCRETE-BEFORE-ABSTRACT:",
  "Prefer place / people / building / landscape / movement / visible difference / concrete characteristic",
  "over abstract interpretation.",
  '  Weak:  "문화적 맥락을 읽어내게 됩니다"',
  '  Better: "이 지역에서는 다른 주거 방식과 생활 모습을 볼 수 있습니다"',
  '  Weak:  "여행의 리듬이 달라집니다"',
  '  Better: "해변과 도시 중심의 여행과는 풍경과 분위기부터 달라집니다"',
  '  Weak:  "휴양 프레임 밖의 또 다른 베트남"',
  '  Better: "해변과 리조트 밖에서 만나는 또 다른 베트남"',
  "(Examples are instructional only — do not hardcode destinations or run phrase replacement.)",
  "",
  "AI-EDITORIAL ABSTRACTION (reconsider — not a blacklist):",
  `Families such as: ${CARD_COPY_ABSTRACT_EDITORIAL_FAMILIES.join(" / ")}.`,
  "If one appears, ask whether a simpler concrete Korean expression communicates the same meaning.",
  "If yes, prefer the concrete expression. Natural usage may remain when genuinely appropriate.",
  "Do NOT require zero occurrences. Do NOT apply deterministic substitution.",
  "",
  "INTERPRETIVE VERBS:",
  `Overused editorial verbs to reconsider: ${CARD_COPY_INTERPRETIVE_VERBS_RECONSIDER.join(" / ")}.`,
  `Prefer direct verbs where evidence supports: ${CARD_COPY_PREFERRED_DIRECT_VERBS.join(" / ")}.`,
  "Choose by context — not a replacement map.",
  "",
  "KOREAN NOUN-STACK RULE:",
  "Avoid unnatural compounds that sound generated",
  `(e.g. ${CARD_COPY_NOUN_STACK_EXAMPLES.slice(0, 4).join(" / ")}).`,
  "Prefer normal Korean with particles and verbs.",
  '  e.g. "생활문화 기록" → "이어온 생활 모습" / "전통 주거와 생활 모습" when evidence supports.',
  "Do not invent unsupported lived-experience claims while naturalizing.",
  "",
  "HEADLINE:",
  "Must sound natural when spoken aloud; one clear idea; no strategy-deck terminology;",
  "no forced slogan tone; editorial OK if it sounds like real Korean media/social copy.",
  '  Strong direction: "북쪽 국경으로 가면 풍경부터 달라집니다"',
  '  Weak direction: "여행의 리듬이 전환되는 북부 국경"',
  "",
  "BODY:",
  "Explain the headline rather than restate it; ordinary Korean syntax; concrete context;",
  "preserve evidence boundary; stay mobile-readable.",
  "Natural Korean ≠ less information — keep useful meaning at mobile density.",
  "",
  "CLOSING CARD:",
  "Summarize what the reader has newly seen/understood with a concrete payoff.",
  "Avoid forced philosophical synthesis and frame/rhythm/context/reading metaphors unless genuinely natural.",
  "No forced CTA.",
  '  Weak:  "휴양 프레임 밖에서 읽는 생활 리듬"',
  '  Better: "해변 밖에서 만나는 또 다른 베트남" (or another contextually supported closing)',
  "",
  "EVIDENCE SAFETY UNCHANGED:",
  "Naturalization must NOT strengthen claims.",
  "Keep supportedClaimBoundary / forbiddenClaims / uncertainty language.",
  "No invented village/location, personal experience, or unsupported generalization.",
  'Do NOT turn "official records introduce..." into "locals have lived this way for centuries" unless supported.',
].join("\n");

/** Compact payload note for INPUT_JSON (tests assert presence). */
export const CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE = [
  "Rewrite planner semantic intent into natural consumer-facing Korean cardnews.",
  "Concrete before abstract; reconsider AI-editorial families without blacklisting.",
  "Keep mobile density (~3–4 body lines soft target); do not drop useful context.",
  "Evidence safety unchanged — naturalization must not strengthen claims.",
].join(" ");

export const CARD_COPY_SEMANTIC_REGISTRY_NOTES = [
  "OWNS: headline/body wording; consumer-facing phrasing; local contextual explanation; natural Korean surface realization; card-level lexical de-jargon; card-level progression wording; mobile density compression (context kept, verbal redundancy removed).",
  "MUST NOT OWN: cardId/order/count, beat reassignment, factual invention, new evidence, visual role/orchestration, CTA strategy, Presentation/Layout, Narrative/Carousel structure.",
  "READS planner fields (narrativePromise / beat.message / communicationGoal) as semantic intent, not lexical authority — preserve meaning, rewrite into natural consumer Korean.",
  "Upstream planner wording is semantic instruction, not phrasing to preserve.",
] as const;
