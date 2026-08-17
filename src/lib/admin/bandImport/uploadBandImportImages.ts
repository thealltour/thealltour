import "server-only";

import { getStorageProvider, type IStorageProvider } from "@/lib/storage";
import {
  detectImageMime,
  getFilenameExt,
} from "@/lib/admin/bandImport/bandImportImageConstants";
import type {
  BandImportExtractedImage,
  BandImportUploadedImage,
} from "@/lib/admin/bandImport/bandImportImageConstants";
import { convertToJpg } from "@/lib/images/convertImage";

function storagePathForImage(storageExt: string, index: number): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `products/${yyyy}/${mm}/band-${timestamp}-${index}-${random}.${storageExt}`;
}

function extForContentType(filename: string, contentType: string): string {
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/png") return "png";
  const ext = getFilenameExt(filename);
  if (ext === "jpeg" || ext === "jpg") return ext;
  return "jpg";
}

async function toStorageImage(image: BandImportExtractedImage): Promise<{
  bytes: Buffer;
  contentType: string;
  storageExt: string;
}> {
  const detected = detectImageMime(image.bytes) ?? image.contentType;

  if (detected === "image/jpeg" || detected === "image/webp") {
    return {
      bytes: image.bytes,
      contentType: detected,
      storageExt: extForContentType(image.filename, detected),
    };
  }

  if (detected === "image/png") {
    const jpgBuffer = await convertToJpg(image.bytes);
    if (jpgBuffer?.length) {
      return { bytes: jpgBuffer, contentType: "image/jpeg", storageExt: "jpg" };
    }
    return { bytes: image.bytes, contentType: "image/png", storageExt: "png" };
  }

  const jpgBuffer = await convertToJpg(image.bytes);
  if (jpgBuffer?.length) {
    return { bytes: jpgBuffer, contentType: "image/jpeg", storageExt: "jpg" };
  }
  throw new Error(`지원하지 않는 이미지 형식입니다: ${image.filename}`);
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
      const detail = error instanceof Error ? error.message : String(error);
      const message = `${image.filename}: ${detail}`;
      errors.push(message);
      console.error("[import-band] image upload skip:", message);
    }
  }

  return { uploaded, errors };
}
