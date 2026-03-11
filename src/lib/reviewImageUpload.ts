"use client";

/**
 * PR12: 리뷰 이미지 업로드 (API 연동).
 * - reviewId 필수. 업로드 전 클라이언트에서 압축(ReviewWriteForm) 권장.
 * - 서버에서 thumb/medium/original 생성 후 medium URL 반환.
 */
import {
  MAX_REVIEW_IMAGE_SIZE_BYTES,
  REVIEW_IMAGE_ALLOWED_MIME_TYPES,
} from "@/lib/constants/review";

export async function uploadReviewImage(
  file: File,
  reviewId: string,
  index: number = 0,
): Promise<string> {
  if (!reviewId) {
    throw new Error("이미지 업로드에는 후기 ID가 필요합니다. 먼저 임시저장해 주세요.");
  }
  if (!REVIEW_IMAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("jpg, png, webp, gif 형식만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_REVIEW_IMAGE_SIZE_BYTES) {
    throw new Error("이미지 용량은 10MB 이하만 업로드할 수 있습니다.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("reviewId", reviewId);
  form.append("index", String(index));

  const res = await fetch("/api/reviews/upload-image", {
    method: "POST",
    body: form,
  });

  const data = (await res.json()) as { message?: string; url?: string };
  if (!res.ok) {
    throw new Error(data.message ?? "이미지 업로드에 실패했습니다.");
  }
  if (!data.url) {
    throw new Error("서버에서 이미지 URL을 반환하지 않았습니다.");
  }
  return data.url;
}
