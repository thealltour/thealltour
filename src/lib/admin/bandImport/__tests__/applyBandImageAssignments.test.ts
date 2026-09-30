import { describe, expect, it } from "vitest";
import { applyBandImageAssignments } from "@/lib/admin/bandImport/applyBandImageAssignments";
import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";

const uploaded = [
  { url: "https://cdn.example.com/hero.jpg", filename: "hero.jpg" },
  { url: "https://cdn.example.com/course.jpg", filename: "course.jpg" },
  { url: "https://cdn.example.com/hotel.jpg", filename: "hotel.jpg" },
  { url: "https://cdn.example.com/qr.png", filename: "qr.png" },
  { url: "https://cdn.example.com/lunch.jpg", filename: "lunch.jpg" },
  { url: "https://cdn.example.com/gallery.jpg", filename: "gallery.jpg" },
];

describe("applyBandImageAssignments", () => {
  it("keeps every non-skipped photo in the gallery with hero first", () => {
    const result = applyBandImageAssignments({
      uploaded,
      assignments: [
        { index: 0, role: "gallery" },
        { index: 1, role: "hero" },
        { index: 2, role: "gallery" },
        { index: 3, role: "skip" },
        { index: 4, role: "gallery" },
        { index: 5, role: "gallery" },
      ],
    });

    expect(result.imageUrl).toBe("https://cdn.example.com/course.jpg");
    expect(result.imagesJson).toEqual([
      "https://cdn.example.com/course.jpg",
      "https://cdn.example.com/hero.jpg",
      "https://cdn.example.com/hotel.jpg",
      "https://cdn.example.com/lunch.jpg",
      "https://cdn.example.com/gallery.jpg",
    ]);
    expect(result.skippedUrls).toEqual(["https://cdn.example.com/qr.png"]);
  });

  it("puts all six photos in the gallery when nothing is skipped", () => {
    const result = applyBandImageAssignments({
      uploaded,
      assignments: uploaded.map((_, index) => ({
        index,
        role: index === 0 ? ("hero" as const) : ("gallery" as const),
      })),
    });
    expect(result.imagesJson).toHaveLength(6);
  });

  it("uses the first gallery photo as hero when vision returns no hero", () => {
    const result = applyBandImageAssignments({
      uploaded,
      assignments: [{ index: 0, role: "skip" }],
    });
    expect(result.imageUrl).toBe("https://cdn.example.com/course.jpg");
    expect(result.imageUrl).not.toBe(BAND_IMPORT_PLACEHOLDER_IMAGE);
  });

  it("uses the first upload as hero and keeps everything when vision fails", () => {
    const result = applyBandImageAssignments({ uploaded, assignments: null });
    expect(result.imageUrl).toBe("https://cdn.example.com/hero.jpg");
    expect(result.imagesJson).toEqual(uploaded.map((item) => item.url));
    expect(result.skippedUrls).toEqual([]);
  });

  it("keeps the photos when vision skips every image", () => {
    const result = applyBandImageAssignments({
      uploaded: uploaded.slice(0, 2),
      assignments: [
        { index: 0, role: "skip" },
        { index: 1, role: "skip" },
      ],
    });
    expect(result.imagesJson).toHaveLength(2);
    expect(result.skippedUrls).toEqual([]);
  });

  it("returns the placeholder only when there are no uploads", () => {
    const result = applyBandImageAssignments({ uploaded: [], assignments: [] });
    expect(result.imageUrl).toBe(BAND_IMPORT_PLACEHOLDER_IMAGE);
    expect(result.imagesJson).toBeNull();
  });
});
