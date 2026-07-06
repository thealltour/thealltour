import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import type { ExternalParsedItineraryV2 } from "@/lib/admin/externalImport/externalProductSchema";
import {
  mapExternalItineraryToV2,
  mapItineraryBlocksToV2,
} from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import {
  filterItineraryImageUrls,
  inferDisplayRoleFromHeading,
  inferIconKeyFromHeading,
  isNoticeEventHeading,
  isSightseeingEventHeading,
} from "@/lib/admin/externalImport/sanitizeAiItinerary";

export const SIGHTSEEING_EVENT_IMAGE_MAX = 5;
export const NOTICE_EVENT_IMAGE_MAX = 5;

function normalizeHeadingKey(heading: string): string {
  return heading.trim().toLowerCase().replace(/\s+/g, "");
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

function indexBlocksByDayAndHeading(blocks: ItineraryBlock[]): Map<string, ItineraryBlock[]> {
  const index = new Map<string, ItineraryBlock[]>();
  for (const block of blocks) {
    const day = block.day ?? 0;
    const key = `${day}::${normalizeHeadingKey(block.heading)}`;
    const list = index.get(key) ?? [];
    list.push(block);
    index.set(key, list);
  }
  return index;
}

function hasExplicitDayBlocks(blocks: ItineraryBlock[]): boolean {
  return blocks.some((b) => typeof b.day === "number" && b.day > 0);
}

function findBlocksForEvent(
  blockIndex: Map<string, ItineraryBlock[]>,
  day: number,
  heading: string,
  allowDayAgnostic: boolean,
): ItineraryBlock[] {
  const hKey = normalizeHeadingKey(heading);
  const exact = blockIndex.get(`${day}::${hKey}`) ?? [];
  if (!allowDayAgnostic) return exact;
  const dayAgnostic = blockIndex.get(`0::${hKey}`) ?? [];
  return [...exact, ...dayAgnostic];
}

/**
 * AI 일정 골격 + DOM itineraryBlocks 병합.
 * DOM 블록이 더 풍부한 설명·이미지를 제공하면 해당 이벤트를 덮어쓰고,
 * notice(출입국 정보 등)는 AI에 없으면 마지막 일차 끝에 추가합니다.
 */
export function enrichAiItineraryWithBlocks(
  aiParsed: ExternalParsedItineraryV2 | null | undefined,
  blocks: ItineraryBlock[] | undefined,
): ItineraryV2 | null {
  const richBlocks = (blocks ?? []).filter((b) => b.heading.trim());
  const base = mapExternalItineraryToV2(aiParsed);

  if (richBlocks.length === 0) return base;
  if (!base?.days?.length) return mapItineraryBlocksToV2(richBlocks);

  const blockIndex = indexBlocksByDayAndHeading(richBlocks);
  const allowDayAgnostic = !hasExplicitDayBlocks(richBlocks);
  const usedBlockKeys = new Set<string>();

  const enrichedDays: ItineraryV2Day[] = base.days.map((day) => {
    const events = day.events.map((event) => {
      const candidates = findBlocksForEvent(blockIndex, day.day, event.heading, allowDayAgnostic);
      if (candidates.length === 0) return event;

      const best = pickBestBlock(candidates);
      usedBlockKeys.add(`${best.day ?? 0}::${normalizeHeadingKey(best.heading)}`);
      if (!isBlockRicher(best, event)) return event;
      return applyBlockToEvent(event, best);
    });

    for (const block of richBlocks) {
      if (isNoticeEventHeading(block.heading) || block.kind === "notice") continue;
      const blockDay = block.day ?? 0;
      if (blockDay !== 0 && blockDay !== day.day) continue;
      const hKey = normalizeHeadingKey(block.heading);
      const evIdx = events.findIndex((e) => normalizeHeadingKey(e.heading) === hKey);
      if (evIdx < 0) continue;
      const blockKey = `${block.day ?? 0}::${hKey}`;
      if (usedBlockKeys.has(blockKey)) continue;
      if (isBlockRicher(block, events[evIdx])) {
        events[evIdx] = applyBlockToEvent(events[evIdx], block);
        usedBlockKeys.add(blockKey);
      }
    }

    return { ...day, events };
  });

  const existingHeadings = new Set(
    enrichedDays.flatMap((d) => d.events.map((e) => normalizeHeadingKey(e.heading))),
  );

  const noticeToAppend = richBlocks.filter((block) => {
    if (!isNoticeEventHeading(block.heading) && block.kind !== "notice") return false;
    const key = normalizeHeadingKey(block.heading);
    if (existingHeadings.has(key)) return false;
    const blockKey = `${block.day ?? 0}::${key}`;
    return !usedBlockKeys.has(blockKey);
  });

  if (noticeToAppend.length > 0) {
    const lastIdx = enrichedDays.length - 1;
    const lastDay = enrichedDays[lastIdx];
    enrichedDays[lastIdx] = {
      ...lastDay,
      events: [...lastDay.events, ...noticeToAppend.map(blockToEvent)],
    };
  }

  return { days: enrichedDays };
}
