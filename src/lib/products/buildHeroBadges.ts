import type { Product } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

const MAX_BADGES = 5;

/** 휴양/힐링 등 유사 키워드 → 하나의 배지 라벨로 통일 */
const THEME_BADGE_MAP: Record<string, string> = {
  휴양: "휴양/힐링",
  힐링: "휴양/힐링",
  "휴양/힐링": "휴양/힐링",
  힐링휴양: "휴양/힐링",
  가족: "가족 추천",
  "가족 추천": "가족 추천",
  커플: "커플 추천",
  "커플 추천": "커플 추천",
  골프: "골프",
  골프투어: "골프",
};

function normalizeBadgeLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const mapped = THEME_BADGE_MAP[trimmed] ?? THEME_BADGE_MAP[trimmed.toLowerCase()];
  return mapped ?? trimmed;
}

function dedupeBadges(badges: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of badges) {
    const n = normalizeBadgeLabel(b);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export type BuildHeroBadgesOptions = {
  /** 옵션 없음(노옵션) 여부. 미전달 시 product.options 기준으로 계산 */
  hasOptions?: boolean;
};

/**
 * PR34: Hero 배지용 라벨 배열 생성.
 * - 판매/운영(인기·추천·노옵션) → 상품 성격(가이드·핵심관광) → 테마/키워드 순.
 * - QuickInfoBar와 중복되는 항목(예약 가능, 항공 포함 등)은 제외.
 * - 최대 MAX_BADGES개, 중복/유사 의미 정리.
 */
export function buildHeroBadges(
  product: Product | null | undefined,
  options?: BuildHeroBadgesOptions,
): string[] {
  if (!product) return [];

  const hasOptions =
    options?.hasOptions ??
    (Boolean(product.options?.groups?.length) && (product.options?.groups?.length ?? 0) > 0);
  const badges: string[] = [];

  // 1. 판매/운영
  if (product.is_popular) badges.push("인기 상품");
  if (product.is_recommend) badges.push("추천");
  if (!hasOptions) badges.push("노옵션");

  // 2. 상품 성격 (가이드 동행, 핵심관광 포함)
  if (product.point_guide === "O" || String(product.point_guide).toUpperCase() === "O") {
    badges.push("가이드 동행");
  }
  if (product.point_tourism === "O" || String(product.point_tourism).toUpperCase() === "O") {
    badges.push("핵심관광 포함");
  }

  // 3. 테마/태그/하이라이트에서 짧은 키워드 (2~8자 정도, 설명형 제외)
  const fromHighlights = product.highlights?.length ? product.highlights : [];
  const fromTags = product.tags?.length ? product.tags : [];
  const fromThemes = product.theme ? parseThemeTokens(product.theme) : [];
  const themeCandidates = [...fromHighlights, ...fromTags, ...fromThemes]
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && t.length <= 10 && !/^[\d\s·]+$/.test(t));

  for (const t of themeCandidates) {
    if (badges.length >= MAX_BADGES) break;
    const normalized = normalizeBadgeLabel(t);
    if (!normalized || badges.includes(normalized)) continue;
    badges.push(normalized);
  }

  return dedupeBadges(badges).slice(0, MAX_BADGES);
}
