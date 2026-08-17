import "server-only";

import { applyBandImageAssignments } from "@/lib/admin/bandImport/applyBandImageAssignments";
import type { ApplyBandImageAssignmentsResult } from "@/lib/admin/bandImport/applyBandImageAssignments";
import { classifyBandImportImages } from "@/lib/admin/bandImport/classifyBandImportImages";
import { extractBandImportImages, BandImportImageError } from "@/lib/admin/bandImport/extractBandImportImages";
import { uploadBandImportImages } from "@/lib/admin/bandImport/uploadBandImportImages";
import { downloadBandImportStagingFile } from "@/lib/admin/bandImport/bandImportStaging";
import type { BandImportImageSource } from "@/lib/admin/bandImport/bandImportImageConstants";
import type { ItineraryV2 } from "@/types/product";

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

export async function processBandImportImages(input: {
  sources: BandImportImageSource[];
  itinerary: ItineraryV2 | null;
}): Promise<ApplyBandImageAssignmentsResult> {
  const extracted = await extractBandImportImages(input.sources);
  if (extracted.length === 0) {
    return applyBandImageAssignments({
      itinerary: input.itinerary,
      uploaded: [],
      assignments: [],
    });
  }

  const { uploaded, errors } = await uploadBandImportImages(extracted);
  if (uploaded.length === 0) {
    const detail = errors[0] ? ` (${errors[0]})` : "";
    throw new BandImportImageError(
      `추출한 사진을 스토리지에 올리지 못했습니다.${detail}`,
    );
  }
  if (errors.length > 0) {
    console.warn("[import-band] some images skipped:", errors.join(" | "));
  }

  let assignments = null;
  try {
    assignments = await classifyBandImportImages({
      images: uploaded.map((item) => ({
        bytes: item.bytes ?? Buffer.alloc(0),
        contentType: item.contentType,
        filename: item.filename,
      })),
      itinerary: input.itinerary,
    });
  } catch (error) {
    console.error("[import-band] image vision classify failed:", error);
    assignments = null;
  }

  return applyBandImageAssignments({
    itinerary: input.itinerary,
    uploaded,
    assignments,
  });
}
