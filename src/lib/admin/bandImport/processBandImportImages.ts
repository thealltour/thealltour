import "server-only";

import { applyBandImageAssignments } from "@/lib/admin/bandImport/applyBandImageAssignments";
import { classifyBandImportImages } from "@/lib/admin/bandImport/classifyBandImportImages";
import {
  extractBandImportImagesWithStats,
  BandImportImageError,
} from "@/lib/admin/bandImport/extractBandImportImages";
import { uploadBandImportImages } from "@/lib/admin/bandImport/uploadBandImportImages";
import { downloadBandImportStagingFile } from "@/lib/admin/bandImport/bandImportStaging";
import type {
  BandImageAssignment,
  BandImportImageSource,
  BandImportImageSummary,
} from "@/lib/admin/bandImport/bandImportImageConstants";
import { deleteSupabaseStorageByPublicUrls } from "@/lib/storage/deleteSupabaseStorageByPublicUrls";
import type { BandVenueImagePathGroup, BandVenueKind } from "@/lib/admin/bandImport/bandVenueImages";

export async function filesToBandImportSources(files: File[]): Promise<BandImportImageSource[]> {
  const sources: BandImportImageSource[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.size <= 0) continue;
    sources.push({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      type: file.type,
    });
  }
  return sources;
}

/** 브라우저가 Supabase Storage에 직접 올려둔 스테이징 zip/사진을 내려받아 소스로 변환. */
export async function stagingPathsToBandImportSources(
  items: Array<{ path: string; filename?: string }>,
): Promise<BandImportImageSource[]> {
  const sources: BandImportImageSource[] = [];
  for (const item of items) {
    const path = item.path?.trim();
    if (!path || path.includes("..") || path.includes("\\")) continue;
    const { bytes, contentType } = await downloadBandImportStagingFile(path);
    sources.push({
      name: item.filename?.trim() || path.split("/").pop() || path,
      bytes,
      type: contentType,
    });
  }
  return sources;
}

/** 공개 스토리지에 올린 사진을 되돌립니다. 실패해도 등록 흐름을 막지 않습니다. */
export async function discardUploadedBandImages(urls: string[], reason: string): Promise<void> {
  const targets = urls.map((url) => url?.trim()).filter((url): url is string => Boolean(url));
  if (targets.length === 0) return;
  try {
    const result = await deleteSupabaseStorageByPublicUrls(targets);
    if (result.errors.length > 0) {
      console.warn(`[import-band] ${reason} cleanup errors:`, result.errors.join(" | "));
    }
  } catch (error) {
    console.warn(`[import-band] ${reason} cleanup failed:`, error);
  }
}

export type BandVenueImageUploadResult = Record<BandVenueKind, Map<number, string[]>> & {
  uploadedUrls: string[];
  uploadErrors: number;
};

/** 골프장·호텔·관광지 전용 사진: 분류 없이 webp 변환·업로드만 합니다. */
export async function uploadBandVenueImages(
  groups: Array<BandVenueImagePathGroup & { rowName: string }>,
): Promise<BandVenueImageUploadResult> {
  const result: BandVenueImageUploadResult = {
    golf: new Map(),
    hotel: new Map(),
    attraction: new Map(),
    uploadedUrls: [],
    uploadErrors: 0,
  };

  try {
    for (const group of groups) {
      if (!group.rowName) continue;
      const sources = await stagingPathsToBandImportSources(group.paths);
      const { images } = await extractBandImportImagesWithStats(sources);
      const { uploaded, errors } = await uploadBandImportImages(images);
      if (errors.length > 0) {
        console.warn(`[import-band] ${group.kind} #${group.index} image errors:`, errors.join(" | "));
      }
      result.uploadErrors += errors.length;
      if (uploaded.length === 0) continue;
      const urls = uploaded.map((item) => item.url);
      result.uploadedUrls.push(...urls);
      const target = result[group.kind];
      target.set(group.index, [...(target.get(group.index) ?? []), ...urls]);
    }
  } catch (error) {
    await discardUploadedBandImages(result.uploadedUrls, "venue image failure");
    throw error;
  }

  return result;
}

export type ProcessBandImportImagesResult = {
  imageUrl: string;
  imagesJson: string[] | null;
  /** 상품에 저장되는 URL. insert 실패 시 정리 대상. */
  keptUrls: string[];
  summary: BandImportImageSummary;
};

export async function processBandImportImages(input: {
  sources: BandImportImageSource[];
}): Promise<ProcessBandImportImagesResult> {
  const { images: extracted, stats } = await extractBandImportImagesWithStats(input.sources);
  const summary: BandImportImageSummary = {
    extracted: extracted.length,
    uploaded: 0,
    gallery: 0,
    skipped: 0,
    unsupported: stats.unsupported,
    oversize: stats.oversize,
    uploadErrors: 0,
  };

  if (extracted.length === 0) {
    const empty = applyBandImageAssignments({ uploaded: [], assignments: [] });
    return { imageUrl: empty.imageUrl, imagesJson: null, keptUrls: [], summary };
  }

  const { uploaded, errors } = await uploadBandImportImages(extracted);
  summary.uploaded = uploaded.length;
  summary.uploadErrors = errors.length;
  if (uploaded.length === 0) {
    const detail = errors[0] ? ` (${errors[0]})` : "";
    throw new BandImportImageError(`추출한 사진을 스토리지에 올리지 못했습니다.${detail}`);
  }
  if (errors.length > 0) {
    console.warn("[import-band] some images skipped:", errors.join(" | "));
  }

  let assignments: BandImageAssignment[] | null = null;
  try {
    assignments = await classifyBandImportImages({
      images: uploaded.map((item) => ({
        bytes: item.bytes ?? Buffer.alloc(0),
        contentType: item.contentType,
        filename: item.filename,
      })),
    });
  } catch (error) {
    console.error("[import-band] image vision classify failed:", error);
    assignments = null;
  }

  const applied = applyBandImageAssignments({ uploaded, assignments });
  await discardUploadedBandImages(applied.skippedUrls, "skipped image");

  summary.gallery = applied.imagesJson?.length ?? 0;
  summary.skipped = applied.skippedUrls.length;

  return {
    imageUrl: applied.imageUrl,
    imagesJson: applied.imagesJson,
    keptUrls: applied.imagesJson ?? [],
    summary,
  };
}
