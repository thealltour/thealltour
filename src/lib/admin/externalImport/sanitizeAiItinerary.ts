import type {
  ExternalParsedItineraryDay,
  ExternalParsedItineraryEvent,
  ExternalParsedItineraryV2,
} from "@/lib/admin/externalImport/externalProductSchema";

const JUNK_ITINERARY_IMAGE_RE =
  /logo|icon|banner|spinner|arrow|badge|favicon|sprite|avatar|blank\.|1x1|pixel|placeholder|thumb(nail)?|_s\.|w=50|h=50|airline|carrier|jejuair|jeju-air|koreanair|asiana|tway|jinair|airbusan|\/common\/|\/assets\/ui\//i;

const MOVE_FLIGHT_HEADING_RE =
  /^(항공|항공편|기내|기내식|출발|도착|이동|탑승|공항|입국|출국|환승|비행|국제공항)|출발|도착|이동|탑승|공항|항공편|입국|출국/i;

const SUMMARY_HEADING_RE = /^(예정호텔|호텔|식사)$/;

const MEAL_HEADING_RE = /^(조식|중식|석식|기내|기내식|식사|아침|점심|저녁)/;

export function isJunkItineraryImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return true;
  return JUNK_ITINERARY_IMAGE_RE.test(trimmed);
}

export function isMoveOrFlightEvent(heading: string): boolean {
  const h = heading.trim();
  if (!h) return false;
  if (MOVE_FLIGHT_HEADING_RE.test(h)) return true;
  if (/제주항공|대한항공|아시아나|티웨이|진에어|에어부산|이스타|항공\s*\d/i.test(h)) return true;
  return false;
}

export function isSummaryEventHeading(heading: string): boolean {
  return SUMMARY_HEADING_RE.test(heading.trim());
}

export function isMealEventHeading(heading: string): boolean {
  return MEAL_HEADING_RE.test(heading.trim());
}

export function isSightseeingEventHeading(heading: string): boolean {
  const h = heading.trim();
  if (!h || h.length < 2) return false;
  if (isMoveOrFlightEvent(h)) return false;
  if (isSummaryEventHeading(h)) return false;
  if (isMealEventHeading(h)) return false;
  if (/^(상세보기|일정|여행)$/.test(h)) return false;
  return true;
}

export function filterItineraryImageUrls(
  urls: string[] | undefined,
  heading: string,
  max = 8,
): string[] {
  if (isMoveOrFlightEvent(heading)) return [];

  if (!urls?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed) || isJunkItineraryImageUrl(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}

export function inferIconKeyFromHeading(heading: string): string | undefined {
  const h = heading.trim();
  if (h === "식사" || isMealEventHeading(h)) return "utensils";
  if (/^(예정호텔|호텔)$/.test(h)) return "hotel";
  if (isMoveOrFlightEvent(h)) return "plane";
  if (isSightseeingEventHeading(h)) return "landmark";
  return undefined;
}

export function inferDisplayRoleFromHeading(heading: string): "summary" | "activity" {
  if (isSummaryEventHeading(heading)) return "summary";
  return "activity";
}

function sanitizeEvent(ev: ExternalParsedItineraryEvent): ExternalParsedItineraryEvent {
  const heading = ev.heading?.trim() ?? "";
  return {
    ...ev,
    imageUrls: filterItineraryImageUrls(ev.imageUrls, heading),
  };
}

function pickSightseeingCoverUrl(events: ExternalParsedItineraryEvent[]): string | null {
  for (const ev of events) {
    if (!isSightseeingEventHeading(ev.heading)) continue;
    const url = filterItineraryImageUrls(ev.imageUrls, ev.heading)[0];
    if (url) return url;
  }
  return null;
}

function sanitizeDay(day: ExternalParsedItineraryDay): ExternalParsedItineraryDay {
  const events = (day.events ?? []).map(sanitizeEvent);
  const sightseeingCover = pickSightseeingCoverUrl(events);
  const aiCover = day.coverImageUrl?.trim();
  const coverImageUrl =
    sightseeingCover ??
    (aiCover && !isJunkItineraryImageUrl(aiCover) ? aiCover : null);

  return {
    ...day,
    events,
    coverImageUrl,
  };
}

/** AI 일정 raw output 정제 — mapExternalItineraryToV2 직전 호출 */
export function sanitizeAiItinerary(
  parsed: ExternalParsedItineraryV2 | null | undefined,
): ExternalParsedItineraryV2 | null {
  if (!parsed?.days?.length) return null;

  const days = parsed.days
    .slice()
    .sort((a, b) => a.day - b.day)
    .map(sanitizeDay);

  return days.length > 0 ? { days } : null;
}
