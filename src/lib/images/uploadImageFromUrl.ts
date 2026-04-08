/**
 * PR-IMAGE-3: 외부 URL → 다운로드 → JPG 변환 → Supabase product-images 업로드.
 * 서버(API 라우트 등)에서만 사용.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { downloadImageBuffer } from "./downloadImage";
import { convertToJpg } from "./convertImage";

const BUCKET = "product-images";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function generateImportJpgPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 12);
  return `products/${yyyy}/${mm}/modetour-import-${timestamp}-${random}.jpg`;
}

export type UploadImageFromUrlResult =
  | { success: true; url: string; path: string }
  | { success: false; error?: string };

export async function uploadImageFromUrl(url: string): Promise<UploadImageFromUrlResult> {
  const buffer = await downloadImageBuffer(url);
  if (!buffer?.length) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[IMAGE][UPLOAD_FAIL]", url, "(download)");
    }
    return { success: false, error: "download_failed" };
  }

  const jpgBuffer = await convertToJpg(buffer);
  if (!jpgBuffer?.length) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[IMAGE][UPLOAD_FAIL]", url, "(convert)");
    }
    return { success: false, error: "convert_failed" };
  }

  const path = generateImportJpgPath();

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, jpgBuffer, {
    contentType: "image/jpeg",
    cacheControl: CACHE_CONTROL,
    upsert: false,
  });

  if (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[IMAGE][UPLOAD_FAIL]", url, error.message);
    }
    return { success: false, error: error.message };
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;
  if (typeof console !== "undefined" && console.log) {
    console.log("[IMAGE][UPLOAD_SUCCESS]", publicUrl);
  }
  return { success: true, url: publicUrl, path };
}
