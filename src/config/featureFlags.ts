/**
 * 상품 카드/상세 UI 고도화 단계별 스위치
 * - false: 기존(레거시) UI 사용
 * - true: ProductCardV2 / ProductDetailV2 + Sticky CTA 사용
 * 롤백 시 false로 변경即可.
 */
export const ENABLE_NEW_PRODUCT_UI = true;

/**
 * 상품 옵션 선택 + 가격 변동 UI
 * - false: 옵션 UI 미노출, 기존 price/duration 그대로 표시
 * - true: options 데이터가 있을 때만 옵션 UI 노출
 */
export const ENABLE_PRODUCT_OPTIONS = true;
