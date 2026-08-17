import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { BAND_IMPORT_STAGING_BUCKET, getFilenameExt } from "@/lib/admin/bandImport/bandImportImageConstants";

/**
 * 밴드 상품 등록 시 zip/사진 원본을 Vercel 함수(4.5MB 요청 본문 제한)를 거치지 않고
 * 브라우저에서 Supabase Storage로 직접 업로드하기 위한 스테이징 헬퍼.
 * 서버는 signed upload URL만 발급하고, 처리 후 스테이징 파일을 삭제한다.
 */

function sanitizeExt(ext: string): string {
  return /^[a-z0-9]{1,10}$/i.test(ext) ? ext.toLowerCase() : "bin";
}

function buildStagingPath(filename: string): string {
  const ext = sanitizeExt(getFilenameExt(filename));
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}.${ext}`;
}

export async function createBandImportStagingUploadTarget(
  filename: string,
): Promise<{ path: string; token: string }> {
  const path = buildStagingPath(filename);
  const { data, error } = await supabaseAdmin.storage
    .from(BAND_IMPORT_STAGING_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`업로드 URL 발급에 실패했습니다: ${error?.message ?? "unknown error"}`);
  }
  return { path: data.path, token: data.token };
}

export async function downloadBandImportStagingFile(
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const { data, error } = await supabaseAdmin.storage.from(BAND_IMPORT_STAGING_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`스테이징 파일을 내려받지 못했습니다 (${path}): ${error?.message ?? "unknown error"}`);
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { bytes, contentType: data.type || "application/octet-stream" };
}

export async function deleteBandImportStagingFiles(paths: string[]): Promise<void> {
  const targets = paths.filter((p): p is string => typeof p === "string" && p.length > 0);
  if (targets.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(BAND_IMPORT_STAGING_BUCKET).remove(targets);
  if (error) {
    console.error("[bandImportStaging] 스테이징 파일 삭제 실패:", error.message, targets);
  }
}
