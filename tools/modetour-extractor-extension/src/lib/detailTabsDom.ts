/**
 * 탭형 상세정보 DOM 파서 (일정 안내 / 예약 조건 / 환불·취소 규정).
 * PR15.1+: 상품 상세 탭 root 내부에서만 동작, footer/약관 블록 제외. 공통 scope 유틸 사용.
 */

import {
  findModetourDetailTabRoot,
  getScopedFallbackRoot,
  isFooterLikeContainer,
  isPlausibleDetailTabLines,
} from "~lib/modetourDetailScope";

const HEADING_SELECTORS =
  "h1, h2, h3, h4, h5, h6, strong, b, [role='tab'], [class*='title'], [class*='heading'], dt";

/** 탭 내용 문자열 정제: trim, NBSP, 연속 공백/줄바꿈 정리 */
export function normalizeDetailTabText(text: string): string {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** 한 줄이 의미 있는 상세 탭 라인인지 (빈 줄·공백만·너무 짧은 노이즈 제외) */
export function isMeaningfulDetailLine(text: string): boolean {
  const t = normalizeDetailTabText(text);
  if (t.length === 0) return false;
  if (t.length === 1 && /[\s·\-*]/.test(t)) return false;
  return true;
}

/** 컨테이너에서 ul/ol li, p, div 블록을 순서대로 읽어 라인 배열로 반환 */
export function splitMeaningfulLines(container: Element): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const add = (raw: string) => {
    const t = normalizeDetailTabText(raw);
    if (!t || !isMeaningfulDetailLine(t)) return;
    if (seen.has(t)) return;
    seen.add(t);
    lines.push(t);
  };

  const lis = container.querySelectorAll("ul li, ol li");
  if (lis.length > 0) {
    lis.forEach((li) => add((li as HTMLElement).textContent ?? ""));
    return lines;
  }

  const blocks = container.querySelectorAll("p, div[class*='content'], div[class*='text'], li");
  if (blocks.length > 0) {
    blocks.forEach((el) => {
      const text = (el as HTMLElement).textContent ?? "";
      const normalized = normalizeDetailTabText(text);
      if (normalized.length > 0 && normalized.length < 3000) {
        const byLine = normalized.split(/\n+/).filter((s) => isMeaningfulDetailLine(s));
        byLine.forEach(add);
      }
    });
    if (lines.length > 0) return lines;
  }

  const raw = normalizeDetailTabText((container as HTMLElement).textContent ?? "");
  raw.split(/\n+/).forEach((line) => add(line));
  return lines;
}

export type ParsedDetailSection = {
  heading?: string | null;
  lines: string[];
};

export type ParsedDetailTab = {
  title: string;
  rawText: string;
  sections: ParsedDetailSection[];
  lines: string[];
};

export type ParsedDetailTabs = {
  scheduleNotice?: ParsedDetailTab | null;
  bookingTerms?: ParsedDetailTab | null;
  cancellationPolicy?: ParsedDetailTab | null;
};

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

/** 헤딩과 연결된 탭 패널/컨테이너 찾기 */
function findTabContentContainer(heading: Element): Element | null {
  let el: Element | null = heading;

  for (let i = 0; i < 20; i++) {
    const next = el?.nextElementSibling;
    if (next) {
      const tag = next.tagName.toLowerCase();
      const role = next.getAttribute("role");
      const cls = (next.className?.toString() ?? "").toLowerCase();
      if (
        tag === "section" ||
        tag === "div" ||
        role === "tabpanel" ||
        cls.includes("panel") ||
        cls.includes("content") ||
        cls.includes("tab")
      ) {
        const textLen = (next as HTMLElement).textContent?.trim().length ?? 0;
        if (textLen > 20) return next;
      }
    }
    const parent = el?.parentElement;
    if (parent) {
      const panel = parent.querySelector("[role='tabpanel']");
      if (panel && heading.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return panel;
      }
      const children = Array.from(parent.children);
      const idx = children.indexOf(heading);
      for (let j = idx + 1; j < children.length; j++) {
        const c = children[j];
        const len = (c as HTMLElement).textContent?.trim().length ?? 0;
        if (len > 30) return c;
      }
    }
    el = parent ?? null;
  }
  el = heading;
  for (let i = 0; i < 5; i++) {
    const next = el?.nextElementSibling;
    if (next && (next as HTMLElement).textContent?.trim().length > 20) return next;
    if (!el?.parentElement) break;
    el = el.parentElement;
  }
  return null;
}

/** 컨테이너에서 lines만 추출 (섹션 구분 없이). sections는 단순히 lines를 한 덩어리로. */
function extractSectionsAndLines(container: Element): { sections: ParsedDetailSection[]; lines: string[] } {
  const lines = splitMeaningfulLines(container);
  if (lines.length === 0) {
    const raw = normalizeDetailTabText((container as HTMLElement).textContent ?? "");
    const fallback = raw.split(/\n+/).map((s) => normalizeDetailTabText(s)).filter(isMeaningfulDetailLine);
    return { sections: [{ heading: null, lines: fallback }], lines: fallback };
  }
  return { sections: [{ heading: null, lines }], lines };
}

function extractOneTab(
  root: ParentNode,
  tabTitle: string,
  keywords: string[],
): ParsedDetailTab | null {
  const headings = getHeadingNodes(root, keywords);
  for (const h of headings) {
    if (!(root as Element).contains(h)) continue;
    const container = findTabContentContainer(h);
    if (!container || !(root as Element).contains(container)) continue;
    if (isFooterLikeContainer(container)) continue;
    const rawText = normalizeDetailTabText((container as HTMLElement).textContent ?? "");
    if (rawText.length < 10) continue;
    const { sections, lines } = extractSectionsAndLines(container);
    if (!isPlausibleDetailTabLines(lines) && lines.length > 0) continue;
    if (lines.length === 0 && rawText.length < 50) continue;
    return {
      title: tabTitle,
      rawText: rawText.slice(0, 15000),
      sections,
      lines,
    };
  }
  return null;
}

/**
 * 문서에서 "일정 안내", "예약 조건", "환불·취소 규정" 탭을 DOM 기반으로 분리 추출.
 * PR15.1+: detail root(또는 scoped fallback) 내부에서만 탐색.
 * @param doc 문서
 * @param optionalRoot 미리 구한 detail root (있으면 재사용)
 */
export function extractDetailTabsFromDom(
  doc: Document,
  optionalRoot?: Element | null,
): ParsedDetailTabs {
  const result: ParsedDetailTabs = {};
  let root: ParentNode | null = optionalRoot ?? findModetourDetailTabRoot(doc);
  if (!root) root = getScopedFallbackRoot(doc);
  if (!root || isFooterLikeContainer(root as Element)) return result;

  const scheduleNotice = extractOneTab(root, "일정 안내", [
    "일정 안내",
    "일정안내",
    "여행 일정 안내",
  ]);
  if (scheduleNotice) result.scheduleNotice = scheduleNotice;

  const bookingTerms = extractOneTab(root, "예약 조건", [
    "예약 조건",
    "예약조건",
    "예약 안내",
  ]);
  if (bookingTerms) result.bookingTerms = bookingTerms;

  const cancellationPolicy = extractOneTab(root, "환불·취소 규정", [
    "환불",
    "취소 규정",
    "취소규정",
    "환불/취소",
    "환불·취소",
    "취소/환불",
  ]);
  if (cancellationPolicy) result.cancellationPolicy = cancellationPolicy;

  return result;
}
