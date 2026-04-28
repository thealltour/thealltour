import type {
  DownloadProductImagesOptions,
  ImageFileNamingMode,
  ImageOutputFormat,
} from "./imageDownload.types";

/** PR-5 단일 preset (v1 마이그레이션 전용) */
export type LegacyImageDownloadPresetV1 = {
  format: "png" | "jpg";
  quality: number;
  namingMode: "simple" | "detailed";
  alwaysUsePreset: boolean;
};

export type StoredImageDownloadPreset = {
  id: string;
  name: string;
  format: "png" | "jpg";
  quality: number;
  maxBytesPerImage?: number;
  namingMode: "simple" | "detailed";
  createdAt: number;
  updatedAt: number;
};

export type StoredImageDownloadPresetCollection = {
  presets: StoredImageDownloadPreset[];
  defaultPresetId: string | null;
  quickRunEnabled: boolean;
  /** 최근 preset 실행 순 (앞이 최신), 유효 id만, 최대 5 */
  recentPresetIds: string[];
};

export const IMAGE_DOWNLOAD_PRESET_STORAGE_KEY_V1 = "admin.productImageDownloadPreset.v1";
export const IMAGE_DOWNLOAD_PRESET_STORAGE_KEY_V2 = "admin.productImageDownloadPresets.v2";
export const NAVER_BLOG_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
export const BLOG_FRIENDLY_DEFAULT_QUALITY = 0.82;
export const NAVER_BLOG_DEFAULT_PRESET_ID = "preset_naver_blog_default";

const EMPTY_NAME = "이름 없는 preset";

function clampMaxBytesPerImage(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  if (rounded <= 0) return undefined;
  return rounded;
}

export function createNaverBlogDefaultPreset(now = Date.now()): StoredImageDownloadPreset {
  return {
    id: NAVER_BLOG_DEFAULT_PRESET_ID,
    name: "네이버 블로그용",
    format: "jpg",
    quality: BLOG_FRIENDLY_DEFAULT_QUALITY,
    maxBytesPerImage: NAVER_BLOG_IMAGE_MAX_BYTES,
    namingMode: "detailed",
    createdAt: now,
    updatedAt: now,
  };
}

export function newImageDownloadPresetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clampQuality(q: number, fallback: number): number {
  const base = typeof q === "number" && Number.isFinite(q) ? q : fallback;
  return Math.min(1, Math.max(0.6, base));
}

/**
 * 단일 preset 항목 정규화 (localStorage / 폼 입력)
 */
export function normalizeStoredImageDownloadPreset(
  input: unknown,
  fallbackName?: string,
): StoredImageDownloadPreset {
  const now = Date.now();
  const defQuality = BLOG_FRIENDLY_DEFAULT_QUALITY;

  if (!input || typeof input !== "object") {
    return {
      id: newImageDownloadPresetId(),
      name: (fallbackName?.trim() || EMPTY_NAME).slice(0, 200),
      format: "jpg",
      quality: defQuality,
      maxBytesPerImage: NAVER_BLOG_IMAGE_MAX_BYTES,
      namingMode: "detailed",
      createdAt: now,
      updatedAt: now,
    };
  }

  const o = input as Record<string, unknown>;

  const id =
    typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim() : newImageDownloadPresetId();

  let name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) name = fallbackName?.trim() || EMPTY_NAME;
  name = name.slice(0, 200);

  const format: ImageOutputFormat =
    o.format === "jpg" ? "jpg" : o.format === "png" ? "png" : "jpg";

  const quality = clampQuality(
    typeof o.quality === "number" ? o.quality : defQuality,
    defQuality,
  );
  const maxBytesPerImage = clampMaxBytesPerImage(o.maxBytesPerImage);

  const namingMode: ImageFileNamingMode =
    o.namingMode === "simple" ? "simple" : "detailed";

  const createdAt =
    typeof o.createdAt === "number" && Number.isFinite(o.createdAt) ? o.createdAt : now;
  const updatedAt =
    typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt) ? o.updatedAt : now;

  return { id, name, format, quality, maxBytesPerImage, namingMode, createdAt, updatedAt };
}

/**
 * 컬렉션 정규화 — defaultPresetId가 목록에 없으면 null
 */
export function normalizeStoredImageDownloadPresetCollection(
  input: unknown,
): StoredImageDownloadPresetCollection {
  const empty: StoredImageDownloadPresetCollection = {
    presets: [],
    defaultPresetId: null,
    quickRunEnabled: false,
    recentPresetIds: [],
  };

  if (!input || typeof input !== "object") return empty;

  const o = input as Record<string, unknown>;

  const rawPresets = o.presets;
  const presets: StoredImageDownloadPreset[] = Array.isArray(rawPresets)
    ? rawPresets.map((p) => normalizeStoredImageDownloadPreset(p))
    : [];

  const idSet = new Set(presets.map((p) => p.id));
  let defaultPresetId =
    typeof o.defaultPresetId === "string" && o.defaultPresetId.trim().length > 0
      ? o.defaultPresetId.trim()
      : null;
  if (defaultPresetId && !idSet.has(defaultPresetId)) {
    defaultPresetId = null;
  }

  const quickRunEnabled = o.quickRunEnabled === true;

  const rawRecent = o.recentPresetIds;
  const recentPresetIds: string[] = [];
  if (Array.isArray(rawRecent)) {
    const seen = new Set<string>();
    for (const x of rawRecent) {
      if (typeof x !== "string" || !x.trim()) continue;
      const rid = x.trim();
      if (!idSet.has(rid) || seen.has(rid)) continue;
      seen.add(rid);
      recentPresetIds.push(rid);
      if (recentPresetIds.length >= 5) break;
    }
  }

  return {
    presets,
    defaultPresetId,
    quickRunEnabled,
    recentPresetIds,
  };
}

