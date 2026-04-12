import type { StoredImageDownloadPreset } from "./imageDownloadPreset.storage";

function namingLabel(mode: "simple" | "detailed"): string {
  return mode === "simple" ? "간단 파일명" : "상세 파일명";
}

/**
 * 목록·툴팁용 한 줄 요약 (예: PNG · 상세 파일명 / JPG · 0.85 · 간단 파일명)
 */
export function getImageDownloadPresetSummary(preset: StoredImageDownloadPreset): string {
  const name = namingLabel(preset.namingMode);
  if (preset.format === "jpg") {
    return `JPG · ${preset.quality.toFixed(2)} · ${name}`;
  }
  return `PNG · ${name}`;
}
