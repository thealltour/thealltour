import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { IStorageProvider } from "../StorageProvider";

const BUCKET = "product-images";
const CACHE_CONTROL = "public, max-age=31536000, immutable";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SupabaseStorageProvider: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다. (서버 전용)"
    );
  }
  return createClient(url, key);
}

export class SupabaseStorageProvider implements IStorageProvider {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? getSupabaseAdmin();
  }

  async uploadPublicImage(params: {
    file: Blob | File | Buffer;
    path: string;
    contentType: string;
    bucket?: string;
  }): Promise<{ url: string; path: string }> {
    const { file, path, contentType, bucket = BUCKET } = params;
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error("빈 파일은 업로드할 수 없습니다.");
    }

    const { error } = await this.client.storage.from(bucket).upload(path, buffer, {
      contentType,
      cacheControl: CACHE_CONTROL,
      upsert: false,
    });

    if (error) {
      throw new Error(`스토리지 업로드 실패: ${error.message}`);
    }

    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
}
