"use client";

import { supabase } from "@/lib/supabase";

const REVIEW_IMAGE_BUCKET = "review-images";
const MAX_REVIEW_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function uploadReviewImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("jpg, png, webp, gif 형식만 업로드할 수 있습니다.");
  }
  if (file.size > MAX_REVIEW_IMAGE_SIZE) {
    throw new Error("이미지 용량은 5MB 이하만 업로드할 수 있습니다.");
  }

  const extension = sanitizeFileName(file.name.split(".").pop() ?? "jpg");
  const filePath = `public/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

  const uploadResult = await supabase.storage.from(REVIEW_IMAGE_BUCKET).upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadResult.error) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }

  const publicResult = supabase.storage.from(REVIEW_IMAGE_BUCKET).getPublicUrl(filePath);
  return publicResult.data.publicUrl;
}
