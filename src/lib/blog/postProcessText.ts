/**
 * PR-BLOG-10·11: 블로그 plain text 최종 출력 직전 교정 (생성 로직과 분리)
 */

import type { BlogPostType } from "@/lib/blog/blogPost.types";

/** 긴 패턴 우선 적용 권장 */
const BASE_REPLACEMENTS: [RegExp, string][] = [
  [/한 번 확인해보시는 것을 추천드립니다\./g, "확인해보시는 것을 추천드립니다."],
  [/한 번 확인해보시는 것이 좋습니다\./g, "확인해보시는 것을 추천드립니다."],
  [/확인해보시는 것이 좋습니다\./g, "확인해보시는 것을 추천드립니다."],
  [/체크해볼 필요가 있습니다/g, "확인해볼 만합니다"],
  [/원면/g, "원 수준이면"],
  /** '정리보면' → '정리보면' (해 탈락형 오타) */
  [/\uC815\uB9AC\uBCF4\uBA74/g, "\uC815\uB9AC\uD574\uBCF4\uBA74"],
  [/기준으로 보면 되고,/g, "기준으로 보면,"],
];

function applyBaseReplacements(s: string): string {
  let out = s;
  for (const [re, to] of BASE_REPLACEMENTS) {
    out = out.replace(re, to);
  }
  return out;
}

/**
 * PR-BLOG-11: `991,000원` 형태 → `99만원대` (1만원 미만·비숫자 원문은 유지)
 */
function formatWonPricesToManWon(text: string): string {
  return text.replace(/(\d{1,3}(?:,\d{3})*)원/g, (full, grp: string) => {
    const num = Number(String(grp).replace(/,/g, ""));
    if (!Number.isFinite(num) || num < 10_000) return full;
    const man = Math.floor(num / 10_000);
    return `${man}만원대`;
  });
}

/** `99만원대 수준이면` → 읽기 자연스러운 `99만원대라면` */
function softenManWonFollowup(s: string): string {
  return s.replace(/만원대 수준이면/g, "만원대라면");
}

/** 줄 단위 공백만 정리 (개행은 유지) */
function collapseHorizontalSpaceByLine(s: string): string {
  return s
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]{2,}/g, " "))
    .join("\n");
}

const URL_LINE = /^https?:\/\//i;
const SINGLE_POST_REPLACEMENTS: [RegExp, string][] = [
  [/확인해보시는 것을 추천드립니다\./g, "확인해보시는 것이 좋습니다."],
  [/한 번 더 확인해보시는 것이 좋습니다\./g, "한 번 더 확인하는 것이 좋습니다."],
  [/조건을 확인해보세요\.\n\n조건을 확인해보세요\./g, "조건을 확인해보세요."],
  [/현재 조건 기준으로 실제 예약 가능한 일정과 가격을 확인해보세요\./g, "현재 조건 기준으로 실제 예약 가능한 일정과 가격을 확인해보세요."],
];

function dedupeNonUrlLines(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (URL_LINE.test(trimmed)) {
      out.push(line);
      continue;
    }
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(line);
  }

  return out.join("\n");
}

/** `👉 …조건 확인` / `👉 비교 기준 확인` 직전 보조 문장 */
function insertBeforeCtaHeadLines(s: string): string {
  const helper = "조건을 기준으로 한 번 비교해보시는 것이 좋습니다.";
  return s.replace(/^👉 .*(?:조건 확인|비교 기준 확인)\s*$/gm, (line) => `${helper}\n\n${line}`);
}

function applyTypeSpecific(s: string, type: BlogPostType): string {
  let result = s;

  if (type === "deal") {
    result = result.replace(/조건을 한 번 확인해볼 만합니다/g, "조건을 한 번 확인해볼 만한 가격대입니다");
  }

  if (type === "info") {
    result = result.replace(
      /조건을 확인해보는 분들을 위해 정리했습니다\./g,
      "조건을 확인해보는 분들을 위해 핵심 기준만 정리했습니다.",
    );
  }

  if (type === "compare") {
    if (!result.includes("체감 가격 차이")) {
      result = result.replace(
        /^👉 비교 기준 확인\s*$/gm,
        "같은 기간 기준으로 보면 포함 조건에 따라 체감 가격 차이가 생길 수 있습니다.\n\n👉 비교 기준 확인",
      );
    }
  }

  return result;
}

/**
 * PR-BLOG-11 (선택): `priceText` 등에서 숫자만 추출해 만원대 문자열
 */
export function toManPriceBandFromPriceText(priceText: string): string | null {
  const num = Number(String(priceText).replace(/[^0-9]/g, ""));
  if (!Number.isFinite(num) || num < 10_000) return null;
  const man = Math.floor(num / 10_000);
  return `${man}만원대`;
}

export function postProcessText(text: string, type: BlogPostType): string {
  return postProcessTextWithOptions(text, type);
}

export function postProcessTextWithOptions(
  text: string,
  type: BlogPostType,
  options?: { insertCtaHelper?: boolean },
): string {
  if (!text) return "";

  let result = applyBaseReplacements(text);
  result = formatWonPricesToManWon(result);
  result = softenManWonFollowup(result);
  result = applyTypeSpecific(result, type);
  if (options?.insertCtaHelper !== false) {
    result = insertBeforeCtaHeadLines(result);
  }
  result = collapseHorizontalSpaceByLine(result);
  result = dedupeNonUrlLines(result);

  return result.trim();
}

export function postProcessSingleBlogText(text: string): string {
  let result = postProcessTextWithOptions(text, "info", { insertCtaHelper: false });

  for (const [re, to] of SINGLE_POST_REPLACEMENTS) {
    result = result.replace(re, to);
  }

  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}
