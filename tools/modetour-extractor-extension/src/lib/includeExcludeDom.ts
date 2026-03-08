/**
 * 포함/불포함 사항 DOM 파서.
 * 섹션 범위를 좁혀 리스트(ul/ol > li)만 추출하고, 상단 상품 정보(평점/리뷰/가격 등)가 섞이지 않게 함.
 * PR15.1+: 상품 상세 탭 root 내부에서만 검색, footer/약관 메뉴 차단. 공통 scope 유틸 사용.
 */

import {
  findModetourDetailTabRoot,
  getScopedFallbackRoot,
  isFooterLikeContainer,
} from "~lib/modetourDetailScope";

const HEADING_SELECTORS = "h1, h2, h3, h4, h5, h6, strong, [role='tab'], [class*='title'], [class*='heading'], dt";

/** 항목 문자열 정제: trim, 연속 공백 1칸, NBSP 정리 */
export function normalizeIncludeExcludeText(text: string): string {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** 노이즈 패턴: 포함/불포함 항목으로 보기 어려운 값 제외 */
const NOISE_PATTERNS = [
  /^[\d./\s]+$/,           // "1", "/", "10", "1 / 10"
  /^[\d.]+$/,              // "4.4" (평점)
  /리뷰\s*\d*개?/,         // "57개 리뷰"
  /^only/i,                // "Only우리만..."
  /상품\s*코드/i,
  /원\s*[~\d,]/i,          // 가격
  /^\d{1,3}(,\d{3})*\s*원/, // "1,089,900원"
  /^출발\s*[:.]/i,
  /^도착\s*[:.]/i,
  /^항공편\s*$/i,
];

export function isMeaningfulIncludeExcludeItem(text: string): boolean {
  const t = normalizeIncludeExcludeText(text);
  if (t.length < 2) return false;
  if (t.length > 500) return false; // 한 항목이 너무 길면 본문 유입 의심
  for (const re of NOISE_PATTERNS) {
    if (re.test(t)) return false;
  }
  return true;
}

/** footer/약관 메뉴에 흔한 문구면 true (포함/불포함 항목으로 쓰면 안 됨) */
const FOOTER_ITEM_PATTERNS = [
  /^회사소개$/i,
  /^개인정보\s*처리방침$/i,
  /^여행\s*약관$/i,
  /^이용\s*약관$/i,
  /^여행\s*보험$/i,
  /^마케팅\s*제휴/i,
  /^온라인\s*제휴/i,
  /^고객\s*센터$/i,
  /^사업자\s*정보$/i,
  /^공정거래\s*위원회$/i,
  /^통신\s*판매업$/i,
  /^대표\s*이사$/i,
];

export function isFooterLikeIncludeExcludeItem(text: string): boolean {
  const t = normalizeIncludeExcludeText(text);
  if (t.length < 2 || t.length > 80) return false;
  return FOOTER_ITEM_PATTERNS.some((re) => re.test(t));
}

/** 리스트 전체가 footer 메뉴처럼 보이면 true */
export function isFooterLikeIncludeExcludeList(items: string[]): boolean {
  if (!items.length) return false;
  const footerCount = items.filter(isFooterLikeIncludeExcludeItem).length;
  return footerCount >= 2 || (items.length <= 5 && footerCount >= 1);
}

/** 추출 결과가 정상적인 포함/불포함 목록인지 검증 */
export function isPlausibleIncludeExcludeResult(result: ParsedIncludeExclude): boolean {
  if (isFooterLikeIncludeExcludeList(result.included)) return false;
  if (isFooterLikeIncludeExcludeList(result.excluded)) return false;
  if (result.included.length > 0 && result.excluded.length > 0) {
    const same = result.included.length === result.excluded.length &&
      result.included.every((x, i) => result.excluded[i] === x);
    if (same) return false;
  }
  return true;
}

function getHeadingNodes(root: ParentNode, keywords: string[]): Element[] {
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (kws.length === 0) return [];
  const candidates = root.querySelectorAll(HEADING_SELECTORS);
  const out: Element[] = [];
  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const lower = text.toLowerCase();
    if (kws.some((k) => lower.includes(k))) out.push(el);
  }
  return out;
}

