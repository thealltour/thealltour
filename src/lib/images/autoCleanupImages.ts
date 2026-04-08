/**
 * PR-IMAGE-5: 등록 직전 이미지 자동 정리.
 * - 이벤트 간 이미지 이동·재배치·순서 변경 없음 (동일 키는 선행 등장만 유지, 후행 슬롯에서만 제거).
 * - event.images 배열 길이·필드 shape는 dedupe/정규화 범위 내에서만 변화.
 */

import type { ItineraryV2Day } from "@/types/product";
import { normalizeEventImages } from "./normalizeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";
import { normalizeImageUrl } from "./normalizeImageUrl";
import {
  isLikelyLogo,
  isLikelyThumbnail,
  normalizeImageDedupeKey,
  scoreHeroCandidate,
} from "./imageHeuristics";

export type AutoCleanupOptions = {
  /** 미할당 풀에서 로고 의심 URL 제거 */
  removeLikelyLogosFromUnassigned?: boolean;
  /** 미할당 풀에서 썸네일 의심 URL 제거 (기본 false) */
  removeLikelyThumbnailsFromUnassigned?: boolean;
};

export type AutoCleanupResult = {
  days: ItineraryV2Day[];
  unassignedImageUrls: string[];
  imageUrl?: string;
  imagesJson: string[];
  dedupedWithinEvent: number;
  dedupedCrossEvent: number;
  removedFromUnassigned: number;
  imagesJsonRemoved: number;
  warnings: string[];
};

const defaultOptions: AutoCleanupOptions = {
  removeLikelyLogosFromUnassigned: true,
  removeLikelyThumbnailsFromUnassigned: false,
};

function cloneDays(days: ItineraryV2Day[]): ItineraryV2Day[] {
  return JSON.parse(JSON.stringify(days)) as ItineraryV2Day[];
}

/** 이벤트 내부: dedupe 키 기준 첫 항만 유지, 순서 유지 */
function dedupeImagesWithinEvent<T extends { url: string }>(
  images: T[] | undefined,
): { images: T[]; removed: number } {
  if (!images?.length) return { images: [], removed: 0 };
  const seen = new Set<string>();
  const out: T[] = [];
  let removed = 0;
  for (const img of images) {
    const raw = getEventImageUrl(img);
    if (!raw) {
      removed += 1;
      continue;
    }
    const key = normalizeImageDedupeKey(raw);
    if (!key || seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(img);
  }
  return { images: out, removed };
}

function collectAllImageUrlsInOrder(days: ItineraryV2Day[]): string[] {
  const urls: string[] = [];
  for (const day of days) {
    for (const ev of day.events ?? []) {
      for (const img of ev.images ?? []) {
        const u = getEventImageUrl(img);
        if (u) urls.push(u);
      }
    }
  }
  return urls;
}

function pickHeroFromCandidates(candidates: string[]): string | undefined {
  const uniq = [...new Set(candidates.map((c) => normalizeImageUrl(c)).filter(Boolean))];
  if (uniq.length === 0) return undefined;
  const scored = uniq.map((u) => ({ u, s: scoreHeroCandidate(u) }));
  scored.sort((a, b) => b.s - a.s);
  return scored[0]?.u;
}

function cleanImagesJsonList(urls: string[] | undefined): { list: string[]; removed: number } {
  if (!urls?.length) return { list: [], removed: 0 };
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const u of urls) {
    const raw = normalizeImageUrl(u);
    if (!raw) {
      removed += 1;
      continue;
    }
    const key = normalizeImageDedupeKey(raw);
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(raw);
  }
  return { list: out, removed };
}

function cleanUnassigned(
  urls: string[],
  opts: AutoCleanupOptions,
): { list: string[]; removed: number; warnings: string[] } {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;
  for (const u of urls) {
    const raw = normalizeImageUrl(u);
    if (!raw) {
      removed += 1;
      continue;
    }
    if (opts.removeLikelyLogosFromUnassigned && isLikelyLogo(raw)) {
      removed += 1;
      continue;
    }
    if (opts.removeLikelyThumbnailsFromUnassigned && isLikelyThumbnail(raw)) {
      removed += 1;
      continue;
    }
    const key = normalizeImageDedupeKey(raw);
    if (seen.has(key)) {
      removed += 1;
      continue;
    }
    seen.add(key);
    out.push(raw);
  }
  if (removed > 0 && opts.removeLikelyLogosFromUnassigned) {
    warnings.push("미할당 풀에서 로고 의심 URL을 일부 제거했습니다.");
  }
  return { list: out, removed, warnings };
}