export function getDefaultImageDownloadPresetCollection(): StoredImageDownloadPresetCollection {
  const preset = createNaverBlogDefaultPreset();
  return {
    presets: [preset],
    defaultPresetId: preset.id,
    quickRunEnabled: false,
    recentPresetIds: [],
  };
}

function normalizeLegacyV1(input: unknown): LegacyImageDownloadPresetV1 | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const format: ImageOutputFormat =
    o.format === "jpg" ? "jpg" : o.format === "png" ? "png" : "png";
  let quality =
    typeof o.quality === "number" && Number.isFinite(o.quality)
      ? o.quality
      : BLOG_FRIENDLY_DEFAULT_QUALITY;
  quality = Math.min(1, Math.max(0.6, quality));
  const namingMode: ImageFileNamingMode =
    o.namingMode === "simple" ? "simple" : "detailed";
  return {
    format,
    quality,
    namingMode,
    alwaysUsePreset: o.alwaysUsePreset === true,
  };
}

/**
 * v1 단일 객체 → v2 컬렉션 (이름 "기본 설정", default + quickRun 승격)
 */
export function migrateLegacyPresetToCollection(
  v1: LegacyImageDownloadPresetV1,
): StoredImageDownloadPresetCollection {
  const now = Date.now();
  const id = newImageDownloadPresetId();
  const preset = normalizeStoredImageDownloadPreset(
    {
      id,
      name: "기본 설정",
      format: v1.format,
      quality: v1.quality,
      maxBytesPerImage: v1.format === "jpg" ? NAVER_BLOG_IMAGE_MAX_BYTES : undefined,
      namingMode: v1.namingMode,
      createdAt: now,
      updatedAt: now,
    },
    "기본 설정",
  );
  return normalizeStoredImageDownloadPresetCollection({
    presets: [preset],
    defaultPresetId: id,
    quickRunEnabled: v1.alwaysUsePreset,
    recentPresetIds: [],
  });
}

export function saveImageDownloadPresetCollection(
  collection: StoredImageDownloadPresetCollection,
): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeStoredImageDownloadPresetCollection(collection);
    window.localStorage.setItem(
      IMAGE_DOWNLOAD_PRESET_STORAGE_KEY_V2,
      JSON.stringify(normalized),
    );
  } catch {
    // quota / private mode
  }
}

/**
 * v2 우선, 없으면 v1 마이그레이션 후 v2 저장. v1 키는 마이그레이션 후 제거.
 */
export function loadImageDownloadPresetCollection(): StoredImageDownloadPresetCollection {
  if (typeof window === "undefined") return getDefaultImageDownloadPresetCollection();

  try {
    const rawV2 = window.localStorage.getItem(IMAGE_DOWNLOAD_PRESET_STORAGE_KEY_V2);
    if (rawV2?.trim()) {
      const parsed = JSON.parse(rawV2) as unknown;
      const looksV2 =
        parsed &&
        typeof parsed === "object" &&
        ("presets" in (parsed as object) ||
          "defaultPresetId" in (parsed as object) ||
          "quickRunEnabled" in (parsed as object) ||
          "recentPresetIds" in (parsed as object));
      if (looksV2) {
        const normalized = normalizeStoredImageDownloadPresetCollection(parsed);
        return normalized.presets.length > 0 ? normalized : getDefaultImageDownloadPresetCollection();
      }
    }
  } catch {
    // fall through to v1
  }

  try {
    const rawV1 = window.localStorage.getItem(IMAGE_DOWNLOAD_PRESET_STORAGE_KEY_V1);
    if (rawV1?.trim()) {
      const parsed = JSON.parse(rawV1) as unknown;
      const v1 = normalizeLegacyV1(parsed);
      if (v1) {
        const migrated = migrateLegacyPresetToCollection(v1);
        saveImageDownloadPresetCollection(migrated);
        try {
          window.localStorage.removeItem(IMAGE_DOWNLOAD_PRESET_STORAGE_KEY_V1);
        } catch {
          // ignore
        }
        return migrated;
      }
    }
  } catch {
    // ignore
  }

  return getDefaultImageDownloadPresetCollection();
}

/** ZIP 다운로드 호출용 옵션으로 변환 */
export function storedPresetToDownloadOptions(
  preset: StoredImageDownloadPreset,
): DownloadProductImagesOptions {
  return {
    format: preset.format,
    namingMode: preset.namingMode,
    maxBytesPerImage: preset.maxBytesPerImage,
    ...(preset.format === "jpg" ? { quality: preset.quality } : {}),
  };
}

/** 옵션 모달 초기값 (기본 preset 없을 때) */
export const IMAGE_DOWNLOAD_OPTION_FALLBACK = {
  format: "jpg" as const,
  quality: BLOG_FRIENDLY_DEFAULT_QUALITY,
  maxBytesPerImage: NAVER_BLOG_IMAGE_MAX_BYTES,
  namingMode: "detailed" as const,
};
