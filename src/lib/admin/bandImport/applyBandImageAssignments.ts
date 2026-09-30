import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import { MAX_BAND_IMPORT_VISION_IMAGES } from "@/lib/admin/bandImport/bandImportImageConstants";
import type { BandImageAssignment, BandImportUploadedImage } from "@/lib/admin/bandImport/bandImportImageConstants";

export type ApplyBandImageAssignmentsInput = {
  uploaded: Array<Pick<BandImportUploadedImage, "url" | "filename">>;
  /** null이면 비전 실패: 첫 사진 대표 + 전부 갤러리 */
  assignments: BandImageAssignment[] | null;
};

export type ApplyBandImageAssignmentsResult = {
  imageUrl: string;
  imagesJson: string[] | null;
  skippedUrls: string[];
};

function uniqueUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function assignmentByIndex(assignments: BandImageAssignment[]): Map<number, BandImageAssignment> {
  const map = new Map<number, BandImageAssignment>();
  for (const row of assignments) {
    if (!Number.isInteger(row.index) || row.index < 0) continue;
    if (!map.has(row.index)) map.set(row.index, row);
  }
  return map;
}

/** skip이 아닌 사진은 모두 대표 갤러리에 넣고, 대표는 hero → 갤러리 첫 장 순으로 고릅니다. */
export function applyBandImageAssignments(
  input: ApplyBandImageAssignmentsInput,
): ApplyBandImageAssignmentsResult {
  const uploaded = input.uploaded.filter((item) => item.url?.trim());
  if (uploaded.length === 0) {
    return { imageUrl: BAND_IMPORT_PLACEHOLDER_IMAGE, imagesJson: null, skippedUrls: [] };
  }

  const byIndex = assignmentByIndex(input.assignments ?? []);
  const gallery: string[] = [];
  const heroes: string[] = [];
  const skipped: string[] = [];

  uploaded.forEach((item, index) => {
    const url = item.url.trim();
    const overflow = index >= MAX_BAND_IMPORT_VISION_IMAGES;
    const role = overflow ? "gallery" : (byIndex.get(index)?.role ?? "gallery");

    if (role === "skip") {
      skipped.push(url);
      return;
    }
    if (role === "hero") heroes.push(url);
    gallery.push(url);
  });

  // 전부 skip이면 AI 판단보다 사진 보존을 우선합니다.
  if (gallery.length === 0) {
    const all = uniqueUrls(uploaded.map((item) => item.url));
    return { imageUrl: all[0], imagesJson: all, skippedUrls: [] };
  }

  const hero = heroes[0] ?? gallery[0];
  return {
    imageUrl: hero,
    imagesJson: uniqueUrls([hero, ...gallery]),
    skippedUrls: uniqueUrls(skipped),
  };
}
