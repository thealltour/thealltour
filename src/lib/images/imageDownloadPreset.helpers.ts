import type { ImageFileNamingMode, ImageOutputFormat } from "./imageDownload.types";
import {
  newImageDownloadPresetId,
  normalizeStoredImageDownloadPreset,
  normalizeStoredImageDownloadPresetCollection,
  type StoredImageDownloadPreset,
  type StoredImageDownloadPresetCollection,
} from "./imageDownloadPreset.storage";

export type CreateImageDownloadPresetInput = {
  name: string;
  format: ImageOutputFormat;
  quality: number;
  maxBytesPerImage?: number;
  namingMode: ImageFileNamingMode;
};

export function getDefaultImageDownloadPreset(
  collection: StoredImageDownloadPresetCollection,
): StoredImageDownloadPreset | null {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  if (!normalized.defaultPresetId) return null;
  return normalized.presets.find((p) => p.id === normalized.defaultPresetId) ?? null;
}

export function createImageDownloadPreset(
  collection: StoredImageDownloadPresetCollection,
  input: CreateImageDownloadPresetInput,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  const now = Date.now();
  const preset = normalizeStoredImageDownloadPreset(
    {
      id: newImageDownloadPresetId(),
      name: input.name.trim() || undefined,
      format: input.format,
      quality: input.quality,
      maxBytesPerImage: input.maxBytesPerImage,
      namingMode: input.namingMode,
      createdAt: now,
      updatedAt: now,
    },
    input.name.trim(),
  );
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    presets: [...normalized.presets, preset],
  });
}

export function updateImageDownloadPreset(
  collection: StoredImageDownloadPresetCollection,
  presetId: string,
  patch: Partial<StoredImageDownloadPreset>,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  const now = Date.now();
  const nextPresets = normalized.presets.map((p) => {
    if (p.id !== presetId) return p;
    const merged = { ...p, ...patch, id: p.id, createdAt: p.createdAt, updatedAt: now };
    return normalizeStoredImageDownloadPreset(merged, p.name);
  });
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    presets: nextPresets,
  });
}

/**
 * 기본 preset 삭제 시 남은 첫 preset을 기본으로, 없으면 null.
 * 마지막 preset 삭제 시 quickRunEnabled false.
 */
export function deleteImageDownloadPreset(
  collection: StoredImageDownloadPresetCollection,
  presetId: string,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  const nextPresets = normalized.presets.filter((p) => p.id !== presetId);
  let defaultPresetId = normalized.defaultPresetId;
  if (defaultPresetId === presetId) {
    defaultPresetId = nextPresets[0]?.id ?? null;
  }
  let quickRunEnabled = normalized.quickRunEnabled;
  if (nextPresets.length === 0) {
    quickRunEnabled = false;
    defaultPresetId = null;
  }
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    presets: nextPresets,
    defaultPresetId,
    quickRunEnabled,
  });
}

export function setDefaultImageDownloadPreset(
  collection: StoredImageDownloadPresetCollection,
  presetId: string,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  if (!normalized.presets.some((p) => p.id === presetId)) {
    return normalized;
  }
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    defaultPresetId: presetId,
  });
}

export function duplicateImageDownloadPreset(
  collection: StoredImageDownloadPresetCollection,
  presetId: string,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  const source = normalized.presets.find((p) => p.id === presetId);
  if (!source) return normalized;
  const now = Date.now();
  const copyName = `${source.name} (복사본)`.slice(0, 200);
  const duplicate = normalizeStoredImageDownloadPreset(
    {
      id: newImageDownloadPresetId(),
      name: copyName,
      format: source.format,
      quality: source.quality,
      maxBytesPerImage: source.maxBytesPerImage,
      namingMode: source.namingMode,
      createdAt: now,
      updatedAt: now,
    },
    copyName,
  );
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    presets: [...normalized.presets, duplicate],
  });
}

export function setQuickRunEnabled(
  collection: StoredImageDownloadPresetCollection,
  enabled: boolean,
): StoredImageDownloadPresetCollection {
  const normalized = normalizeStoredImageDownloadPresetCollection(collection);
  return normalizeStoredImageDownloadPresetCollection({
    ...normalized,
    quickRunEnabled: enabled,
  });
}