/** heading 노드 다음에 나오는 가장 가까운 ul/ol 찾기 (자신 포함, 다음 형제, 자식 탐색) */
function findListAfterHeading(heading: Element): HTMLUListElement | HTMLOListElement | null {
  let el: Element | null = heading;
  const maxDepth = 15;
  let depth = 0;
  while (el && depth < maxDepth) {
    const next = el.nextElementSibling;
    if (next) {
      const list = next.querySelector("ul, ol") ?? (next.tagName === "UL" || next.tagName === "OL" ? next : null);
      if (list) return list as HTMLUListElement | HTMLOListElement;
      const direct = next.tagName === "UL" || next.tagName === "OL" ? next : null;
      if (direct) return direct as HTMLUListElement | HTMLOListElement;
    }
    const parent = el.parentElement;
    if (parent) {
      const inParent = parent.querySelector("ul, ol");
      if (inParent && (heading.compareDocumentPosition(inParent) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        return inParent as HTMLUListElement | HTMLOListElement;
      }
    }
    el = parent;
    depth++;
  }
  el = heading;
  for (let i = 0; i < 5; i++) {
    const list = el.querySelector("ul, ol");
    if (list) return list as HTMLUListElement | HTMLOListElement;
    if (!el.parentElement) break;
    el = el.parentElement;
  }
  return null;
}

/** ul/ol 내부의 li 또는 div[role='listitem'] 등에서 텍스트 수집 */
function collectListItems(list: Element): string[] {
  const items: string[] = [];
  const lis = list.querySelectorAll("li");
  if (lis.length > 0) {
    lis.forEach((li) => {
      const t = normalizeIncludeExcludeText((li as HTMLElement).textContent ?? "");
      if (t) items.push(t);
    });
    return items;
  }
  const divs = list.querySelectorAll("[class*='item'], [class*='list'] > div, p");
  if (divs.length > 0) {
    divs.forEach((d) => {
      const t = normalizeIncludeExcludeText((d as HTMLElement).textContent ?? "");
      if (t && t.length < 400) items.push(t);
    });
  }
  return items;
}

export type ParsedIncludeExclude = {
  included: string[];
  excluded: string[];
  rawIncludedText?: string | null;
  rawExcludedText?: string | null;
};

/**
 * 문서에서 "포함 사항" / "불포함 사항" 리스트만 DOM 기반으로 추출.
 * PR15.1+: 상품 상세 탭 root(또는 scoped fallback) 내부에서만 검색, footer-like 결과 폐기.
 * @param doc 문서
 * @param optionalRoot 미리 구한 detail root (있으면 재사용, 없으면 내부에서 탐색)
 */
export function extractIncludeExcludeFromDom(
  doc: Document,
  optionalRoot?: Element | null,
): ParsedIncludeExclude {
  const result: ParsedIncludeExclude = { included: [], excluded: [] };
  let root: ParentNode | null = optionalRoot ?? findModetourDetailTabRoot(doc);
  if (!root) root = getScopedFallbackRoot(doc);
  if (!root) return result;

  if (isFooterLikeContainer(root as Element)) return result;

  const includedHeadings = getHeadingNodes(root, ["포함 사항", "포함내역", "포함"]);
  for (const h of includedHeadings) {
    if (!(root as Element).contains(h)) continue;
    const list = findListAfterHeading(h);
    if (!list) continue;
    if (!(root as Element).contains(list)) continue;
    const items = collectListItems(list).filter(isMeaningfulIncludeExcludeItem).filter((t) => !isFooterLikeIncludeExcludeItem(t));
    if (items.length > 0) {
      result.included = [...new Set(items)];
      break;
    }
  }

  const excludedHeadings = getHeadingNodes(root, ["불포함 사항", "불포함내역", "불포함", "제외"]);
  for (const h of excludedHeadings) {
    if (!(root as Element).contains(h)) continue;
    const list = findListAfterHeading(h);
    if (!list) continue;
    if (!(root as Element).contains(list)) continue;
    const items = collectListItems(list).filter(isMeaningfulIncludeExcludeItem).filter((t) => !isFooterLikeIncludeExcludeItem(t));
    if (items.length > 0) {
      result.excluded = [...new Set(items)];
      break;
    }
  }

  if (!isPlausibleIncludeExcludeResult(result)) {
    result.included = [];
    result.excluded = [];
    return result;
  }

  if (result.included.length > 0) {
    result.rawIncludedText = result.included.join("\n");
  }
  if (result.excluded.length > 0) {
    result.rawExcludedText = result.excluded.join("\n");
  }

  return result;
}
