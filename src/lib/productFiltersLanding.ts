import {
  getDestinationBySlug,
  getThemeBySlug,
  getTaxonomyNameBySlug,
} from "@/lib/productTaxonomies";
import type { ProductFiltersState } from "@/lib/productFilters";

/**
 * 상품 목록 랜딩 파라미 해석 (PR-7A).
 * theme 등은 문자열 패턴(하이픈 포함 등)이 아니라 실제 slug/이름 조회 결과로만 판별.
 * - hasLandingParams: destination/city/theme 중 하나라도 있으면 true (패턴 없음).
 * - resolveLandingParams: theme → getThemeBySlug 시도 → 성공 시 name 사용, 실패 시 getTaxonomyNameBySlug → 그래도 없으면 쿼리값을 theme 이름으로 사용.
 * destination/city/style/spot 확장 시에도 동일하게 “조회 기반”으로 처리할 수 있도록 구조 유지.
 * destination/city/style/spot 확장 시에도 동일하게 "조회 기반"으로 처리할 수 있도록 구조 유지.
 *
 * 해석 실패 시 (예: destination=unknown-place): getDestinationBySlug·getTaxonomyNameBySlug 모두 실패하면
 * region/theme 은 null 로 두어 일반 목록으로 안전하게 전환. 페이지는 깨지지 않음.
 */
export type ResolvedLandingFilters = {
  /** 랜딩 파라미가 있어서 해석된 초기 필터 (클라이언트에 전달) */
  initialFilters: ProductFiltersState;
  /** 키워드 표시용 (q 또는 city) */
  initialKeyword: string;
};

/**
 * /products 진입 시 destination, city, theme 쿼리를 해석해 region/theme/q 로 변환.
 * theme는 문자열 패턴이 아니라 실제 slug 조회(getThemeBySlug) 성공 여부로 해석.
 * - 조회 성공 → 랜딩 slug로 판단, 해당 taxonomy의 name을 필터용 theme로 사용
 * - 조회 실패 → getTaxonomyNameBySlug fallback 후에도 없으면 쿼리값을 그대로 theme 이름으로 사용(일반 필터)
 * destination/city/style/spot 등도 동일한 “조회 기반” 확장 가능.
 */
export async function resolveLandingParams(
  query: Record<string, string | string[] | undefined>,
): Promise<ResolvedLandingFilters | null> {
  const destination = typeof query.destination === "string" ? query.destination.trim() : "";
  const city = typeof query.city === "string" ? query.city.trim() : "";
  const themeParam = typeof query.theme === "string" ? query.theme.trim() : "";
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const sort = typeof query.sort === "string" ? query.sort.trim() : "";

  if (!destination && !city && !themeParam) return null;

  let region: string | null = null;
  let theme: string | null = null;

  if (destination) {
    const dest = await getDestinationBySlug(destination);
    if (dest) region = dest.name.trim() || null;
    else region = await getTaxonomyNameBySlug("category", destination);
  }

  if (themeParam) {
    const bySlug = await getThemeBySlug(themeParam);
    if (bySlug) {
      theme = bySlug.name.trim() || null;
    } else {
      const byName = await getTaxonomyNameBySlug("theme", themeParam);
      theme = byName ?? themeParam;
    }
  }

  const keyword = q || city || "";
  const sortId =
    sort === "popular" || sort === "latest" || sort === "new" ? sort : "";

  return {
    initialFilters: {
      region,
      theme,
      product_line: null,
      q: keyword || null,
      sort: sortId,
    },
    initialKeyword: keyword,
  };
}

/**
 * 랜딩 파라미 존재 여부. theme는 패턴이 아니라 “resolveLandingParams 호출 대상” 여부만 판단.
 * 실제 theme가 slug인지 이름인지는 resolveLandingParams 내부에서 조회 기반으로 해석.
 */
export function hasLandingParams(
  query: Record<string, string | string[] | undefined>,
): boolean {
  const d = typeof query.destination === "string" && query.destination.trim();
  const c = typeof query.city === "string" && query.city.trim();
  const t = typeof query.theme === "string" && query.theme.trim();
  return Boolean(d || c || t);
}
