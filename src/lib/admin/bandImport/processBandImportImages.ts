import "server-only";

import { applyBandImageAssignments } from "@/lib/admin/bandImport/applyBandImageAssignments";
import type { ApplyBandImageAssignmentsResult } from "@/lib/admin/bandImport/applyBandImageAssignments";
import { classifyBandImportImages } from "@/lib/admin/bandImport/classifyBandImportImages";
import { extractBandImportImages } from "@/lib/admin/bandImport/extractBandImportImages";
import { uploadBandImportImages } from "@/lib/admin/bandImport/uploadBandImportImages";
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

  const uploaded = await uploadBandImportImages(extracted);

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
