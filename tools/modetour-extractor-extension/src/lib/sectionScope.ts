/**
 * 섹션 범위 자르기(경계 고정).
 * 헤딩을 찾은 뒤 "그 헤딩이 속한 섹션 컨테이너"만 구하고, 다음 동급/상위 헤딩 앞까지만 범위 제한.
 */

const HEADING_SELECTORS = "h1, h2, h3, h4, h5, h6, strong, [role='tab'], button, [class*='title'], [class*='heading']";

const MIN_CONTAINER_TEXT = 200;

/**
 * h1~h4, strong, [role="tab"], button 등에서 키워드 매칭하는 첫 노드 반환
 */
export function findHeadingNode(keywords: string[]): Element | null {
  if (typeof document === "undefined") return null;
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (kws.length === 0) return null;

  const candidates = document.querySelectorAll(HEADING_SELECTORS);
  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const lower = text.toLowerCase();
    if (kws.some((k) => lower.includes(k))) return el;
  }
  return null;
}

/**
 * headingNode에서 위로 올라가며 section/article/div 중 "내용 블록"처럼 보이는 컨테이너 탐색.
 */
export function getSectionContainer(headingNode: Element): Element {
  let best: Element = headingNode.parentElement ?? headingNode;
  let bestScore = -1;

  let current: Element | null = headingNode.parentElement;
  while (current) {
    const text = (current as HTMLElement).textContent?.trim() ?? "";
    const tag = current.tagName.toLowerCase();
    const role = current.getAttribute("role");
    const cls = (current.className?.toString() ?? "").toLowerCase();

    const isBlock =
      tag === "section" ||
      tag === "article" ||
      tag === "main" ||
      tag === "div" ||
      role === "region" ||
      cls.includes("content") ||
      cls.includes("section") ||
      cls.includes("panel") ||
      cls.includes("tab-panel") ||
      cls.includes("itinerary") ||
      cls.includes("schedule");

    if (isBlock && text.length >= MIN_CONTAINER_TEXT) {
      const headingCount = current.querySelectorAll(HEADING_SELECTORS).length;
      const score = text.length + headingCount * 50;
      if (score > bestScore) {
        bestScore = score;
        best = current;
      }
    }
    current = current.parentElement;
  }

  return best;
}

/**
 * container 내부에서 headingNode 다음에 나오는 첫 헤딩 역할 요소를 document 순서로 반환
 */
function findNextHeadingInContainer(container: Element, afterNode: Element): Element | null {
  const isHeadingLike = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase();
    return /^h[1-6]$/.test(tag) || tag === "strong" || el.getAttribute("role") === "tab";
  };
  if (!container.contains(afterNode)) return null;
  const descendants = Array.from(container.querySelectorAll("*"));
  let startIdx = 0;
  if (afterNode !== container) {
    const i = descendants.indexOf(afterNode);
    if (i < 0) return null;
    startIdx = i + 1;
  }
  for (let j = startIdx; j < descendants.length; j++) {
    const el = descendants[j];
    if (isHeadingLike(el) && (el as HTMLElement).textContent?.trim()) return el;
  }
  return null;
}

/**
 * container의 텍스트에서 "heading 노드 텍스트 ~ 다음 헤딩 텍스트 앞" 구간만 잘라 반환.
 */
export function clampSectionByNextHeading(container: Element, headingNode: Element): string {
  const fullText = (container as HTMLElement).textContent ?? "";
  const headingText = (headingNode as HTMLElement).textContent?.trim() ?? "";
  const nextEl = findNextHeadingInContainer(container, headingNode);

  let start = 0;
  const headingIdx = headingText ? fullText.indexOf(headingText) : -1;
  if (headingIdx >= 0) start = headingIdx;

  let end = fullText.length;
  if (nextEl) {
    const nextText = (nextEl as HTMLElement).textContent?.trim() ?? "";
    if (nextText) {
      const nextIdx = fullText.indexOf(nextText, start);
      if (nextIdx > start) end = nextIdx;
    }
  }

  return fullText.slice(start, end).trim();
}

export type ScopedSectionResult = {
  container: Element | null;
  text: string;
  node: Element | null;
  warning?: string;
};

const DEFAULT_MAX_LEN = 5000;
const MIN_SCOPE_LEN = 100;

/**
 * keywords로 헤딩 찾기 → 섹션 컨테이너 구하기 → 헤딩~다음 헤딩 앞까지만 텍스트 추출.
 */
export function getScopedSection(
  keywords: string[],
  maxLen = DEFAULT_MAX_LEN,
): ScopedSectionResult {
  if (typeof document === "undefined") {
    return { container: null, text: "", node: null, warning: "ITINERARY_SCOPE_NOT_FOUND" };
  }

  const heading = findHeadingNode(keywords);
  if (!heading) {
    return { container: null, text: "", node: null, warning: "ITINERARY_SCOPE_NOT_FOUND" };
  }

  const container = getSectionContainer(heading);
  let text = clampSectionByNextHeading(container, heading);

  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (text.length > maxLen) text = text.slice(0, maxLen) + "\n…(truncated)";

  if (text.length < MIN_SCOPE_LEN) {
    return {
      container,
      text,
      node: heading,
      warning: "ITINERARY_SCOPE_TOO_SHORT",
    };
  }

  return { container, text, node: heading };
}
