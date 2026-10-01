import type { Product } from "@/types/product";
import { collectProductImageUrls } from "@/lib/images/collectProductImageUrls";
import { deleteSupabaseStorageByPublicUrls } from "@/lib/storage/deleteSupabaseStorageByPublicUrls";

/** 다른 상품이 아직 쓰는 URL을 삭제 대상에서 뺀다 */
export function excludeSharedImageUrls(urls: string[], sharedWith: Product[]): string[] {
  if (sharedWith.length === 0) return urls;
  const inUse = new Set(sharedWith.flatMap((other) => collectProductImageUrls(other)));
  return urls.filter((url) => !inUse.has(url));
}

/**
 * 상품에 연결된 Supabase Storage 객체만 삭제.
 * 외부 CDN URL은 건너뛴다. 실패해도 예외를 삼키지 않고 결과를 반환한다.
 *
 * 출발지별 형제 상품처럼 같은 public URL을 공유하는 상품은 `sharedWith`로 넘겨야 파일이 보존된다.
 * 넘기지 않은 복제 상품이 같은 URL을 쓰면 한쪽 삭제 시 파일도 함께 지워진다.
 */
export async function deleteProductSupabaseImages(
  product: Product,
  options: { sharedWith?: Product[] } = {},
) {
  const urls = excludeSharedImageUrls(collectProductImageUrls(product), options.sharedWith ?? []);
  if (urls.length === 0) {
    return { deletedPaths: [] as string[], skippedUrls: [] as string[], errors: [] as string[] };
  }
  return deleteSupabaseStorageByPublicUrls(urls);
}
