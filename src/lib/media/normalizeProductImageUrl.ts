/**
 * 상품 이미지 URL 정규화
 *
 * 현재: 입력 URL 그대로 반환
 * 향후: /media/products/... 프록시 도입 시 이 함수만 수정
 */
export function normalizeProductImageUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  return url.trim();
}
