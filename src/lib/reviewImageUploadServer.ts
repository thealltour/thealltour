/**
 * PR12: 서버 측 리뷰 이미지 업로드.
 * - 원본 파일로부터 thumb / medium / original WebP 생성 후 Supabase Storage 업로드.
 * - image_urls에는 medium URL 기준 저장.
 */
import "server-only";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  REVIEW_IMAGE_BUCKET,
  IMAGE_WIDTH,
  WEBP_QUALITY,
  reviewImagePath,
} from "@/lib/reviewImagePolicy";

const OPTIONS = {
  original: { width: IMAGE_WIDTH.original, quality: WEBP_QUALITY },
  medium: { width: IMAGE_WIDTH.medium, quality: WEBP_QUALITY },
  thumb: { width: IMAGE_WIDTH.thumb, quality: WEBP_QUALITY },
} as const;

export type UploadReviewImageResult = {
  mediumUrl: string;
  originalUrl: string;
  thumbUrl: string;
};

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return base.endsWith(".webp") ? base : `${base}.webp`;
}

async function resizeToWebp(
  buffer: Buffer,
  width: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(width, undefined, { withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

export async function uploadReviewImageServer(
  fileBuffer: Buffer,
  reviewId: string,
  index: number,
): Promise<UploadReviewImageResult> {
  const filename = sanitizeFilename(`${index}.webp`);

  const [originalBuf, mediumBuf, thumbBuf] = await Promise.all([
    resizeToWebp(fileBuffer, OPTIONS.original.width, OPTIONS.original.quality),
    resizeToWebp(fileBuffer, OPTIONS.medium.width, OPTIONS.medium.quality),
    resizeToWebp(fileBuffer, OPTIONS.thumb.width, OPTIONS.thumb.quality),
  ]);

  const originalPath = reviewImagePath(reviewId, "original", filename);
  const mediumPath = reviewImagePath(reviewId, "medium", filename);
  const thumbPath = reviewImagePath(reviewId, "thumb", filename);

  const uploadOpts = { cacheControl: "31536000", upsert: true };
  const [origRes, medRes, thumbRes] = await Promise.all([
    supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).upload(originalPath, originalBuf, {
      ...uploadOpts,
      contentType: "image/webp",
    }),
    supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).upload(mediumPath, mediumBuf, {
      ...uploadOpts,
      contentType: "image/webp",
    }),
    supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).upload(thumbPath, thumbBuf, {
      ...uploadOpts,
      contentType: "image/webp",
    }),
  ]);

  if (origRes.error) throw new Error("원본 이미지 업로드 실패");
  if (medRes.error) throw new Error("medium 이미지 업로드 실패");
  if (thumbRes.error) throw new Error("thumb 이미지 업로드 실패");

  const getUrl = (path: string) =>
    supabaseAdmin.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;

  return {
    mediumUrl: getUrl(mediumPath),
    originalUrl: getUrl(originalPath),
    thumbUrl: getUrl(thumbPath),
  };
}
