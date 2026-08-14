import { describe, expect, it } from "vitest";
import { applyBandImageAssignments } from "@/lib/admin/bandImport/applyBandImageAssignments";
import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import type { ItineraryV2 } from "@/types/product";

const itinerary: ItineraryV2 = {
  days: [
    {
      day: 1,
      title: "1일차",
      events: [
        { heading: "인천 국제공항 출발", timeText: "08:55", displayRole: "activity" },
        { heading: "18홀 라운드", displayRole: "activity" },
        { heading: "중식", displayRole: "summary" },
        { heading: "숙소", displayRole: "summary" },
      ],
    },
  ],
};

const uploaded = [
  { url: "https://cdn.example.com/hero.jpg", filename: "hero.jpg" },
  { url: "https://cdn.example.com/course.jpg", filename: "course.jpg" },
  { url: "https://cdn.example.com/hotel.jpg", filename: "hotel.jpg" },
  { url: "https://cdn.example.com/qr.png", filename: "qr.png" },
  { url: "https://cdn.example.com/lunch.jpg", filename: "lunch.jpg" },
  { url: "https://cdn.example.com/gallery.jpg", filename: "gallery.jpg" },
];

describe("applyBandImageAssignments", () => {
  it("maps roles onto image_url, day cover, event images, and skips junk", () => {
    const result = applyBandImageAssignments({
      itinerary,
      uploaded,
      assignments: [
        { index: 0, role: "hero", day: null, eventHeading: null },
        { index: 1, role: "dayCover", day: 1, eventHeading: null },
        { index: 2, role: "event", day: 1, eventHeading: "숙소" },
        { index: 3, role: "skip", day: null, eventHeading: null },
        { index: 4, role: "event", day: 1, eventHeading: "중식" },
        { index: 5, role: "gallery", day: null, eventHeading: null },
      ],
    });

    expect(result.imageUrl).toBe("https://cdn.example.com/hero.jpg");
    expect(result.imagesJson).toEqual([
      "https://cdn.example.com/hero.jpg",
      "https://cdn.example.com/gallery.jpg",
    ]);
    expect(result.imagesJson).not.toContain("https://cdn.example.com/qr.png");

    const day = result.itinerary?.days[0];
    expect(day?.coverImageUrl).toBe("https://cdn.example.com/course.jpg");
    expect(day?.events.find((e) => e.heading === "숙소")?.images?.[0]?.url).toBe(
      "https://cdn.example.com/hotel.jpg",
    );
    expect(day?.events.find((e) => e.heading === "중식")?.images?.[0]?.url).toBe(
      "https://cdn.example.com/lunch.jpg",
    );
    expect(day?.events.find((e) => e.heading === "인천 국제공항 출발")?.images).toBeUndefined();
  });

  it("falls back to placeholder hero and gallery-only when vision assignments are missing", () => {
    const result = applyBandImageAssignments({
      itinerary,
      uploaded,
      assignments: null,
    });

    expect(result.imageUrl).toBe(BAND_IMPORT_PLACEHOLDER_IMAGE);
    expect(result.imagesJson).toEqual(uploaded.map((item) => item.url));
    expect(result.itinerary?.days[0].events.every((ev) => !ev.images)).toBe(true);
  });
});
