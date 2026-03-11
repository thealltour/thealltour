/**
 * 리뷰 이미지 관련 상수 (API·클라이언트 공통).
 * - 업로드 제한: MAX_REVIEW_IMAGES 장, MAX_REVIEW_IMAGE_SIZE_BYTES 이하.
 * - 허용 MIME/확장자: REVIEW_IMAGE_ALLOWED_MIME_TYPES / REVIEW_IMAGE_ALLOWED_EXTENSIONS.
 */

export const MAX_REVIEW_IMAGES = 10;

export const MAX_REVIEW_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** 리뷰 이미지 최대 용량(MB) — 안내 문구용 */
export const MAX_REVIEW_IMAGE_SIZE_MB = 10;

export const REVIEW_IMAGE_ALLOWED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const REVIEW_IMAGE_ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
