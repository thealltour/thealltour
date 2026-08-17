import "server-only";

import { getStorageProvider, type IStorageProvider } from "@/lib/storage";
import { getFilenameExt } from "@/lib/admin/bandImport/bandImportImageConstants";
import type {
  BandImportExtractedImage,
  BandImportUploadedImage,
} from "@/lib/admin/bandImport/bandImportImageConstants";
import { convertToJpg } from "@/lib/images/convertImage";

const STORAGE_PASSTHROUGH_MIME = new Set(["image/jpeg", "image/webp"]);

function storagePathForImage(storageExt: string, index: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `products/${yyyy}/${mm}/band-${timestamp}-${index}-${random}.${storageExt}`;
}

function passthroughStorageExt(filename: string, contentType: string): string {
  const ext = getFilenameExt(filename);
  if (contentType === "image/webp") return "webp";
  if (ext === "jpeg" || ext === "jpg") return ext;
  return "jpg";
}

async function toStorageImage(image: BandImportExtractedImage): Promise<{
  bytes: Buffer;
  contentType: string;
  storageExt: string;
}> {
  if (STORAGE_PASSTHROUGH_MIME.has(image.contentType)) {
    return {
      bytes: image.bytes,
      contentType: image.contentType,
      storageExt: passthroughStorageExt(image.filename, image.contentType),
    };
  }

  const jpgBuffer = await convertToJpg(image.bytes);
  if (!jpgBuffer?.length) {
    throw new Error(`PNG를 JPEG로 변환하지 못했습니다: ${image.filename}`);
  }
  return { bytes: jpgBuffer, contentType: "image/jpeg", storageExt: "jpg" };
}

export async function uploadBandImportImages(
  images: BandImportExtractedImage[],
  provider: IStorageProvider = getStorageProvider(),
): Promise<BandImportUploadedImage[]> {
  const uploaded: BandImportUploadedImage[] = [];
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    try {
      const stored = await toStorageImage(image);
      const blob = new Blob([new Uint8Array(stored.bytes)], { type: stored.contentType });
      const { url } = await provider.uploadPublicImage({
        file: blob,
        path: storagePathForImage(stored.storageExt, i),
        contentType: stored.contentType,
      });
      uploaded.push({
        url,
        filename: image.filename,
        contentType: stored.contentType,
        bytes: stored.bytes,
      });
    } catch (error) {
      console.error("[import-band] image upload skip:", image.filename, error);
    }
  }
  return uploaded;
}
