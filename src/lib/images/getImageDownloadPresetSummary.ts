import type { StoredImageDownloadPreset } from "./imageDownloadPreset.storage";

function namingLabel(mode: "simple" | "detailed"): string {
  return mode === "simple" ? "간단 파일명" : "상세 파일명";
}

/**
 * 목록·툴팁용 한 줄 요약 (예: PNG · 상세 파일명 / JPG · 0.85 · 간단 파일명)
 */
export function getImageDownloadPresetSummary(preset: StoredImageDownloadPreset): string {
  const name = namingLabel(preset.namingMode);
  const limit =
    typeof preset.maxBytesPerImage === "number" && preset.maxBytesPerImage > 0
      ? ` · ${Math.round(preset.maxBytesPerImage / (1024 * 1024))}MB 자동 보정`
      : "";
  if (preset.format === "jpg") {
    return `JPG · ${preset.quality.toFixed(2)}${limit} · ${name}`;
  }
  return `PNG${limit} · ${name}`;
}
