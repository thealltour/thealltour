/**
 * Hangul-aware term matching for research scoring.
 *
 * JavaScript `\b` only knows ASCII word characters, so `\b(베트남)\b` never matches
 * "베트남 다낭 여행". English terms keep their existing `\b` regexes; Hangul terms use
 * the explicit boundaries below instead of raw substring matching.
 */

const HANGUL = "\\uAC00-\\uD7A3";
const HANGUL_SYLLABLE = /[\uAC00-\uD7A3]/g;

/**
 * Particles / short travel suffixes allowed directly after a short (≤2 syllable)
 * place name, e.g. "일본행", "괌에서", "호주인". Anything else glued on the right
 * ("호주머니", "대만족", "인도네시아") is treated as a different word.
 */
const SHORT_PLACE_SUFFIXES = [
  "에서",
  "으로",
  "에게",
  "까지",
  "부터",
  "보다",
  "처럼",
  "이나",
  "이랑",
  "여행",
  "관광",
  "항공",
  "노선",
  "정부",
  "당국",
  "공항",
  "현지",
  "전역",
  "시내",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "에",
  "로",
  "와",
  "과",
  "도",
  "만",
  "나",
  "랑",
  "행",
  "발",
  "산",
  "인",
  "어",
  "식",
  "편",
  "시",
  "섬",
  "역",
  "내",
];

const SHORT_PLACE_MAX_SYLLABLES = 2;

export type HangulTermSpec =
  | string
  | {
      term: string;
      /** Regex source that must NOT immediately follow the term (lookahead body). */
      notBefore?: string;
      /** Regex source that must NOT immediately precede the term (lookbehind body). */
      notAfter?: string;
    };

function normalizeSpec(spec: HangulTermSpec): { term: string; notBefore?: string; notAfter?: string } {
  return typeof spec === "string" ? { term: spec } : spec;
}

function termSource(term: string): string {
  return term
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
}

function syllableCount(term: string): number {
  return term.match(HANGUL_SYLLABLE)?.length ?? 0;
}

/**
 * Place-name token: never preceded by a Hangul syllable ("교통수단" ≠ 수단); short
 * names must also end at a non-Hangul char or an allowed particle/suffix.
 */
export function hangulPlaceTermSource(spec: HangulTermSpec): string {
  const { term, notBefore, notAfter } = normalizeSpec(spec);
  let source = `(?<![${HANGUL}])`;
  if (notAfter) source += `(?<!${notAfter})`;
  source += termSource(term);
  if (syllableCount(term) <= SHORT_PLACE_MAX_SYLLABLES) {
    source += `(?=$|[^${HANGUL}]|${SHORT_PLACE_SUFFIXES.join("|")})`;
  }
  if (notBefore) source += `(?!${notBefore})`;
  return source;
}

/**
 * Compound-friendly keyword ("무비자", "출입국", "항공권" must still match), guarded
 * only by explicit per-term negative contexts ("소비자", "비자금").
 */
export function hangulCompoundTermSource(spec: HangulTermSpec): string {
  const { term, notBefore, notAfter } = normalizeSpec(spec);
  let source = "";
  if (notAfter) source += `(?<!${notAfter})`;
  source += termSource(term);
  if (notBefore) source += `(?!${notBefore})`;
  return source;
}

/** One case-insensitive regex: unchanged English regex OR any Hangul alternative. */
export function combineEnglishAndHangul(english: RegExp, hangulSources: string[]): RegExp {
  if (hangulSources.length === 0) return new RegExp(english.source, "i");
  return new RegExp(`(?:${english.source})|(?:${hangulSources.join("|")})`, "i");
}

export function hangulPlacePattern(english: RegExp, terms: HangulTermSpec[]): RegExp {
  return combineEnglishAndHangul(english, terms.map(hangulPlaceTermSource));
}

export function hangulCompoundPattern(english: RegExp, terms: HangulTermSpec[]): RegExp {
  return combineEnglishAndHangul(english, terms.map(hangulCompoundTermSource));
}
