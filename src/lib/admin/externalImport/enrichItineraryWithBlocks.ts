import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import type { ExternalParsedItineraryV2 } from "@/lib/admin/externalImport/externalProductSchema";
import {
  mapExternalItineraryToV2,
  mapItineraryBlocksToV2,
} from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import { MAX_ITINERARY_EVENT_IMAGES } from "@/lib/images/normalizeEventImages";
import {
  filterItineraryImageUrls,
  inferDisplayRoleFromHeading,
  inferIconKeyFromHeading,
  isNoticeEventHeading,
  isSightseeingEventHeading,
} from "@/lib/admin/externalImport/sanitizeAiItinerary";

export const SIGHTSEEING_EVENT_IMAGE_MAX = MAX_ITINERARY_EVENT_IMAGES;
export const NOTICE_EVENT_IMAGE_MAX = MAX_ITINERARY_EVENT_IMAGES;

/** 공백·대소문자 정규화 */
export function normalizeHeadingKey(heading: string): string {
  return heading.trim().toLowerCase().replace(/\s+/g, "");
}

/**
 * 매칭용: 괄호/영문 부제 제거 후 한·영 혼합 제목도 같은 POI로 본다.
 * 예: "기요미즈데라 (Kiyomizu-dera)" → "기요미즈데라"
 */
export function normalizeHeadingForMatch(heading: string): string {
  return normalizeHeadingKey(heading)
    .replace(/\([^)]*\)/g, "")
    .replace(/\[[^\]]*]/g, "")
    .replace(/[a-z0-9._\-]+/gi, (chunk) => (/[가-힣]/.test(heading) ? "" : chunk))
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

