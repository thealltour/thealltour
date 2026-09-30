import { describe, expect, it } from "vitest";
import { placeBandVenueImagesInItinerary } from "@/lib/admin/bandImport/placeBandVenueImagesInItinerary";
import type { ItineraryV2 } from "@/types/product";

const photos = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `https://cdn.example.com/${prefix}-${i + 1}.webp`);

function saipanItinerary(): ItineraryV2 {
  return {
    days: [
      {
        day: 1,
        events: [
          { heading: "인천 국제공항 출발", displayRole: "activity" },
          { heading: "사이판 국제공항 도착", displayRole: "activity" },
          { heading: "리조트 체크인 및 휴식", displayRole: "activity" },
          { heading: "숙소", description: "PIC리조트 &동급", displayRole: "summary" },
        ],
      },
      ...[2, 3, 4].map((day) => ({
        day,
        events: [
          { heading: "골프장으로 이동", displayRole: "activity" as const },
          { heading: "코랄오션CC 18홀 라운드", displayRole: "activity" as const },
          { heading: "숙소", displayRole: "summary" as const },
        ],
      })),
      {
        day: 5,
        events: [
          { heading: "공항으로 이동", displayRole: "activity" },
          { heading: "사이판 국제공항 출발", displayRole: "activity" },
        ],
      },
    ],
  };
}

const urlsOf = (itinerary: ItineraryV2 | null, day: number, heading: string) =>
  itinerary?.days.find((d) => d.day === day)?.events.find((e) => e.heading === heading)?.images?.map((i) => i.url) ?? [];

describe("placeBandVenueImagesInItinerary", () => {
  it("spreads golf photos across the rounds that name the course", () => {
    const result = placeBandVenueImagesInItinerary(saipanItinerary(), {
      golfCourses: [{ name: "코랄오션CC", content: "", images: photos("golf", 14) }],
      hotels: null,
      attractions: null,
    });
    const golf = photos("golf", 14);
    expect(urlsOf(result, 2, "코랄오션CC 18홀 라운드")).toEqual(golf.slice(0, 5));
    expect(urlsOf(result, 3, "코랄오션CC 18홀 라운드")).toEqual(golf.slice(5, 10));
    expect(urlsOf(result, 4, "코랄오션CC 18홀 라운드")).toEqual(golf.slice(10, 14));
    expect(urlsOf(result, 2, "골프장으로 이동")).toEqual([]);
    expect(result?.days[1].events[1].images?.[0]).toMatchObject({ sortOrder: 0, isCover: true, status: "active" });
  });

  it("falls back to each day's lodging summary when the hotel name is not in the itinerary", () => {
    const result = placeBandVenueImagesInItinerary(saipanItinerary(), {
      golfCourses: null,
      hotels: [{ name: "사이판 코랄오션", content: "", images: photos("hotel", 13) }],
      attractions: null,
    });
    expect([1, 2, 3, 4].map((day) => urlsOf(result, day, "숙소").length)).toEqual([4, 4, 4, 1]);
    expect(urlsOf(result, 1, "리조트 체크인 및 휴식")).toEqual([]);
    expect(urlsOf(result, 5, "사이판 국제공항 출발")).toEqual([]);
  });

  it("matches hotels named in a lodging description instead of falling back", () => {
    const result = placeBandVenueImagesInItinerary(saipanItinerary(), {
      golfCourses: null,
      hotels: [
        { name: "PIC 리조트", content: "", images: photos("pic", 2) },
        { name: "켄싱턴 호텔", content: "", images: photos("ks", 2) },
      ],
      attractions: null,
    });
    expect(urlsOf(result, 1, "숙소")).toEqual(photos("pic", 2));
    expect([2, 3, 4].map((day) => urlsOf(result, day, "숙소"))).toEqual([[], [], []]);
  });

  it("places attractions only where the itinerary mentions them", () => {
    const itinerary = saipanItinerary();
    itinerary.days[0].events.push({ heading: "시내 관광", description: "만세절벽, 한국인 위령탑 방문" });
    const result = placeBandVenueImagesInItinerary(itinerary, {
      golfCourses: null,
      hotels: null,
      attractions: [
        { name: "만세절벽", content: "", images: photos("cliff", 1) },
        { name: "한국인위령탑", content: "", images: photos("memorial", 1) },
        { name: "별빛투어", content: "", images: photos("star", 3) },
      ],
    });
    expect(urlsOf(result, 1, "시내 관광")).toEqual([...photos("cliff", 1), ...photos("memorial", 1)]);
    const allUrls = result?.days.flatMap((d) => d.events.flatMap((e) => e.images?.map((i) => i.url) ?? []));
    expect(allUrls).not.toContain(photos("star", 1)[0]);
  });

  it("does not mutate the input and keeps existing event photos first", () => {
    const itinerary = saipanItinerary();
    itinerary.days[1].events[1].images = [{ url: "https://cdn.example.com/existing.webp" }];
    const snapshot = JSON.stringify(itinerary);
    const result = placeBandVenueImagesInItinerary(itinerary, {
      golfCourses: [{ name: "코랄오션 CC", content: "", images: photos("golf", 1) }],
      hotels: null,
      attractions: null,
    });
    expect(JSON.stringify(itinerary)).toBe(snapshot);
    expect(urlsOf(result, 2, "코랄오션CC 18홀 라운드")).toEqual([
      "https://cdn.example.com/existing.webp",
      photos("golf", 1)[0],
    ]);
    expect(urlsOf(result, 3, "코랄오션CC 18홀 라운드")).toEqual(photos("golf", 1));
  });

  it("gives each day a distinct cover from its main venue, avoiding photos already shown that day", () => {
    const result = placeBandVenueImagesInItinerary(saipanItinerary(), {
      golfCourses: [{ name: "코랄오션CC", content: "", images: photos("golf", 14) }],
      hotels: [{ name: "사이판 코랄오션", content: "", images: photos("hotel", 13) }],
      attractions: null,
    });
    const golf = photos("golf", 14);
    const hotel = photos("hotel", 13);
    expect(result?.days.map((d) => d.coverImageUrl)).toEqual([hotel[4], golf[5], golf[0], golf[1], undefined]);
    expect(result?.days[1].coverImages).toEqual([
      expect.objectContaining({ url: golf[5], isCover: true, sortOrder: 0 }),
    ]);
  });

  it("keeps covers the admin already set", () => {
    const itinerary = saipanItinerary();
    itinerary.days[1].coverImageUrl = "https://cdn.example.com/manual-cover.webp";
    const result = placeBandVenueImagesInItinerary(itinerary, {
      golfCourses: [{ name: "코랄오션CC", content: "", images: photos("golf", 6) }],
      hotels: null,
      attractions: null,
    });
    expect(result?.days[1].coverImageUrl).toBe("https://cdn.example.com/manual-cover.webp");
    expect(result?.days[1].coverImages).toBeUndefined();
    expect(result?.days[2].coverImageUrl).toBeTruthy();
  });

  it("returns the itinerary unchanged when there is nothing to place", () => {
    expect(placeBandVenueImagesInItinerary(null, { golfCourses: [], hotels: [], attractions: [] })).toBeNull();
    const itinerary = saipanItinerary();
    const result = placeBandVenueImagesInItinerary(itinerary, {
      golfCourses: [{ name: "코랄오션CC", content: "" }],
      hotels: null,
      attractions: null,
    });
    expect(result?.days.flatMap((d) => d.events).some((e) => e.images?.length)).toBe(false);
  });
});
