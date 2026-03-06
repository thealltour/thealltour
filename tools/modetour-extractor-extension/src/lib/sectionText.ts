/**
 * 헤딩 키워드 기반 섹션 텍스트 수집기.
 * DOM 구조가 바뀌어도 "헤딩 텍스트"로 섹션을 찾아 원문 수집.
 */

const HEADING_SELECTORS = "h1, h2, h3, h4, h5, h6, strong, [role='tab'], [class*='title'], [class*='heading']";

/**
 * 헤딩 역할 요소 중 키워드와 매칭되는 첫 요소를 찾고,
 * 그 요소의 가까운 컨테이너(부모/다음 형제/section)에서 텍스트 추출 대상 노드 반환.
 */
export function findSectionByHeading(headingKeywords: string[]): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const keywords = headingKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (keywords.length === 0) return null;

  const candidates = document.querySelectorAll(HEADING_SELECTORS);
  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const lower = text.toLowerCase();
    const matched = keywords.some((k) => lower.includes(k));
    if (!matched) continue;

    // 컨테이너 후보: 부모 중 section, article, [class*="content"], 또는 다음 형제 블록
    let container: HTMLElement | null = el.parentElement;
    while (container) {
      const tag = container.tagName.toLowerCase();
      const role = container.getAttribute("role");
      const cls = container.className?.toString().toLowerCase() ?? "";
      if (
        tag === "section" ||
        tag === "article" ||
        tag === "main" ||
        role === "region" ||
        cls.includes("content") ||
        cls.includes("section") ||
        cls.includes("panel") ||
        cls.includes("tab-panel")
      ) {
        return container;
      }
      container = container.parentElement;
    }

    const parent = el.parentElement;
    if (parent) return parent;
  }
  return null;
}

/**
 * 노드의 textContent를 정리 (공백 정규화, 연속 줄바꿈 정리).
 * maxLen 초과 시 잘라냄.
 */
export function extractTextFromNode(
  node: HTMLElement | null,
  maxLen = 5000,
): string {
  if (!node) return "";
  const raw = node.textContent ?? "";
  const normalized = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (normalized.length <= maxLen) return normalized;
  return normalized.slice(0, maxLen) + "\n…(truncated)";
}

export const INCLUSIONS_HEADINGS = ["포함", "포함사항", "포함 내역"];
export const EXCLUDED_HEADINGS = ["불포함", "불포함사항", "제외"];
export const TERMS_HEADINGS = ["약관", "취소", "환불", "유의", "안내", "참고", "유의사항", "취소규정"];
export const ITINERARY_HEADINGS = ["일정", "여행일정", "상세일정", "여행 일정"];
