import {
  normalizeStoredImageDownloadPresetCollection,
  type StoredImageDownloadPresetCollection,
} from "./imageDownloadPreset.storage";

/**
 * presetId를 최근 목록 맨 앞에 넣고, 중복 제거·유효 id만·최대 5개 유지합니다.
 * 존재하지 않는 presetId면 컬렉션을 그대로 반환합니다.
 */
export function pushRecentPreset(
  collection: StoredImageDownloadPresetCollection,
  presetId: string,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  if (!normalized.presets.some((p) => p.id === presetId)) {
    return normalized;
  }
  const without = normalized.recentPresetIds.filter((id) => id !== presetId);
  const merged = [presetId, ...without];
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    recentPresetIds: merged,
  });
}
