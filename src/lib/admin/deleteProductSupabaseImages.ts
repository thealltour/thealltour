import type { Product } from "@/types/product";
import { collectProductImageUrls } from "@/lib/images/collectProductImageUrls";
import { deleteSupabaseStorageByPublicUrls } from "@/lib/storage/deleteSupabaseStorageByPublicUrls";

/**
 * 상품에 연결된 Supabase Storage 객체만 삭제.
 * 외부 CDN URL은 건너뛴다. 실패해도 예외를 삼키지 않고 결과를 반환한다.
 *
 * 복제 상품이 같은 public URL을 공유하면, 한쪽 삭제 시 파일도 함께 지워진다.
 */
export async function deleteProductSupabaseImages(product: Product) {
  const urls = collectProductImageUrls(product);
  if (urls.length === 0) {
    return { deletedPaths: [] as string[], skippedUrls: [] as string[], errors: [] as string[] };
  }
  return deleteSupabaseStorageByPublicUrls(urls);
}
