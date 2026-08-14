import "server-only";

import { getStorageProvider, type IStorageProvider } from "@/lib/storage";
import { getFilenameExt } from "@/lib/admin/bandImport/bandImportImageConstants";
import type {
  BandImportExtractedImage,
  BandImportUploadedImage,
} from "@/lib/admin/bandImport/bandImportImageConstants";

function storagePathForImage(filename: string, index: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  const ext = getFilenameExt(filename) || "jpg";
  return `products/${yyyy}/${mm}/band-${timestamp}-${index}-${random}.${ext}`;
}

export async function uploadBandImportImages(
  images: BandImportExtractedImage[],
  provider: IStorageProvider = getStorageProvider(),
): Promise<BandImportUploadedImage[]> {
  const uploaded: BandImportUploadedImage[] = [];
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const blob = new Blob([new Uint8Array(image.bytes)], { type: image.contentType });
    const { url } = await provider.uploadPublicImage({
      file: blob,
      path: storagePathForImage(image.filename, i),
      contentType: image.contentType,
    });
    uploaded.push({
      url,
      filename: image.filename,
      contentType: image.contentType,
      bytes: image.bytes,
    });
  }
  return uploaded;
}
