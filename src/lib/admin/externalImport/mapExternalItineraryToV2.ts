import type { ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";
import { normalizeDayCoverImages } from "@/lib/images/normalizeDayCoverImages";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import type {
  ExternalParsedItineraryDay,
  ExternalParsedItineraryV2,
} from "@/lib/admin/externalImport/externalProductSchema";
import { SIGHTSEEING_EVENT_IMAGE_MAX } from "@/lib/admin/externalImport/enrichItineraryWithBlocks";
import {
  filterItineraryImageUrls,
  inferDisplayRoleFromHeading,
  inferIconKeyFromHeading,
  isSightseeingEventHeading,
  sanitizeAiItinerary,
} from "@/lib/admin/externalImport/sanitizeAiItinerary";

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapEvent(ev: ExternalParsedItineraryDay["events"][number]): ItineraryV2Event | null {
  const heading = trimOrNull(ev.heading);
  if (!heading) return null;

  const maxImages = isSightseeingEventHeading(heading)
    ? SIGHTSEEING_EVENT_IMAGE_MAX
    : 8;
  const imageUrls = filterItineraryImageUrls(ev.imageUrls, heading, maxImages);
  const images =
    imageUrls.length > 0
      ? imageUrls.map((url, index) => ({
          url,
          sortOrder: index,
          isCover: index === 0,
          status: "active" as const,
        }))
      : undefined;

  return {
    heading,
    description: trimOrNull(ev.description) ?? undefined,
    timeOfDay: ev.timeOfDay ?? undefined,
    timeText: trimOrNull(ev.timeText) ?? undefined,
    iconKey: inferIconKeyFromHeading(heading),
    displayRole: inferDisplayRoleFromHeading(heading),
    images,
  };
}

function pickSightseeingCoverFromEvents(events: ItineraryV2Event[]): string | undefined {
  for (const ev of events) {
    if (!isSightseeingEventHeading(ev.heading)) continue;
    const url = ev.images?.[0]?.url;
    if (url) return url;
  }
  return undefined;
}

export function mapExternalItineraryToV2(
  parsed: ExternalParsedItineraryV2 | null | undefined,
): ItineraryV2 | null {
  const sanitized = sanitizeAiItinerary(parsed);
  if (!sanitized?.days?.length) return null;

  const days = sanitized.days
    .map((day) => {
      const events = (day.events ?? [])
        .map((ev) => mapEvent(ev))
        .filter((ev): ev is ItineraryV2Event => ev !== null);

      if (events.length === 0) return null;

      const explicitCover = trimOrNull(day.coverImageUrl);
      const sightseeingCover = pickSightseeingCoverFromEvents(events);
      const cover = normalizeDayCoverImages({
        coverImageUrl: sightseeingCover ?? explicitCover ?? undefined,
        coverImages: undefined,
      });

      const mappedDay: ItineraryV2Day = {
        day: day.day,
        dateText: trimOrNull(day.dateText) ?? undefined,
        title: trimOrNull(day.title) ?? `${day.day}일차`,
        coverImageUrl: cover.coverImageUrl ?? undefined,
        coverImages: cover.coverImages.length > 0 ? cover.coverImages : undefined,
        events,
      };
      return mappedDay;
    })
    .filter((d): d is ItineraryV2Day => d !== null);

  return days.length > 0 ? { days } : null;
}

export function countItineraryEvents(parsed: ExternalParsedItineraryV2 | null | undefined): number {
  if (!parsed?.days?.length) return 0;
  return parsed.days.reduce((sum, day) => sum + (day.events?.length ?? 0), 0);
}

export function isRichItineraryBlock(block: ItineraryBlock): boolean {
  const heading = block.heading.trim();
  if (!heading || heading.length < 2) return false;

  const hasDescription = block.description.trim().length > 0;
  const hasImages = block.imageUrls.length > 0;
  if (hasDescription || hasImages) return true;

  if (block.kind === "meal" || block.kind === "move" || block.kind === "sightseeing" || block.kind === "notice")
    return true;

  if (/^(조식|중식|석식|기내|기내식)/.test(heading)) return true;
  if (/^(예정호텔|호텔|항공|식사)$/.test(heading)) return true;
  if (/출발|도착|이동|탑승|공항|항공편/.test(heading)) return true;

  if (heading.length >= 2 && !/^(상세보기|일정)$/.test(heading)) return true;

  return false;
}

export function hasRichItineraryBlocks(blocks: ItineraryBlock[]): boolean {
  return blocks.some(isRichItineraryBlock);
}

function inferTimeOfDayFromBlock(block: ItineraryBlock): ItineraryV2Event["timeOfDay"] | undefined {
  if (block.timeOfDay) return block.timeOfDay;
  if (block.kind === "meal") {
    if (/조식|아침/.test(block.heading)) return "오전";
    if (/중식|점심/.test(block.heading)) return "오후";
    if (/석식|저녁/.test(block.heading)) return "저녁";
  }
  return undefined;
}

function inferIconKeyFromBlock(block: ItineraryBlock): string | undefined {
  return inferIconKeyFromHeading(block.heading.trim()) ?? undefined;
}

function inferDisplayRoleFromBlock(block: ItineraryBlock): ItineraryV2Event["displayRole"] {
  if (block.displayRole === "summary" || block.displayRole === "activity") return block.displayRole;
  return inferDisplayRoleFromHeading(block.heading.trim());
}

export function mapItineraryBlocksToV2(blocks: ItineraryBlock[]): ItineraryV2 | null {
  const rich = blocks.filter(isRichItineraryBlock);
  if (rich.length === 0) return null;

  const byDay = new Map<number, ItineraryBlock[]>();
  for (const block of rich) {
    const dayNum = block.day ?? 1;
    const list = byDay.get(dayNum) ?? [];
    list.push(block);
    byDay.set(dayNum, list);
  }

  const days: ItineraryV2Day[] = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayNum, dayBlocks]) => {
      const events: ItineraryV2Event[] = dayBlocks.map((block) => {
        const heading = block.heading.trim();
        const maxImages =
          block.kind === "sightseeing" || isSightseeingEventHeading(heading)
            ? SIGHTSEEING_EVENT_IMAGE_MAX
            : 8;
        const imageUrls = filterItineraryImageUrls(block.imageUrls, heading, maxImages);
        const images =
          imageUrls.length > 0
            ? imageUrls.map((url, index) => ({
                url,
                sortOrder: index,
                isCover: index === 0,
                status: "active" as const,
              }))
            : undefined;

        return {
          heading,
          description: block.description.trim() || undefined,
          timeOfDay: inferTimeOfDayFromBlock(block),
          timeText: block.timeText?.trim() || undefined,
          iconKey: inferIconKeyFromBlock(block),
          displayRole: inferDisplayRoleFromBlock(block),
          images,
        };
      });

      const firstMeta = dayBlocks.find((b) => b.dateText || b.dayTitle);
      const sightseeingCover = pickSightseeingCoverFromEvents(events);
      const cover = normalizeDayCoverImages({
        coverImageUrl: sightseeingCover ?? undefined,
        coverImages: undefined,
      });

      return {
        day: dayNum,
        dateText: firstMeta?.dateText?.trim() || undefined,
        title: firstMeta?.dayTitle?.trim() || `${dayNum}일차`,
        coverImageUrl: cover.coverImageUrl,
        coverImages: cover.coverImages.length > 0 ? cover.coverImages : undefined,
        events,
      };
    });

  return days.length > 0 ? { days } : null;
}

export function countItineraryImages(itinerary: ItineraryV2 | null): number {
  return collectItineraryImageUrls(itinerary).length;
}

export function collectItineraryImageUrls(itinerary: ItineraryV2 | null): string[] {
  if (!itinerary?.days?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url: string | undefined | null) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  };

  for (const day of itinerary.days) {
    push(day.coverImageUrl);
    for (const img of day.coverImages ?? []) push(img.url);
    for (const ev of day.events) {
      for (const img of ev.images ?? []) push(img.url);
    }
  }
  return out;
}

// Re-export for tests
export { filterItineraryImageUrls, isMoveOrFlightEvent, isJunkItineraryImageUrl } from "@/lib/admin/externalImport/sanitizeAiItinerary";
