import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";
import { getEventImageUrl } from "@/lib/images/getEventImageUrl";
import {
  buildUnassignedDuplicateMeta,
  getImageHeuristicFlags,
} from "@/components/admin/modetour/modetourImageHeuristics";
import type { ProductFormState } from "@/types/adminProductForm";

export const SNIPPET_LEN = 200;
export const PRODUCTS_LIST_PATH = "/theall_manager_only/products";

export function removeFirstMatch(arr: string[], url: string): string[] {
  const index = arr.indexOf(url);
  if (index === -1) return arr;
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

export type EventImageObj = { url: string; alt?: string; sortOrder?: number; isCover?: boolean };

export function insertImageAt(
  images: EventImageObj[],
  image: EventImageObj,
  insertAt: number,
): EventImageObj[] {
  const at = Math.max(0, Math.min(insertAt, images.length));
  return [...images.slice(0, at), image, ...images.slice(at)];
}

export function removeImageAt(images: EventImageObj[], index: number): EventImageObj[] {
  if (index < 0 || index >= images.length) return images;
  return [...images.slice(0, index), ...images.slice(index + 1)];
}

export function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

/** target 이미지 배열에 이미 정규화된 url이 있는지 */
export function targetHasUrl(images: EventImageObj[] | undefined, normalizedUrl: string): boolean {
  if (!normalizedUrl || !images?.length) return false;
  return images.some((img) => normalizeImageUrl(getEventImageUrl(img)) === normalizedUrl);
}

export type NormalizeImportImageStats = {
  uniqueUrls: number;
  attempted: number;
  uploaded: number;
  failed: number;
  skippedInternal: number;
  skipped: boolean;
  reason?: string;
};

export type ExternalImportWarningLike = {
  code: string;
  message: string;
  path?: string;
};

export function buildImageNormalizeExtraWarnings(
  normalizeStats: NormalizeImportImageStats | null,
): ExternalImportWarningLike[] {
  const extraWarnings: ExternalImportWarningLike[] = [];
  if (normalizeStats?.skipped && normalizeStats.reason === "missing_supabase_env") {
    extraWarnings.push({
      code: "IMAGE_REHOST_SKIPPED",
      message: "Supabase 서버 키/URL이 없어 이미지 정규화를 건너뛰었습니다.",
      path: "media",
    });
  } else if (
    normalizeStats &&
    !normalizeStats.skipped &&
    normalizeStats.uniqueUrls > 0 &&
    normalizeStats.failed > 0
  ) {
    extraWarnings.push({
      code: "IMAGE_REHOST_PARTIAL",
      message: `이미지 ${normalizeStats.failed}개 업로드 실패 — 해당 항목은 원본 URL을 유지했습니다.`,
      path: "media",
    });
  }
  return extraWarnings;
}

export function logNormalizeImportStats(normalizeStats: NormalizeImportImageStats | null) {
  if (!normalizeStats || typeof console === "undefined" || !console.log) return;
  const rate =
    normalizeStats.attempted > 0
      ? Math.round((normalizeStats.uploaded / normalizeStats.attempted) * 1000) / 10
      : null;
  console.log("[IMAGE][NORMALIZE_IMPORT_STATS]", {
    ...normalizeStats,
    successRatePercent: rate,
  });
}

export type ImageReviewSummary = {
  totalListed: number;
  unassigned: number;
  unassignedDeletedPending: number;
  placedInEvents: number;
  hasHero: boolean;
  dupSus: number;
  logoThumbSus: number;
};

export function computeImageReviewSummary(params: {
  formState: ProductFormState;
  unassignedImageUrls: string[];
  activeUnassignedImageUrls: string[];
  unassignedDeletedNorm: Set<string>;
}): ImageReviewSummary {
  const { formState, unassignedImageUrls, activeUnassignedImageUrls, unassignedDeletedNorm } =
    params;
  const v2 = formState.itinerary_v2_json?.days ?? [];
  let placedInEvents = 0;
  for (const d of v2) {
    for (const ev of d.events ?? []) {
      for (const img of ev.images ?? []) {
        if ((img as { status?: string }).status !== "deleted") placedInEvents += 1;
      }
    }
  }
  const hero = formState.image_url?.trim();
  const gallery = formState.images_json ?? [];
  const totalListed =
    (hero ? 1 : 0) + gallery.length + unassignedImageUrls.length + placedInEvents;
  const pool = [...(hero ? [hero] : []), ...gallery, ...activeUnassignedImageUrls];
  const dupMeta = buildUnassignedDuplicateMeta(pool);
  let dupSus = 0;
  for (const u of pool) {
    if ((dupMeta.urlToGroupSize.get(u) ?? 1) > 1) dupSus += 1;
  }
  const seenNorm = new Set<string>();
  let logoThumbSus = 0;
  for (const raw of pool) {
    const k = normalizeImageUrl(raw);
    if (!k || seenNorm.has(k)) continue;
    seenNorm.add(k);
    const f = getImageHeuristicFlags(raw);
    if (f.isLikelyLogo || f.isLikelyThumbnail) logoThumbSus += 1;
  }
  return {
    totalListed,
    unassigned: activeUnassignedImageUrls.length,
    unassignedDeletedPending: unassignedDeletedNorm.size,
    placedInEvents,
    hasHero: Boolean(hero),
    dupSus,
    logoThumbSus,
  };
}
