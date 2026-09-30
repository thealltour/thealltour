import type { VenueInfoItem } from "@/types/product";

export const BAND_VENUE_KINDS = ["golf", "hotel", "attraction"] as const;
export type BandVenueKind = (typeof BAND_VENUE_KINDS)[number];

function isBandVenueKind(value: unknown): value is BandVenueKind {
  return (BAND_VENUE_KINDS as readonly unknown[]).includes(value);
}

export type BandVenueImagePathGroup = {
  kind: BandVenueKind;
  /** 요청의 golfCoursesJson / hotelsJson / attractionsJson 배열 인덱스 (빈 행 포함) */
  index: number;
  paths: Array<{ path: string; filename?: string }>;
};

export type BandVenueRow = { name: string; content: string };

/** 등록 응답·편집기 배너에 보여줄 골프장·호텔·관광지 사진 처리 결과 */
export type BandVenueImageNotice = { uploaded: number; uploadErrors: number };

/**
 * 밴드 등록 요청의 골프장·호텔 행을 읽습니다. 사진 인덱스가 어긋나지 않도록 빈 행도 유지하고,
 * 최종 필터링은 normalizeVenueInfoList가 맡습니다.
 */
export function parseBandVenueRows(raw: unknown): BandVenueRow[] {
  let value = raw;
  if (typeof value === "string") {
    if (!value.trim()) return [];
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item != null && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      name: typeof row.name === "string" ? row.name.trim() : "",
      content: typeof row.content === "string" ? row.content.trim() : "",
    };
  });
}

export function parseBandVenueImagePaths(raw: string): BandVenueImagePathGroup[] {
  if (!raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const groups: BandVenueImagePathGroup[] = [];
  for (const item of parsed) {
    if (item == null || typeof item !== "object") continue;
    const group = item as Record<string, unknown>;
    const kind = isBandVenueKind(group.kind) ? group.kind : null;
    const index = typeof group.index === "number" ? group.index : Number.NaN;
    if (!kind || !Number.isInteger(index) || index < 0 || !Array.isArray(group.paths)) continue;
    const paths: BandVenueImagePathGroup["paths"] = [];
    for (const entry of group.paths) {
      if (entry == null || typeof entry !== "object") continue;
      const ref = entry as Record<string, unknown>;
      if (typeof ref.path !== "string" || !ref.path) continue;
      paths.push({
        path: ref.path,
        filename: typeof ref.filename === "string" ? ref.filename : undefined,
      });
    }
    if (paths.length > 0) groups.push({ kind, index, paths });
  }
  return groups;
}

/** 업로드 결과 URL을 인덱스에 맞춰 행에 붙입니다. */
export function attachBandVenueImages(
  rows: BandVenueRow[],
  imagesByIndex: ReadonlyMap<number, string[]>,
): VenueInfoItem[] {
  return rows.map((row, index) => {
    const images = imagesByIndex.get(index);
    return images && images.length > 0 ? { ...row, images } : row;
  });
}
