/**
 * Canonical consumer-facing surface language contract.
 *
 * Shared by Asset Source Writer (generation) and ChatGPT/Astra canonical edit
 * (human-assisted rewrite) so one path cannot re-seed abstract AI-editorial prose
 * the other path just cleaned up.
 *
 * This is NOT a blacklist. Abstract nouns remain allowed when tethered to
 * observable/factual detail. Authority (facts, boundaries, forbidden claims)
 * is unchanged — only surface phrasing guidance.
 */

/** Legacy hedge seed that trained abstract “단서” prose — must not reappear as preferred example. */
export const CANONICAL_LEGACY_HEDGE_SEED_SHOWING_CLUE = "~을 보여주는 단서다" as const;

/** Preferred PARTIAL-support hedges (evidence strength preserved; natural Korean). */
export const CANONICAL_PREFERRED_PARTIAL_HEDGES = [
  "현재 확인된 자료에서는",
  "확인 가능한 범위에서는",
  "공식 기록에서는 ~로 소개한다",
  "~에서 이런 특징을 볼 수 있다",
  "~으로 확인된다",
  "~을 탐색해볼 수 있다",
  "실제 방문 경험은 추가 확인이 필요하다",
] as const;

/**
 * Abstract nouns that must not replace concrete explanation.
 * Listed for instruction/tests — never used as regex ban-list enforcement.
 */
export const CANONICAL_ABSTRACT_NOUNS_NEED_CONCRETE_TETHER = [
  "맥락",
  "면모",
  "단서",
  "관점",
  "다양성",
  "의미",
  "생활문화",
] as const;

/** Planner shorthand — not consumer body vocabulary. */
export const CANONICAL_PLANNER_SHORTHAND_NOT_SURFACE = [
  "frame",
  "lens",
  "rhythm",
  "payoff",
  "reframe",
] as const;

/**
 * English contract block embedded in ASW generation prompt.
 * Instructional examples only — never Dao/destination hardcodes.
 */
export const CANONICAL_NATURAL_KOREAN_SURFACE_CONTRACT_EN = [
  "NATURAL KOREAN SURFACE LANGUAGE (consumer-facing SoT):",
  "Canonical prose is what Korean readers may see (newsletter/article source), not an internal brief.",
  "Prefer everyday spoken/written Korean over strategy-deck / AI-editorial jargon.",
  "Prefer concrete people / place / object / action over abstract nouns that stand alone.",
  "Avoid translationese and empty interpretive verbs when a direct description works.",
  "",
  "ABSTRACT NOUN RULE (not a blacklist):",
  "Words such as 맥락 / 면모 / 관점 / 다양성 / 의미 / 단서 / 생활문화 are ALLOWED,",
  "but must not replace concrete explanation.",
  "If you use one, tether it to an observable or evidence-backed fact (what / where / who / how).",
  "Instructional contrast (do not hardcode destinations):",
  '  Weak:  "전통 주거의 문화적 맥락을 보여주는 단서다"',
  '  Better: "이 지역에서 이어져 온 전통 주거 방식을 보여준다"',
  '  Weak:  "지역의 다양한 면모를 읽어낼 수 있다"',
  '  Better: "지역마다 다른 생활 모습과 건축을 볼 수 있다"',
  '  Weak:  "문화적 다양성을 보여준다"',
  "  Better: say what actually differs when evidence supports it",
  "",
  "Do NOT treat planner shorthand (frame / lens / rhythm / payoff / reframe) as",
  "reader-facing Korean wording. Those are internal planning terms, not body copy.",
  "",
  "EVIDENCE SAFETY UNCHANGED:",
  "Natural phrasing must NOT strengthen claims beyond supportedClaimBoundary.",
  "Do not turn inference into asserted fact; do not expand community evidence to",
  "general population; do not invent unsupported lived-experience claims.",
  "Keep forbiddenClaimsKo / limitationsKo discipline.",
].join("\n");

/**
 * Korean notes for ChatGPT/Astra canonical edit clipboard parity with ASW.
 */
export const CANONICAL_SURFACE_LANGUAGE_NOTES_KO = [
  "독자가 실제로 읽는 자연스러운 한국어로 다듬으세요. 기획서·AI 문어체보다 일상 표현을 우선합니다.",
  "맥락·면모·단서·관점·다양성·의미·생활문화 같은 추상 명사는 금지하지 않습니다. 다만 구체적 사람·장소·사물·행동 설명 없이 그 단어만으로 끝내지 마세요.",
  "「~을 보여주는 단서다」 같은 상투적 헤지 문구를 습관적으로 쓰지 마세요. 근거 강도는 유지하되 「현재 확인된 자료에서는」「공식 기록에서는 ~로 소개한다」「~에서 이런 특징을 볼 수 있다」처럼 직접 말하세요.",
  "frame / lens / rhythm / payoff / reframe 같은 내부 기획 용어를 독자용 본문 표현처럼 쓰지 마세요.",
  "자연스러운 문장으로 바꾼다고 해서 주장 강도를 키우지 마세요. supportedClaimBoundaryKo·forbiddenClaimsKo·limitationsKo를 지키세요.",
] as const;

/** Evidence-discipline hedge lines for ASW (replaces legacy 단서 seed). */
export const CANONICAL_PARTIAL_SUPPORT_HEDGE_LINES_EN = [
  "When support is PARTIAL, prefer bounded language such as:",
  ...CANONICAL_PREFERRED_PARTIAL_HEDGES.map((h) => `- ${h}`),
  "Do not over-hedge every sentence.",
  `Do NOT prefer the legacy stock phrase "${CANONICAL_LEGACY_HEDGE_SEED_SHOWING_CLUE}" — rewrite into direct, evidence-matched Korean.`,
].join("\n");
