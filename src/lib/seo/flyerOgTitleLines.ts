/**
 * 유인물 OG 썸네일용 제목: 최대 길이 + 1~2줄 자동 분리 (카카오/SNS 가독성).
 */

export const OG_TITLE_MAX_CHARS = 32;

/** 긴 키워드 우선 매칭 */
const PROMO_KEYWORDS = ["핵심상품", "추천", "특가"] as const;

function truncateOgTitle(s: string): string {
  const t = s.trim();
  if (t.length <= OG_TITLE_MAX_CHARS) return t;
  return `${t.slice(0, OG_TITLE_MAX_CHARS - 1)}…`;
}

/** `일주`는 앞뒤 토큰 경계가 있을 때만 분리 (내부 오인 방지) */
function findIljuSplitIndex(t: string): number {
  const token = "일주";
  let i = 0;
  while (i < t.length) {
    const j = t.indexOf(token, i);
    if (j < 0) return -1;
    const prevOk = j === 0 || /[\s·•]/.test(t[j - 1]!);
    const after = j + token.length;
    const nextOk = after >= t.length || /[\s·•\d]/.test(t[after]!);
    if (prevOk && nextOk) return j;
    i = j + 1;
  }
  return -1;
}

/**
 * 프로모/키워드 기준: 앞부분 1줄, 키워드부터 2줄.
 * 키워드가 맨 앞이면 본문을 1줄, 키워드를 2줄.
 */
function trySplitOnPromoKeywords(t: string): { line1: string; line2: string } | null {
  for (const kw of PROMO_KEYWORDS) {
    const i = t.indexOf(kw);
    if (i < 0) continue;
    const before = t.slice(0, i).trimEnd();
    const fromKw = t.slice(i).trim();
    if (!fromKw) continue;

    if (!before) {
      const afterKw = t.slice(i + kw.length).trim();
      if (afterKw) return { line1: afterKw, line2: kw };
      return { line1: kw, line2: "" };
    }
    return { line1: before.trim(), line2: fromKw };
  }

  const j = findIljuSplitIndex(t);
  if (j >= 0) {
    const before = t.slice(0, j).trimEnd();
    const fromIlju = t.slice(j).trim();
    if (!fromIlju) return null;
    if (!before) {
      const after = t.slice(j + 2).trim();
      if (after) return { line1: after, line2: "일주" };
      return { line1: "일주", line2: "" };
    }
    return { line1: before.trim(), line2: fromIlju };
  }

  return null;
}

/** 공백 단어 기준 2줄 균등 분배 (문자 수 기준) */
function balanceBySpaces(t: string): { line1: string; line2: string } {
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { line1: "", line2: "" };
  if (words.length === 1) return splitLongToken(words[0]!);

  const total = t.length;
  let line1 = "";
  let i = 0;
  while (i < words.length) {
    const cand = line1 ? `${line1} ${words[i]}` : words[i]!;
    if (line1 && cand.length >= total / 2) break;
    line1 = cand;
    i++;
  }
  if (i === 0) {
    line1 = words[0]!;
    i = 1;
  }
  const line2 = words.slice(i).join(" ").trim();
  return { line1: line1.trim(), line2: line2 };
}

/** 공백 없는 긴 문자열 → 가운데 근처 분할 (최대 2줄) */
function splitLongToken(token: string): { line1: string; line2: string } {
  if (token.length <= 16) return { line1: token, line2: "" };
  const mid = Math.ceil(token.length / 2);
  return { line1: token.slice(0, mid).trim(), line2: token.slice(mid).trim() };
}

/**
 * 우선순위: 프로모/일주 키워드 분리 → 공백 균등 분배 → 문자 중앙 분할.
 * 항상 `truncate`(32자) 적용된 문자열만 사용.
 */
export function splitFlyerOgTitleLines(displayTitle: string): { line1: string; line2: string } {
  const t = truncateOgTitle(displayTitle);
  if (!t) return { line1: "", line2: "" };

  const promo = trySplitOnPromoKeywords(t);
  if (promo) return promo;

  const spaced = balanceBySpaces(t);
  if (spaced.line2 || spaced.line1) return spaced;

  return { line1: t, line2: "" };
}

const PROMO_SECOND_LINE = new Set<string>(["특가", "추천", "핵심상품", "일주"]);

/** 2번째 줄 전체를 포인트 컬러로 쓸지 (짧은 캐치프레이즈) */
export function isOgPromoSecondLine(line: string): boolean {
  const s = line.trim();
  if (!s) return false;
  if (PROMO_SECOND_LINE.has(s)) return true;
  for (const kw of PROMO_KEYWORDS) {
    if (s === kw || s.startsWith(`${kw} `) || s.startsWith(`${kw}·`)) return true;
  }
  if (s === "일주" || s.startsWith("일주 ") || s.startsWith("일주·")) return true;
  return false;
}
