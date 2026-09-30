import { isMoveOrFlightEvent, isNoticeEventHeading } from "@/lib/admin/externalImport/sanitizeAiItinerary";
import { normalizeDayCoverImages } from "@/lib/images/normalizeDayCoverImages";
import { MAX_ITINERARY_EVENT_IMAGES } from "@/lib/images/normalizeEventImages";
import type {
  ItineraryEventImage,
  ItineraryV2,
  ItineraryV2Day,
  ItineraryV2Event,
  VenueInfoItem,
} from "@/types/product";

/** 타임라인 compact 갤러리가 한 이벤트에 보여주는 최대 장수 */
const MAX_VENUE_IMAGES_PER_EVENT = 5;

const LODGING_SUMMARY_RE = /^(예정\s*호텔|호텔|숙소)$/;
const CHECK_IN_RE = /체크\s*인/;

export type BandVenueImageSources = {
  golfCourses: VenueInfoItem[] | null | undefined;
  hotels: VenueInfoItem[] | null | undefined;
  attractions: VenueInfoItem[] | null | undefined;
};

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

function venueImages(venue: VenueInfoItem): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of venue.images ?? []) {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function isPlaceableEvent(event: ItineraryV2Event): boolean {
  const heading = event.heading?.trim() ?? "";
  if (!heading) return false;
  return !isMoveOrFlightEvent(heading) && !isNoticeEventHeading(heading);
}

function eventsMatchingName(
  itinerary: ItineraryV2,
  name: string,
  includeDescription: boolean,
): ItineraryV2Event[] {
  const key = normalizeForMatch(name);
  if (key.length < 2) return [];
  const matches: ItineraryV2Event[] = [];
  for (const day of itinerary.days) {
    for (const event of day.events) {
      if (!isPlaceableEvent(event)) continue;
      const haystack = includeDescription
        ? normalizeForMatch(event.heading) + normalizeForMatch(event.description)
        : normalizeForMatch(event.heading);
      if (haystack.includes(key)) matches.push(event);
    }
  }
  return matches;
}

/** 호텔 이름이 일정에 없을 때: 일차마다 「숙소」 요약 이벤트, 없으면 체크인 이벤트 1개 */
function lodgingEventsByDay(itinerary: ItineraryV2): ItineraryV2Event[] {
  const out: ItineraryV2Event[] = [];
  for (const day of itinerary.days) {
    const placeable = day.events.filter(isPlaceableEvent);
    const lodging =
      placeable.find((event) => LODGING_SUMMARY_RE.test(event.heading.trim())) ??
      placeable.find((event) => CHECK_IN_RE.test(event.heading));
    if (lodging) out.push(lodging);
  }
  return out;
}

/**
 * 여러 이벤트에 사진을 나눠 붙여 날마다 같은 사진이 반복되지 않게 합니다.
 * 사진이 이벤트보다 적으면 앞에서부터 돌려 씁니다.
 */
function distribute(urls: string[], eventCount: number): string[][] {
  const perEvent = Math.max(1, Math.min(MAX_VENUE_IMAGES_PER_EVENT, Math.ceil(urls.length / eventCount)));
  return Array.from({ length: eventCount }, (_, index) => {
    const chunk = urls.slice(index * perEvent, (index + 1) * perEvent);
    return chunk.length > 0 ? chunk : [urls[index % urls.length]];
  });
}

function appendEventImages(event: ItineraryV2Event, urls: string[]): void {
  const existing = (event.images ?? []).filter((img) => img?.url?.trim());
  const known = new Set(existing.map((img) => img.url.trim()));
  const next: ItineraryEventImage[] = [...existing];
  for (const url of urls) {
    if (next.length >= MAX_ITINERARY_EVENT_IMAGES) break;
    if (known.has(url)) continue;
    known.add(url);
    next.push({ url, status: "active" });
  }
  if (next.length === existing.length) return;
  event.images = next.map((img, index) => ({ ...img, sortOrder: index, isCover: index === 0 }));
}

type VenueKind = "golf" | "hotel" | "attraction";

/** Day 커버로 쓸 장소 우선순위. 그날의 성격을 가장 잘 보여주는 순서입니다. */
const COVER_KIND_PRIORITY: Record<VenueKind, number> = { golf: 0, attraction: 1, hotel: 2 };

type VenuePlacement = {
  dayIndex: number;
  kind: VenueKind;
  /** 해당 장소의 전체 사진 */
  pool: string[];
  /** 이 일차 이벤트에 붙인 사진 */
  placed: string[];
};

function placeVenues(
  itinerary: ItineraryV2,
  venues: VenueInfoItem[],
  kind: VenueKind,
  placements: VenuePlacement[],
  options: { includeDescription: boolean; fallbackEvents?: () => ItineraryV2Event[] },
): void {
  const withImages = venues
    .map((venue) => ({ venue, urls: venueImages(venue) }))
    .filter((entry) => entry.urls.length > 0);

  for (const { venue, urls } of withImages) {
    let targets = eventsMatchingName(itinerary, venue.name, options.includeDescription);
    // 이름으로 못 찾은 경우의 대체 배치는 대상이 하나일 때만 합니다. 여러 곳이면 어느 쪽인지 알 수 없습니다.
    if (targets.length === 0 && options.fallbackEvents && withImages.length === 1) {
      targets = options.fallbackEvents();
    }
    if (targets.length === 0) continue;
    distribute(urls, targets.length).forEach((chunk, index) => {
      const event = targets[index];
      appendEventImages(event, chunk);
      const dayIndex = itinerary.days.findIndex((day) => day.events.includes(event));
      placements.push({ dayIndex, kind, pool: urls, placed: chunk });
    });
  }
}

function hasDayCover(day: ItineraryV2Day): boolean {
  return Boolean(day.coverImageUrl?.trim() || day.coverImages?.some((img) => img?.url?.trim()));
}

/**
 * 커버가 비어 있는 일차에 그날 주요 장소 사진 1장을 커버로 지정합니다.
 * 그날 일정 카드에 이미 보이는 사진과 다른 일차 커버는 가능한 한 피합니다.
 */
function assignDayCovers(itinerary: ItineraryV2, placements: VenuePlacement[]): void {
  const usedCovers = new Set<string>();
  itinerary.days.forEach((day, dayIndex) => {
    if (hasDayCover(day)) return;
    const today = placements
      .filter((placement) => placement.dayIndex === dayIndex)
      .sort((a, b) => COVER_KIND_PRIORITY[a.kind] - COVER_KIND_PRIORITY[b.kind]);
    const primary = today[0];
    if (!primary) return;
    const shownToday = new Set(today.flatMap((placement) => placement.placed));
    const url =
      primary.pool.find((candidate) => !shownToday.has(candidate) && !usedCovers.has(candidate)) ??
      primary.pool.find((candidate) => !usedCovers.has(candidate)) ??
      primary.placed[0];
    usedCovers.add(url);
    const cover = normalizeDayCoverImages({ coverImages: [{ url, isCover: true, status: "active" }] });
    day.coverImages = cover.coverImages;
    day.coverImageUrl = cover.coverImageUrl;
  });
}

/**
 * 밴드 등록 시 관리자가 이름을 붙여 올린 골프장·호텔·관광지 사진을 일정 이벤트에 복사하고,
 * 커버가 없는 일차에는 그날 장소 사진으로 커버를 채웁니다.
 * 원본 장소 목록과 대표 갤러리는 건드리지 않습니다.
 */
export function placeBandVenueImagesInItinerary(
  itinerary: ItineraryV2 | null,
  sources: BandVenueImageSources,
): ItineraryV2 | null {
  if (!itinerary?.days?.length) return itinerary;
  const next = JSON.parse(JSON.stringify(itinerary)) as ItineraryV2;
  const placements: VenuePlacement[] = [];

  placeVenues(next, sources.golfCourses ?? [], "golf", placements, { includeDescription: false });
  placeVenues(next, sources.hotels ?? [], "hotel", placements, {
    includeDescription: true,
    fallbackEvents: () => lodgingEventsByDay(next),
  });
  // 관광지는 「시내 관광」 같은 heading 아래 설명에 이름만 나오는 경우가 많습니다.
  placeVenues(next, sources.attractions ?? [], "attraction", placements, { includeDescription: true });

  assignDayCovers(next, placements);
  return next;
}
