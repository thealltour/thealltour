import type { FirstTouch } from "@/types/inquiry";

const GOLF_TEXT_PATTERN =
  /골프|golf|\bcc\b|씨씨|라운딩|티오프|티\s*타임|티타임|그린피|파\s*3|파\s*4|파\s*5|18홀|9홀|골프장|스크린골프|파크골프|park\s*golf/i;

const GOLF_SLUG_PATTERN = /golf|park-golf|parkgolf|골프/i;

export type GolfLeadContextInput = {
  landingSlug?: string | null;
  quoteCategory?: string | null;
  sourcePath?: string | null;
  productTitle?: string | null;
  inquiryPageUrl?: string | null;
  content?: string | null;
  firstTouch?: FirstTouch | null;
  /** 외부 랜딩 등에서 명시적으로 골프 리드로 표시 */
  forceGolf?: boolean;
};

function hasGolfSignal(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return GOLF_TEXT_PATTERN.test(text) || GOLF_SLUG_PATTERN.test(text);
}

function pathHasGolfLanding(path: string | null | undefined): boolean {
  if (!path?.trim()) return false;
  const p = path.toLowerCase();
  if (GOLF_SLUG_PATTERN.test(p)) return true;
  if (p.includes("/recommended/") && GOLF_SLUG_PATTERN.test(p)) return true;
  if (p.includes("quote_category=") && GOLF_SLUG_PATTERN.test(p)) return true;
  if (p.includes("tourtype=golf") || p.includes("golf-park")) return true;
  return false;
}

/** 문의/상담 body 기준 골프 리드 여부 판별 */
export function isGolfLeadContext(input: GolfLeadContextInput): boolean {
  if (input.forceGolf) return true;

  if (hasGolfSignal(input.landingSlug)) return true;
  if (hasGolfSignal(input.quoteCategory)) return true;
  if (hasGolfSignal(input.productTitle)) return true;
  if (hasGolfSignal(input.content)) return true;

  if (pathHasGolfLanding(input.sourcePath)) return true;
  if (pathHasGolfLanding(input.inquiryPageUrl)) return true;
  if (pathHasGolfLanding(input.firstTouch?.firstLandingUrl)) return true;

  const utmCampaign = input.firstTouch?.utm_campaign?.trim() ?? "";
  const utmContent = input.firstTouch?.utm_content?.trim() ?? "";
  if (hasGolfSignal(utmCampaign) || hasGolfSignal(utmContent)) return true;

  return false;
}

export type GolfLeadSourceKind = "landing" | "product" | "quote" | "site" | "external";

/** landing_page 경로로 유입 유형 추론 (통계용) */
export function inferGolfLeadSourceKind(landingPage: string | null | undefined): GolfLeadSourceKind {
  const p = (landingPage ?? "").trim().toLowerCase();
  if (!p) return "external";
  if (p.startsWith("/recommended/") || p.includes("/recommended/")) return "landing";
  if (p.startsWith("/products/") || p.includes("/products/")) return "product";
  if (p === "/quote" || p.startsWith("/quote")) return "quote";
  if (p.startsWith("http")) return "external";
  return "site";
}

export const GOLF_LEAD_SOURCE_LABELS: Record<GolfLeadSourceKind, string> = {
  landing: "검색/유입 랜딩",
  product: "상품 상세",
  quote: "견적(quote) 페이지",
  site: "사이트 일반",
  external: "외부 랜딩",
};