/** 정확 일치 또는 한쪽이 다른 쪽을 포함하면 매칭 */
export function headingsMatchFuzzy(a: string, b: string): boolean {
  const na = normalizeHeadingForMatch(a);
  const nb = normalizeHeadingForMatch(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return true;
  const ka = normalizeHeadingKey(a);
  const kb = normalizeHeadingKey(b);
  return ka === kb || (ka.length >= 2 && kb.length >= 2 && (ka.includes(kb) || kb.includes(ka)));
}

function maxImagesForHeading(heading: string, kind?: ItineraryBlock["kind"]): number {
  if (isNoticeEventHeading(heading) || kind === "notice") return NOTICE_EVENT_IMAGE_MAX;
  if (isSightseeingEventHeading(heading) || kind === "sightseeing") return SIGHTSEEING_EVENT_IMAGE_MAX;
  return SIGHTSEEING_EVENT_IMAGE_MAX;
}

function blockImagesToEventImages(
  urls: string[],
  heading: string,
  kind?: ItineraryBlock["kind"],
): ItineraryV2Event["images"] {
  const max = maxImagesForHeading(heading, kind);
  const filtered = filterItineraryImageUrls(urls, heading, max);
  if (filtered.length === 0) return undefined;
  return filtered.map((url, index) => ({
    url,
    sortOrder: index,
    isCover: index === 0,
    status: "active" as const,
  }));
}

function isBlockRicher(block: ItineraryBlock, event: ItineraryV2Event): boolean {
  const blockDesc = block.description.trim();
  const eventDesc = (event.description ?? "").trim();
  const blockImgCount = block.imageUrls.length;
  const eventImgCount = event.images?.length ?? 0;
  return blockDesc.length > eventDesc.length || blockImgCount > eventImgCount;
}

function pickBestBlock(candidates: ItineraryBlock[]): ItineraryBlock {
  return candidates.reduce((best, current) => {
    const bestScore = best.description.length + best.imageUrls.length * 200;
    const currentScore = current.description.length + current.imageUrls.length * 200;
    return currentScore > bestScore ? current : best;
  });
}

function applyBlockToEvent(event: ItineraryV2Event, block: ItineraryBlock): ItineraryV2Event {
  const heading = block.heading.trim();
  const images = blockImagesToEventImages(block.imageUrls, heading, block.kind);
  const description = block.description.trim();
  return {
    ...event,
    description: description.length > (event.description ?? "").trim().length ? description : event.description,
    images: images ?? event.images,
    iconKey: isNoticeEventHeading(heading)
      ? "info"
      : (event.iconKey ?? inferIconKeyFromHeading(heading)),
    displayRole: block.displayRole ?? inferDisplayRoleFromHeading(heading),
    timeOfDay: block.timeOfDay ?? event.timeOfDay,
    timeText: block.timeText?.trim() || event.timeText,
  };
}

function blockToEvent(block: ItineraryBlock): ItineraryV2Event {
  const heading = block.heading.trim();
  return {
    heading,
    description: block.description.trim() || undefined,
    timeOfDay: block.timeOfDay,
    timeText: block.timeText?.trim() || undefined,
    iconKey: isNoticeEventHeading(heading) ? "info" : inferIconKeyFromHeading(heading),
    displayRole: block.displayRole ?? inferDisplayRoleFromHeading(heading),
    images: blockImagesToEventImages(block.imageUrls, heading, block.kind),
  };
}

function hasExplicitDayBlocks(blocks: ItineraryBlock[]): boolean {
  return blocks.some((b) => typeof b.day === "number" && b.day > 0);
}

function blockDayMatches(block: ItineraryBlock, day: number, allowDayAgnostic: boolean): boolean {
  const blockDay = block.day ?? 0;
  if (blockDay === day) return true;
  if (allowDayAgnostic && blockDay === 0) return true;
  return false;
}

function eventImageUrlSet(event: ItineraryV2Event): Set<string> {
  const urls = event.images?.map((img) => img.url.trim()).filter(Boolean) ?? [];
  return new Set(urls);
}

function imageUrlOverlap(block: ItineraryBlock, event: ItineraryV2Event): number {
  if (block.imageUrls.length === 0) return 0;
  const eventUrls = eventImageUrlSet(event);
  if (eventUrls.size === 0) return 0;
  let n = 0;
  for (const url of block.imageUrls) {
    if (eventUrls.has(url.trim())) n += 1;
  }
  return n;
}

function findBlocksForEvent(
  blocks: ItineraryBlock[],
  day: number,
  event: ItineraryV2Event,
  allowDayAgnostic: boolean,
  usedIndexes: Set<number>,
): { block: ItineraryBlock; index: number }[] {
  const byHeading: { block: ItineraryBlock; index: number }[] = [];
  const byImage: { block: ItineraryBlock; index: number }[] = [];

  blocks.forEach((block, index) => {
    if (usedIndexes.has(index)) return;
    if (!blockDayMatches(block, day, allowDayAgnostic)) return;

    if (headingsMatchFuzzy(block.heading, event.heading)) {
      byHeading.push({ block, index });
      return;
    }
    if (imageUrlOverlap(block, event) > 0) {
      byImage.push({ block, index });
    }
  });

  if (byHeading.length > 0) return byHeading;
  return byImage;
}

function isAppendableItineraryBlock(block: ItineraryBlock): boolean {
  if (block.kind === "notice" || isNoticeEventHeading(block.heading)) return true;
  if (block.kind === "sightseeing" || isSightseeingEventHeading(block.heading)) return true;
  if (block.kind === "meal" || block.kind === "move" || block.kind === "other") return true;
  return block.description.trim().length >= 40 && block.imageUrls.length > 0;
}

/**
 * AI 일정 골격 + DOM itineraryBlocks 병합.
 * DOM 설명을 sightseeing/notice 정본으로 두고, heading 퍼지·이미지 교집합으로 매칭한다.
 * 미매칭 sightseeing/notice 블록은 해당 일차(또는 마지막 날)에 append한다.
 */
export function enrichAiItineraryWithBlocks(
  aiParsed: ExternalParsedItineraryV2 | null | undefined,
  blocks: ItineraryBlock[] | undefined,
): ItineraryV2 | null {
  const richBlocks = (blocks ?? []).filter((b) => b.heading.trim());
  const base = mapExternalItineraryToV2(aiParsed);

  if (richBlocks.length === 0) return base;
  if (!base?.days?.length) return mapItineraryBlocksToV2(richBlocks);

  const allowDayAgnostic = !hasExplicitDayBlocks(richBlocks);
  const usedIndexes = new Set<number>();

  const enrichedDays: ItineraryV2Day[] = base.days.map((day) => {
    const events = day.events.map((event) => {
      const candidates = findBlocksForEvent(richBlocks, day.day, event, allowDayAgnostic, usedIndexes);
      if (candidates.length === 0) return event;

      const bestEntry = candidates.reduce((best, current) => {
        const bestScore = best.block.description.length + best.block.imageUrls.length * 200;
        const currentScore = current.block.description.length + current.block.imageUrls.length * 200;
        return currentScore > bestScore ? current : best;
      });

      usedIndexes.add(bestEntry.index);
      if (!isBlockRicher(bestEntry.block, event)) return event;
      return applyBlockToEvent(event, bestEntry.block);
    });

    // 같은 day에서 아직 미사용 · heading fuzzy로 남는 블록 재적용
    richBlocks.forEach((block, index) => {
      if (usedIndexes.has(index)) return;
      if (!blockDayMatches(block, day.day, allowDayAgnostic)) return;
      if (isNoticeEventHeading(block.heading) || block.kind === "notice") return;

      const evIdx = events.findIndex((e) => headingsMatchFuzzy(e.heading, block.heading));
      if (evIdx < 0) return;
      if (!isBlockRicher(block, events[evIdx])) return;
      events[evIdx] = applyBlockToEvent(events[evIdx], block);
      usedIndexes.add(index);
    });

    return { ...day, events };
  });

  // 미매칭 sightseeing/notice → 해당 day에 append (명시 day가 없으면 마지막 날)
  const unusedToAppend = richBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => !usedIndexes.has(index) && isAppendableItineraryBlock(block));

  for (const { block, index } of unusedToAppend) {
    const blockDay = block.day ?? 0;
    // 명시적 일차 블록이 있는데 day 없는 블록은 다른 날에 잘못 붙지 않게 스킵
    if (blockDay === 0 && !allowDayAgnostic) continue;

    let dayIdx = blockDay > 0 ? enrichedDays.findIndex((d) => d.day === blockDay) : -1;
    if (dayIdx < 0 && blockDay > 0) {
      enrichedDays.push({
        day: blockDay,
        dateText: block.dateText,
        title: block.dayTitle,
        events: [blockToEvent(block)],
      });
      enrichedDays.sort((a, b) => a.day - b.day);
      usedIndexes.add(index);
      continue;
    }
    if (dayIdx < 0) dayIdx = enrichedDays.length - 1;

    const day = enrichedDays[dayIdx];
    const evIdx = day.events.findIndex((e) => {
      const na = normalizeHeadingForMatch(e.heading);
      const nb = normalizeHeadingForMatch(block.heading);
      if (!na || !nb) return false;
      return na === nb || (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na)));
    });
    if (evIdx >= 0) {
      if (isBlockRicher(block, day.events[evIdx])) {
        day.events[evIdx] = applyBlockToEvent(day.events[evIdx], block);
      }
      usedIndexes.add(index);
      continue;
    }

    enrichedDays[dayIdx] = {
      ...day,
      events: [...day.events, blockToEvent(block)],
    };
    usedIndexes.add(index);
  }

  return { days: enrichedDays };
}

/** 테스트·프롬프트용 export */
export const __enrichTestUtils = {
  pickBestBlock,
  isBlockRicher,
  headingsMatchFuzzy,
  normalizeHeadingForMatch,
};
