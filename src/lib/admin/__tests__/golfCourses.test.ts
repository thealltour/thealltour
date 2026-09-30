import { describe, expect, it } from "vitest";
import { normalizeGolfCoursesJson, normalizeVenueInfoList } from "@/lib/admin/golfCourses";

describe("normalizeVenueInfoList", () => {
  it("filters out rows without a name or without both content and images", () => {
    expect(
      normalizeGolfCoursesJson([
        { name: "수트라하버 GC", content: "설명" },
        { name: "  ", content: "내용만 있음" },
        { name: "이름만 있음", content: "   " },
      ]),
    ).toEqual([{ name: "수트라하버 GC", content: "설명" }]);
  });

  it("returns null when no valid rows", () => {
    expect(normalizeVenueInfoList(null)).toBeNull();
    expect(normalizeVenueInfoList([{ name: "", content: "" }])).toBeNull();
  });

  it("keeps images, trims and dedupes them", () => {
    expect(
      normalizeVenueInfoList([
        {
          name: "A 호텔",
          content: "",
          images: [" https://cdn/a.webp ", "https://cdn/a.webp", "", 3, "https://cdn/b.webp"],
        },
      ]),
    ).toEqual([
      { name: "A 호텔", content: "", images: ["https://cdn/a.webp", "https://cdn/b.webp"] },
    ]);
  });

  it("omits the images key when there are none", () => {
    const [item] = normalizeVenueInfoList([{ name: "B GC", content: "설명", images: [] }]) ?? [];
    expect(item).toEqual({ name: "B GC", content: "설명" });
    expect("images" in item).toBe(false);
  });
});
