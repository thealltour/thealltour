import type { Product } from "@/types/product";
import type { ProductImageZipDownloadResult } from "./imageDownloadProgress.types";
import { downloadProductImagesAsZip } from "./downloadProductImagesAsZip";
import {
  BLOG_FRIENDLY_DEFAULT_QUALITY,
  NAVER_BLOG_IMAGE_MAX_BYTES,
} from "./imageDownloadPreset.storage";

/**
 * @deprecated 내부적으로 `downloadProductImagesAsZip`를 호출합니다. ZIP API를 직접 쓰는 것을 권장합니다.
 */
export async function downloadProductImages(product: Product): Promise<ProductImageZipDownloadResult> {
  return downloadProductImagesAsZip(product, {
    format: "jpg",
    quality: BLOG_FRIENDLY_DEFAULT_QUALITY,
    maxBytesPerImage: NAVER_BLOG_IMAGE_MAX_BYTES,
    namingMode: "detailed",
  });
}