/**
 * 일정 v2 days·미할당·대표·갤러리 JSON만 정리. 이벤트/데이 순서·이벤트 필드(heading 등) 불변.
 */
export function runAutoCleanup(input: {
  days: ItineraryV2Day[];
  unassignedImageUrls: string[];
  imageUrl?: string;
  imagesJson?: string[];
  options?: AutoCleanupOptions;
}): AutoCleanupResult {
  const opts = { ...defaultOptions, ...input.options };
  const warnings: string[] = [];

  const days = cloneDays(input.days ?? []);
  for (const day of days) {
    if (!Array.isArray(day.events)) day.events = [];
  }

  let dedupedWithinEvent = 0;
  let dedupedCrossEvent = 0;

  for (const day of days) {
    const events = day.events;
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];
      const inner = dedupeImagesWithinEvent(ev.images);
      dedupedWithinEvent += inner.removed;
      events[ei] = { ...ev, images: inner.images.length ? inner.images : undefined };
    }
  }

  const globalSeen = new Set<string>();
  for (const day of days) {
    const events = day.events;
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];
      const imgs = ev.images;
      if (!imgs?.length) continue;
      const kept: typeof imgs = [];
      for (const img of imgs) {
        const raw = getEventImageUrl(img);
        const key = raw ? normalizeImageDedupeKey(raw) : "";
        if (!key) {
          dedupedCrossEvent += 1;
          continue;
        }
        if (globalSeen.has(key)) {
          dedupedCrossEvent += 1;
          continue;
        }
        globalSeen.add(key);
        kept.push(img);
      }
      events[ei] = {
        ...ev,
        images: kept.length > 0 ? kept : undefined,
      };
    }
  }

  for (const day of days) {
    const events = day.events;
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei];
      if (!ev.images?.length) continue;
      const normalized = normalizeEventImages(ev.images);
      events[ei] = { ...ev, images: normalized.length > 0 ? normalized : undefined };
    }
  }

  const unassignedClean = cleanUnassigned(input.unassignedImageUrls ?? [], opts);
  warnings.push(...unassignedClean.warnings);

  const jsonClean = cleanImagesJsonList(input.imagesJson);
  const hadHeroBefore = Boolean(input.imageUrl?.trim());
  let nextImageUrl = input.imageUrl?.trim() || undefined;
  if (!nextImageUrl) {
    const fromEvents = collectAllImageUrlsInOrder(days);
    const heroPick = pickHeroFromCandidates([...fromEvents, ...unassignedClean.list]);
    if (heroPick) {
      nextImageUrl = heroPick;
      warnings.push("대표 이미지가 비어 있어 자동으로 후보 중 하나를 선택했습니다.");
    } else {
      warnings.push("대표 이미지 후보를 찾지 못했습니다. 수동으로 지정해 주세요.");
    }
  }

  let imagesJson = jsonClean.list;
  if (nextImageUrl) {
    const heroKey = normalizeImageDedupeKey(nextImageUrl);
    if (hadHeroBefore) {
      const beforeLen = imagesJson.length;
      imagesJson = jsonClean.list.filter(
        (u) => normalizeImageDedupeKey(normalizeImageUrl(u)) !== heroKey,
      );
      if (imagesJson.length < beforeLen) {
        warnings.push("갤러리(images_json)에서 대표와 동일한 이미지 항목을 제거했습니다.");
      }
    } else {
      const rest = jsonClean.list.filter(
        (u) => normalizeImageDedupeKey(normalizeImageUrl(u)) !== heroKey,
      );
      const heroNorm = normalizeImageUrl(nextImageUrl);
      imagesJson = [nextImageUrl, ...rest.filter((u) => normalizeImageUrl(u) !== heroNorm)];
    }
  }

  return {
    days,
    unassignedImageUrls: unassignedClean.list,
    imageUrl: nextImageUrl,
    imagesJson,
    dedupedWithinEvent,
    dedupedCrossEvent,
    removedFromUnassigned: unassignedClean.removed,
    imagesJsonRemoved: jsonClean.removed,
    warnings,
  };
}
