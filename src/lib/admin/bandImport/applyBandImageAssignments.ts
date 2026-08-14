import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import { MAX_BAND_IMPORT_VISION_IMAGES } from "@/lib/admin/bandImport/bandImportImageConstants";
import type { BandImageAssignment, BandImportUploadedImage } from "@/lib/admin/bandImport/bandImportImageConstants";
import { isMoveOrFlightEvent } from "@/lib/admin/externalImport/sanitizeAiItinerary";
import { normalizeDayCoverImages } from "@/lib/images/normalizeDayCoverImages";
import type { ItineraryEventImage, ItineraryV2, ItineraryV2Day, ItineraryV2Event } from "@/types/product";

export type ApplyBandImageAssignmentsInput = {
  itinerary: ItineraryV2 | null;
  uploaded: Array<Pick<BandImportUploadedImage, "url" | "filename">>;
  /** null이면 비전 실패 폴백: 플레이스홀더 대표 + 전부 갤러리 */
  assignments: BandImageAssignment[] | null;
};

export type ApplyBandImageAssignmentsResult = {
  imageUrl: string;
  imagesJson: string[] | null;
  itinerary: ItineraryV2 | null;
};

function cloneItinerary(itinerary: ItineraryV2 | null): ItineraryV2 | null {
  if (!itinerary?.days?.length) return itinerary;
  return JSON.parse(JSON.stringify(itinerary)) as ItineraryV2;
}

function uniqueUrls(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function toEventImage(url: string, index: number): ItineraryEventImage {
  return {
    url,
    sortOrder: index,
    isCover: index === 0,
    status: "active",
  };
}

function appendEventImage(event: ItineraryV2Event, url: string): void {
  const existing = event.images ?? [];
  if (existing.some((img) => img.url === url)) return;
  event.images = [...existing, toEventImage(url, existing.length)].map((img, index) => ({
    ...img,
    sortOrder: index,
    isCover: index === 0,
  }));
}

function normalizeHeading(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function headingsSimilar(a: string, b: string): boolean {
  const left = normalizeHeading(a);
  const right = normalizeHeading(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

function findDay(itinerary: ItineraryV2, dayNum: number | null | undefined): ItineraryV2Day | undefined {
  if (dayNum == null || !Number.isFinite(dayNum)) return undefined;
  return itinerary.days.find((day) => day.day === dayNum);
}

function findEvent(
  itinerary: ItineraryV2,
  heading: string | null | undefined,
  dayNum?: number | null,
): ItineraryV2Event | undefined {
  const target = heading?.trim();
  if (!target) return undefined;
  const scoped = findDay(itinerary, dayNum);
  const days = scoped ? [scoped, ...itinerary.days.filter((d) => d !== scoped)] : itinerary.days;
  for (const day of days) {
    const exact = day.events.find((ev) => normalizeHeading(ev.heading) === normalizeHeading(target));
    if (exact) return exact;
  }
  for (const day of days) {
    const loose = day.events.find((ev) => headingsSimilar(ev.heading, target));
    if (loose) return loose;
  }
  return undefined;
}

function assignmentByIndex(assignments: BandImageAssignment[]): Map<number, BandImageAssignment> {
  const map = new Map<number, BandImageAssignment>();
  for (const row of assignments) {
    if (!Number.isInteger(row.index) || row.index < 0) continue;
    if (!map.has(row.index)) map.set(row.index, row);
  }
  return map;
}

export function applyBandImageAssignments(
  input: ApplyBandImageAssignmentsInput,
): ApplyBandImageAssignmentsResult {
  const uploaded = input.uploaded.filter((item) => item.url?.trim());
  if (uploaded.length === 0) {
    return {
      imageUrl: BAND_IMPORT_PLACEHOLDER_IMAGE,
      imagesJson: null,
      itinerary: input.itinerary,
    };
  }

  if (!input.assignments) {
    return {
      imageUrl: BAND_IMPORT_PLACEHOLDER_IMAGE,
      imagesJson: uniqueUrls(uploaded.map((item) => item.url)),
      itinerary: input.itinerary,
    };
  }

  const itinerary = cloneItinerary(input.itinerary);
  const byIndex = assignmentByIndex(input.assignments);
  const gallery: string[] = [];
  const heroes: string[] = [];

  uploaded.forEach((item, index) => {
    const url = item.url.trim();
    const assigned = byIndex.get(index);
    const overflow = index >= MAX_BAND_IMPORT_VISION_IMAGES;
    const role = overflow ? "gallery" : (assigned?.role ?? "gallery");

    if (role === "skip") return;

    if (role === "hero") {
      heroes.push(url);
      gallery.push(url);
      return;
    }

    if (role === "gallery") {
      gallery.push(url);
      return;
    }

    if (!itinerary) {
      gallery.push(url);
      return;
    }

    if (role === "dayCover") {
      const day = findDay(itinerary, assigned?.day) ?? findDay(itinerary, itinerary.days[0]?.day);
      if (!day) {
        gallery.push(url);
        return;
      }
      const nextCovers = [...(day.coverImages ?? []), toEventImage(url, day.coverImages?.length ?? 0)];
      const cover = normalizeDayCoverImages({ coverImages: nextCovers });
      day.coverImages = cover.coverImages;
      day.coverImageUrl = cover.coverImageUrl;
      return;
    }

    if (role === "event") {
      const event = findEvent(itinerary, assigned?.eventHeading, assigned?.day);
      if (!event || isMoveOrFlightEvent(event.heading)) {
        gallery.push(url);
        return;
      }
      appendEventImage(event, url);
    }
  });

  const hero = heroes[0];
  const imagesJson = uniqueUrls([hero, ...gallery]);

  return {
    imageUrl: hero ?? BAND_IMPORT_PLACEHOLDER_IMAGE,
    imagesJson: imagesJson.length > 0 ? imagesJson : null,
    itinerary,
  };
}
