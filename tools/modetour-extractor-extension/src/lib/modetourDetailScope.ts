/**
 * 모두투어 상품 상세 탭 공통 scope 유틸.
 * 포함/불포함, 일정 안내, 예약 조건, 환불·취소 규정 파서가 동일 root 내부에서만 동작하도록 사용.
 */

const TAB_LABEL_KEYWORDS = [
  "일정 안내",
  "일정안내",
  "포함/불포함",
  "포함 불포함",
  "예약 조건",
  "예약조건",
  "환불",
  "취소 규정",
  "취소규정",
];

export const FOOTER_KEYWORDS = [
  "회사소개",
  "개인정보처리방침",
  "개인정보 처리방침",
  "여행약관",
  "이용약관",
  "여행보험",
  "마케팅제휴",
  "마케팅 제휴",
  "온라인제휴",
  "온라인 제휴",
  "고객센터",
  "사업자정보",
  "공정거래위원회",
  "통신판매업",
  "대표이사",
];

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

const HEADING_TAB_SELECTORS =
  "h1, h2, h3, h4, [role='tab'], button, a, [class*='tab'], [class*='title'], [class*='heading']";

/**
 * 노드 또는 그 조상의 textContent에 footer 고유 키워드가 포함되는지 여부.
 * 2개 이상 키워드 매칭 시 footer-like로 판정.
 */
export function isFooterLikeContainer(el: Element): boolean {
  const text = (el as HTMLElement).textContent ?? "";
  const lower = text.toLowerCase();
  const matchCount = FOOTER_KEYWORDS.filter((k) => lower.includes(k.toLowerCase())).length;
  return matchCount >= 2;
}

/**
 * 상품 상세 탭 영역 root 탐색.
 * "일정 안내", "포함/불포함", "예약 조건", "환불/취소" 등 탭 라벨이 모여 있고,
 * footer 키워드가 없는 컨테이너를 반환.
 */
export function findModetourDetailTabRoot(doc: Document): Element | null {
  const candidates = doc.querySelectorAll(HEADING_TAB_SELECTORS);
  let best: Element | null = null;
  let bestScore = -1;

  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    if (text.length < 2 || text.length > 100) continue;
    const lower = text.toLowerCase();
    const matchedTabs = TAB_LABEL_KEYWORDS.filter((k) => lower.includes(k.toLowerCase()));
    if (matchedTabs.length === 0) continue;

    let root: Element | null = el.parentElement;
    for (let i = 0; i < 25 && root; i++) {
      const tag = root.tagName.toLowerCase();
      const role = root.getAttribute("role");
      const cls = (root.className?.toString() ?? "").toLowerCase();
      const isReasonable =
        tag === "main" ||
        tag === "section" ||
        tag === "article" ||
        role === "tabpanel" ||
        cls.includes("detail") ||
        cls.includes("content") ||
        cls.includes("tab") ||
        cls.includes("panel") ||
        cls.includes("product") ||
        tag === "div";

      if (isReasonable) {
        if (root === doc.body) break;
        if (isFooterLikeContainer(root)) break;
        const rootText = (root as HTMLElement).textContent ?? "";
        const tabLabelCount = TAB_LABEL_KEYWORDS.filter((k) =>
          rootText.toLowerCase().includes(k.toLowerCase()),
        ).length;
        if (tabLabelCount >= 1) {
          const score = tabLabelCount * 10 + (rootText.length < 50000 ? 5 : 0);
          if (score > bestScore) {
            bestScore = score;
            best = root;
          }
        }
      }
      root = root.parentElement;
    }
  }

  if (best && isFooterLikeContainer(best)) return null;
  return best;
}

/**
 * detail root를 못 찾았을 때 fallback으로 사용할 비교적 좁은 콘텐츠 루트.
 * body 전체는 반환하지 않고, footer-like 컨테이너는 제외.
 */
export function getScopedFallbackRoot(doc: Document): Element | null {
  const main = doc.querySelector("main");
  if (main && !isFooterLikeContainer(main)) return main;

  const sections = doc.querySelectorAll("section, article");
  for (const el of sections) {
    if (isFooterLikeContainer(el)) continue;
    const textLen = (el as HTMLElement).textContent?.length ?? 0;
    if (textLen < 100 || textLen > 500000) continue;
    const lower = (el.className?.toString() ?? "").toLowerCase();
    if (lower.includes("footer") || lower.includes("gnb") || lower.includes("nav")) continue;
    return el;
  }

  const contentCandidates = doc.querySelectorAll("[class*='content'], [class*='detail'], [class*='product']");
  for (const el of contentCandidates) {
    if (el === doc.body) continue;
    if (isFooterLikeContainer(el)) continue;
    const textLen = (el as HTMLElement).textContent?.length ?? 0;
    if (textLen < 200 || textLen > 400000) continue;
    return el;
  }

  return null;
}

/** 한 줄이 footer 메뉴 항목처럼 보이면 true */
function isFooterLikeLine(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 80) return false;
  return FOOTER_ITEM_PATTERNS.some((re) => re.test(t));
}

/**
 * 문자열 배열이 footer 메뉴 항목 위주면 true (상세 탭/포함·불포함 결과로 쓰면 안 됨).
 */
export function isFooterLikeItems(items: string[]): boolean {
  if (!items.length) return false;
  const footerCount = items.filter(isFooterLikeLine).length;
  return footerCount >= 2 || (items.length <= 5 && footerCount >= 1);
}

/**
 * 상세 탭에서 추출한 라인 배열이 유효한지 검증.
 * footer-like 키워드 위주면 false.
 */
export function isPlausibleDetailTabLines(lines: string[]): boolean {
  if (!lines.length) return false;
  if (isFooterLikeItems(lines)) return false;
  return true;
}
