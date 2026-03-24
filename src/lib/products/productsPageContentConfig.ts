import type { ProductFiltersState } from "@/lib/productFilters";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

/**
 * `ProductsPageContent` 랜딩·목록 퍼널 옵션 — page 호출부에서 객체 하나로 전달.
 * 초기 필터 우선순위(URL 대비)는 `productsListingPolicy.resolveProductsPageInitialFilters` 에 고정된다.
 */
export type ProductsPageContentListingConfig = {
  /**
   * 서버(랜딩 해석·`/products/region|theme/[slug]`)에서 계산한 초기 필터.
   * 랜딩 쿼리(destination/city/theme)가 있거나 URL에 region/theme/product_line/sort/q 가 없을 때
   * 클라이언트 초기값으로 이 객체가 우선한다.
   */
  initialFiltersFromServer?: ProductFiltersState | null;
  /** `router.push`·칩 제거 시 유지할 경로 (`/products` 또는 `/products/region/...` 등) */
  basePath?: string;
  /** 툴바/헤더에만 쓰는 맥락 라벨(필터 상태와 별도) */
  filterContextLabel?: string | null;
  /**
   * 초기 region 필터가 랜딩 슬러그와 일치할 때 `applyProductFilters` 에 넘기는 하위 지역 집합.
   * 없으면 클라이언트에서 `regionTaxonomies` 로 계산한다.
   */
  initialRegionDescendants?: { ids: string[]; names: string[] } | null;
  /** 동일하게 테마 하위 이름 목록(랜딩에서만 채움) */
  initialThemeDescendantNames?: string[] | null;
  cardLayout?: "list" | "related";
  mobileListToolbarBelowBackHeader?: boolean;
  /** FK/이름 매핑·하위 전개용 지역 택소노미(전체 트리) */
  regionTaxonomies?: ProductTaxonomy[] | null;
  themeTaxonomies?: ProductTaxonomy[] | null;
};
