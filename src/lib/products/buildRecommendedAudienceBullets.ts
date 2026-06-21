import type { Product, SeasonalPriceBands } from "@/types/product";
import { parseThemeTokens } from "@/lib/productTaxonomies";

const THEME_AUDIENCE_RULES: Array<{ keywords: string[]; bullet: string }> = [
  { keywords: ["골프"], bullet: "골프 여행을 계획 중인 분" },
  { keywords: ["크루즈"], bullet: "크루즈 여행을 원하는 분" },
  { keywords: ["가족"], bullet: "가족과 함께하는 여행을 찾는 분" },
  { keywords: ["허니문", "신혼"], bullet: "허니문·신혼 여행을 계획 중인 분" },
  { keywords: ["커플"], bullet: "커플 여행을 원하는 분" },
  { keywords: ["힐링", "휴양"], bullet: "휴식과 힐링을 중시하는 분" },
  { keywords: ["트레킹", "등산"], bullet: "트레킹·등산 여행을 원하는 분" },
  { keywords: ["쇼핑"], bullet: "쇼핑 여행을 즐기고 싶은 분" },
];

function hasPositivePrice(value?: number | null): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function collectSearchText(product: Product): string {
  const parts = [
    product.theme,
    product.travelStyle,
    product.category,
    ...(product.tags ?? []),
    ...(product.highlights ?? []),
    ...parseThemeTokens(product.theme ?? ""),
  ];
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasFlightIncluded(product: Product): boolean {
  return Boolean(
    product.departure_flight_name?.trim() ||
      product.departure_from_airport?.trim() ||
      product.departure_to_airport?.trim() ||
      product.airline?.trim() ||
      product.meta_info?.includes("항공"),
  );
}

function pushUnique(bullets: string[], seen: Set<string>, text: string): void {
  const trimmed = text.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  bullets.push(trimmed);
}

export type BuildRecommendedAudienceBulletsOptions = {
  /** highlights 카드에 동일 문구가 노출되면 highlight 파생 bullet 생략 */
  skipHighlightDerived?: boolean;
  /** seasonal_price_bands override (테스트·미리보기용) */
  seasonalBands?: SeasonalPriceBands | null;
};

/**
 * 상품 데이터에서 「이런 분께 잘 맞아요」 bullet을 파생합니다.
 * 의미 있는 문구가 2개 미만이면 UI에서 섹션을 숨깁니다.
 */
export function buildRecommendedAudienceBullets(
  product: Product | null | undefined,
  options?: BuildRecommendedAudienceBulletsOptions,
): string[] {
  if (!product) return [];

  const bullets: string[] = [];
  const seen = new Set<string>();
  const searchText = collectSearchText(product);

  for (const rule of THEME_AUDIENCE_RULES) {
    if (rule.keywords.some((keyword) => searchText.includes(keyword.toLowerCase()))) {
      pushUnique(bullets, seen, rule.bullet);
    }
  }

  const duration = product.duration?.trim() || product.overview_duration?.trim();
  if (duration) {
    pushUnique(bullets, seen, `${duration} 일정을 찾는 분`);
  }

  const bands = options?.seasonalBands ?? product.seasonal_price_bands;
  if (bands) {
    if (hasPositivePrice(bands.weekend)) {
      pushUnique(bullets, seen, "주말 출발 일정을 선호하는 분");
    }
    if (hasPositivePrice(bands.offSeason)) {
      pushUnique(bullets, seen, "비수기 가성비를 중요하게 보는 분");
    }
    if (hasPositivePrice(bands.peakSeason)) {
      pushUnique(bullets, seen, "성수기 여행을 계획 중인 분");
    }
  }

  if (hasFlightIncluded(product)) {
    pushUnique(bullets, seen, "항공 포함 패키지를 원하는 분");
  }

  const hotel = product.hotel?.trim();
  if (hotel) {
    pushUnique(bullets, seen, "숙소 조건을 중요하게 보는 분");
  }

  if (!options?.skipHighlightDerived) {
    const highlightSource =
      product.highlights?.length ? product.highlights : (product.tags ?? []);
    for (const item of highlightSource.slice(0, 2)) {
      const label = item.trim();
      if (label.length < 2 || label.length > 24) continue;
      pushUnique(bullets, seen, `${label} 여행을 원하는 분`);
    }
  }

  return bullets.slice(0, 3);
}

export function shouldShowRecommendedAudience(bullets: string[]): boolean {
  return bullets.length >= 2;
}
