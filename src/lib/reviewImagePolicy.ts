/**
 * PR12: 리뷰 이미지 사이즈 정책 및 Storage 경로 규칙.
 * - thumbnail: 400px (목록/카드)
 * - medium: 900px (상세, DB image_urls 저장)
 * - original: 최대 1600px (확대/lightbox)
 */

export const REVIEW_IMAGE_BUCKET = "review-images";

export const IMAGE_WIDTH = {
  thumb: 400,
  medium: 900,
  original: 1600,
} as const;

export const WEBP_QUALITY = 85;

/** Storage 경로: review-images/{review_id}/{size}/{filename}.webp */
export function reviewImagePath(reviewId: string, size: "original" | "medium" | "thumb", filename: string): string {
  const base = `${reviewId}/${size}/${filename}`;
  return base;
}

/** medium URL에서 original URL로 변환 (lightbox/SEO용). */
export function mediumUrlToOriginalUrl(mediumUrl: string): string {
  if (!mediumUrl) return mediumUrl;
  return mediumUrl.replace(/\/medium\//, "/original/");
}

/** medium URL에서 thumb URL로 변환 (필요 시). */
export function mediumUrlToThumbUrl(mediumUrl: string): string {
  if (!mediumUrl) return mediumUrl;
  return mediumUrl.replace(/\/medium\//, "/thumb/");
}
