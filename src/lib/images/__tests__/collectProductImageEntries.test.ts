import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import { collectProductImageEntries } from "@/lib/images/collectProductImageEntries";

function product(overrides: Partial<Product>): Product {
  return {
    id: "p-1",
    title: "코타키나발루 골프",
    description: "",
    image_url: "https://cdn.example.com/cover.webp",
    category: "골프",
    price: 0,
    ...overrides,
  } as Product;
}

describe("collectProductImageEntries venue images", () => {
  it("collects golf course and hotel images with venue names", () => {
    const entries = collectProductImageEntries(
      product({
        golf_courses_json: [
          { name: "수트라하버 GC", content: "", images: ["https://cdn.example.com/golf-1.webp"] },
        ],
        hotels_json: [
          {
            name: "마젤란 리조트",
            content: "설명",
            images: ["https://cdn.example.com/hotel-1.webp", "https://cdn.example.com/cover.webp"],
          },
        ],
        attractions_json: [
          { name: "마누칸 섬", content: "", images: ["https://cdn.example.com/island-1.webp"] },
        ],
      }),
    );

    const venue = entries.filter(
      (e) => e.source === "golf-course" || e.source === "hotel" || e.source === "attraction",
    );
    expect(venue.map((e) => [e.source, e.eventHeading, e.imageIndexInEvent])).toEqual([
      ["golf-course", "수트라하버 GC", 1],
      ["hotel", "마젤란 리조트", 1],
      ["attraction", "마누칸 섬", 1],
    ]);
  });
});
