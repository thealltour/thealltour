import "server-only";

import { getStorageProvider, type IStorageProvider } from "@/lib/storage";
import { detectImageMime } from "@/lib/admin/bandImport/bandImportImageConstants";
import type {
  BandImportExtractedImage,
  BandImportUploadedImage,
} from "@/lib/admin/bandImport/bandImportImageConstants";
import { convertToWebp } from "@/lib/images/convertImage";

function storagePathForImage(index: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `products/${yyyy}/${mm}/band-${timestamp}-${index}-${random}.webp`;
}

async function toStorageImage(image: BandImportExtractedImage): Promise<{
  bytes: Buffer;
  contentType: "image/webp";
}> {
  const detected = detectImageMime(image.bytes) ?? image.contentType;
  if (detected === "image/webp") {
    return { bytes: image.bytes, contentType: "image/webp" };
  }

  const webpBuffer = await convertToWebp(image.bytes);
  if (!webpBuffer?.length) {
    throw new Error(`이미지를 WebP로 변환하지 못했습니다: ${image.filename}`);
  }
  return { bytes: webpBuffer, contentType: "image/webp" };
}

export async function uploadBandImportImages(
  images: BandImportExtractedImage[],
  provider: IStorageProvider = getStorageProvider(),
): Promise<{ uploaded: BandImportUploadedImage[]; errors: string[] }> {
  const uploaded: BandImportUploadedImage[] = [];
  const errors: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      const stored = await toStorageImage(image);
      const { url } = await provider.uploadPublicImage({
        file: stored.bytes,
        path: storagePathForImage(i),
        contentType: stored.contentType,
      });
      uploaded.push({
        url,
        filename: image.filename,
        contentType: stored.contentType,
        bytes: stored.bytes,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `${image.filename}: ${detail}`;
      errors.push(message);
      console.error("[import-band] image upload skip:", message);
    }
  }

  return { uploaded, errors };
}
