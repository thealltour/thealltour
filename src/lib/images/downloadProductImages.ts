import type { Product } from "@/types/product";
import type { ProductImageZipDownloadResult } from "./imageDownloadProgress.types";
import { downloadProductImagesAsZip } from "./downloadProductImagesAsZip";

/**
 * @deprecated 내부적으로 `downloadProductImagesAsZip`를 호출합니다. ZIP API를 직접 쓰는 것을 권장합니다.
 */
export async function downloadProductImages(product: Product): Promise<ProductImageZipDownloadResult> {
  return downloadProductImagesAsZip(product, {
    format: "png",
    namingMode: "detailed",
  });
}
