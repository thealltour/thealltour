/**
 * Instagram Card Copy — Natural Korean Consumer Voice contract.
 *
 * Card Copy owns final surface realization. Upstream Narrative/Carousel fields
 * are semantic input only. This is NOT a blacklist / replacement map —
 * instructional guidance for the LLM writer only.
 *
 * Prefer positive concrete examples in the SOUL-facing English block.
 * Do not repeatedly surface unwanted Korean tokens as "Weak:" seeds.
 */

import { CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";

const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;

/**
 * Abstract / editorial families to reconsider (instructional metadata for tests).
 * Not interpolated into the SOUL-facing English contract — avoids negative lexical seeding.
 */
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

/** Interpretive verbs that often sound AI-editorial — metadata; not SOUL-seeded as Korean inventory. */
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

/** Unnatural noun stacks — metadata only; SOUL uses positive preferred forms. */
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
 * Positive concrete examples — never destination hardcodes / replacement maps.
 * Avoids repeating Weak lines that activate unwanted Korean tokens.
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
  "over abstract interpretation or editorial metaphor.",
  "Prefer positive patterns such as:",
  '  "이 지역에서는 다른 주거 방식과 생활 모습을 볼 수 있습니다"',
  '  "해변과 도시 중심의 여행과는 풍경과 분위기부터 달라집니다"',
  '  "해변과 리조트 밖에서 만나는 또 다른 베트남"',
  "(Examples are instructional only — do not hardcode destinations or run phrase replacement.)",
  "",
  "AI-EDITORIAL ABSTRACTION (reconsider — not a blacklist):",
  "Prefer concrete nouns and direct verbs over abstract editorial metaphors",
  "(e.g. perspective / criteria / insight / awareness / diversity as payoff,",
  "or interpretive 'reading' metaphors about culture/architecture).",
  "If an abstract editorial noun or interpretive reading verb appears,",
  "ask whether a simpler concrete Korean expression communicates the same meaning.",
  "If yes, prefer the concrete expression. Natural usage may remain when genuinely appropriate.",
  "Do NOT require zero occurrences. Do NOT apply deterministic substitution.",
  "",
  "INTERPRETIVE VERBS:",
  "Prefer direct evidence-supported verbs (see / appear / differ / continue / use / built / introduced / confirmed)",
  "over interpretive commentary verbs (reading into, revealing as a clue, reframing, illuminating).",
  "Choose by context — not a replacement map.",
  "",
  "KOREAN NOUN-STACK RULE:",
  "Avoid unnatural generated compounds. Prefer normal Korean with particles and verbs.",
  '  Prefer: "이어온 생활 모습" / "전통 주거와 생활 모습" when evidence supports',
  "over stacked abstract noun compounds.",
  "Do not invent unsupported lived-experience claims while naturalizing.",
  "",
  "HEADLINE:",
  "Must sound natural when spoken aloud; one clear idea; no strategy-deck terminology;",
  "no forced slogan tone; editorial OK if it sounds like real Korean media/social copy.",
  '  Strong direction: "북쪽 국경으로 가면 풍경부터 달라집니다"',
  '  Prefer naming a place, building, or visible difference — not an abstract lesson noun.',
  "",
  "BODY:",
  "Explain the headline rather than restate it; ordinary Korean syntax; concrete context;",
  "preserve evidence boundary; stay mobile-readable.",
  "Natural Korean ≠ less information — keep useful meaning at mobile density.",
  "Do not invent abstract change/payoff statements merely to make the",
  "card feel meaningful when concrete evidence already carries the point.",
  "",
  "CLOSING CARD:",
  "Closing-card payoff should resolve in something concrete the reader",
  "has now seen: a place, person, building, documented difference, or limitation.",
  "Do not convert upstream takeaway / beat.message / communicationGoal",
  "into a new abstract lesson about criteria, perspective, insight,",
  "awareness, diversity, or change.",
  "A concrete ending is sufficient.",
  "No forced CTA.",
  '  Prefer: "해변 밖에서 만나는 또 다른 베트남" (or another contextually supported concrete close)',
  "",
  "EVIDENCE SAFETY UNCHANGED:",
  "Naturalization must NOT strengthen claims.",
  "Keep supportedClaimBoundary / forbiddenClaims / uncertainty language.",
  "No invented village/location, personal experience, or unsupported generalization.",
  'Do NOT turn "official records introduce..." into "locals have lived this way for centuries" unless supported.',
].join("\n");

/** Compact payload note for INPUT_JSON / prompt §D (tests assert presence). */
export const CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE = [
  "Rewrite planner semantic intent into natural consumer-facing Korean cardnews.",
  "Concrete before abstract; reconsider AI-editorial families without blacklisting.",
  "Keep mobile density (~3–4 body lines soft target); do not drop useful context.",
  "Evidence safety unchanged — naturalization must not strengthen claims.",
  "For closing cards, end on a concrete observed/documented difference;",
  "do not echo planner nouns like criteria, perspective, insight,",
  "or diversity as the headline or payoff.",
].join(" ");

export const CARD_COPY_SEMANTIC_REGISTRY_NOTES = [
  "OWNS: headline/body wording; consumer-facing phrasing; local contextual explanation; natural Korean surface realization; card-level lexical de-jargon; card-level progression wording; mobile density compression (context kept, verbal redundancy removed).",
  "MUST NOT OWN: cardId/order/count, beat reassignment, factual invention, new evidence, visual role/orchestration, CTA strategy, Presentation/Layout, Narrative/Carousel structure.",
  "READS planner fields (narrativePromise / beat.message / communicationGoal) as semantic intent, not lexical authority — preserve meaning, rewrite into natural consumer Korean.",
  "Upstream planner wording is semantic instruction, not phrasing to preserve.",
  "REQUIRED production inputs: Carousel structure + Narrative sequence + Canonical factual boundary (pipeline payload).",
  "Closing payoff: concrete place/person/building/documented difference/limitation — not abstract criteria/perspective/insight/diversity synthesis.",
] as const;
