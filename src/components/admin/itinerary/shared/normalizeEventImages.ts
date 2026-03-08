/**
 * 이벤트 이미지 배열 정규화 (PR8.10: lib/images 통합).
 * - sortOrder 연속화(0..n-1) + isCover 1개 보장 + 빈 URL 제거 + url 정규화.
 * - EventImagesEditor, ModetourNewProductPage 등에서 공통 사용.
 */

export {
  normalizeEventImages,
  type EventImageInput,
  type EventImageNormalized,
} from "@/lib/images/normalizeEventImages";
