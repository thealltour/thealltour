import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseSupabaseStoragePublicUrl } from "./parseSupabaseStoragePublicUrl";

/** 관리자 업로드 API로 올라가는 버킷만 삭제 허용 */
const ALLOWED_BUCKETS = new Set(["product-images", "guide-pdfs"]);

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 삭제: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
  }
  return createClient(url, key);
}

export type DeleteStorageResult = {
  deletedPaths: string[];
  skippedUrls: string[];
  errors: string[];
};

/**
 * public URL 목록에 해당하는 객체를 스토리지에서 제거.
 * 허용 버킷이 아니거나 파싱 실패한 URL은 skippedUrls에 넣고 건너뜀.
 */
export async function deleteSupabaseStorageByPublicUrls(rawUrls: string[]): Promise<DeleteStorageResult> {
  const client = getSupabaseAdmin();
  const byBucket = new Map<string, Set<string>>();

  const skippedUrls: string[] = [];
  for (const raw of rawUrls) {
    const u = raw?.trim();
    if (!u) continue;
    const parsed = parseSupabaseStoragePublicUrl(u);
    if (!parsed || !ALLOWED_BUCKETS.has(parsed.bucket)) {
      skippedUrls.push(u);
      continue;
    }
    if (!byBucket.has(parsed.bucket)) byBucket.set(parsed.bucket, new Set());
    byBucket.get(parsed.bucket)!.add(parsed.path);
  }

  const deletedPaths: string[] = [];
  const errors: string[] = [];
  const REMOVE_CHUNK = 100;

  for (const [bucket, pathSet] of byBucket) {
    const paths = [...pathSet];
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
      const chunk = paths.slice(i, i + REMOVE_CHUNK);
      const { error } = await client.storage.from(bucket).remove(chunk);
      if (error) {
        errors.push(`[${bucket}] ${error.message}`);
      } else {
        deletedPaths.push(...chunk.map((p) => `${bucket}/${p}`));
      }
    }
  }

  return { deletedPaths, skippedUrls, errors };
}
