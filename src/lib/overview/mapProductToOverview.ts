/**
 * @deprecated Use mapProductToOverview from @/lib/products/mapProductToOverview and toProductOverview for ProductOverview.
 * [STEP 0] 여행 오버뷰: Product 기반 자동 생성
 * - 별도 overview_json 입력 없이 기존 상품 필드(항공/숙소/지역/기간/이미지/일정/포함/옵션/Trust 등)로 오버뷰 생성
 * - ProductDetailV2는 이 함수 결과(ProductOverview)만 받아 TravelOverviewV2 렌더
 */

import { mapProductToOverview as mapProductToOverviewNew, toProductOverview } from "@/lib/products/mapProductToOverview";
import type { Product, ProductOverview } from "@/types/product";

/** @deprecated Use mapProductToOverview + toProductOverview from @/lib/products/mapProductToOverview */
export function mapProductToOverview(product: Product): ProductOverview {
  return toProductOverview(mapProductToOverviewNew(product));
}
