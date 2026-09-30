import { describe, expect, it } from "vitest";
import {
  collectVenueGalleryImages,
  getPrimaryImageUrl,
  getPrimaryImageUrlFromFormFields,
  mapAdminListProductRow,
  withPrimaryImageFirst,
} from "@/lib/products/images";
import { normalizeProduct } from "@/lib/products";

describe("getPrimaryImageUrl", () => {
  it("prefers image_url when it is in the gallery", () => {
    expect(
      getPrimaryImageUrl({
        image_url: "https://example.com/cover.jpg",
        images_json: [
          "https://example.com/first.jpg",
          "https://example.com/cover.jpg",
          "https://example.com/third.jpg",
        ],
      }),
    ).toBe("https://example.com/cover.jpg");
  });

  it("falls back to first gallery image when cover is unset", () => {
    expect(
      getPrimaryImageUrl({
        image_url: "",
        images_json: ["https://example.com/first.jpg", "https://example.com/second.jpg"],
      }),
    ).toBe("https://example.com/first.jpg");
  });

  it("getPrimaryImageUrlFromFormFields prefers image_url over gallery order", () => {
    expect(
      getPrimaryImageUrlFromFormFields("https://example.com/cover.jpg", [
        "https://example.com/first.jpg",
        "https://example.com/cover.jpg",
      ]),
    ).toBe("https://example.com/cover.jpg");
  });
});

describe("withPrimaryImageFirst", () => {
  it("moves primary url to the front of the gallery", () => {
    expect(
      withPrimaryImageFirst(
        ["https://example.com/first.jpg", "https://example.com/cover.jpg"],
        "https://example.com/cover.jpg",
      ),
    ).toEqual(["https://example.com/cover.jpg", "https://example.com/first.jpg"]);
  });

  it("prepends primary when it is missing from the gallery", () => {
    expect(
      withPrimaryImageFirst(["https://example.com/first.jpg"], "https://example.com/cover.jpg"),
    ).toEqual(["https://example.com/cover.jpg", "https://example.com/first.jpg"]);
  });
});

describe("collectVenueGalleryImages", () => {
  it("orders venue photos golf → attraction → hotel and skips venues without photos", () => {
    const images = collectVenueGalleryImages({
      golf_courses_json: [
        { name: "수트라하버 GC", content: "", images: ["https://cdn/golf-1.webp", "https://cdn/golf-2.webp"] },
        { name: "사진 없는 GC", content: "설명" },
      ],
      hotels_json: [{ name: "마젤란 리조트", content: "", images: ["https://cdn/hotel-1.webp"] }],
      attractions_json: [{ name: "마누칸 섬", content: "", images: ["https://cdn/island-1.webp"] }],
    });

    expect(images.map((image) => [image.kindLabel, image.venueName, image.url])).toEqual([
      ["골프장", "수트라하버 GC", "https://cdn/golf-1.webp"],
      ["골프장", "수트라하버 GC", "https://cdn/golf-2.webp"],
      ["관광지", "마누칸 섬", "https://cdn/island-1.webp"],
      ["호텔", "마젤란 리조트", "https://cdn/hotel-1.webp"],
    ]);
  });

  it("returns nothing when no venue has photos", () => {
    expect(
      collectVenueGalleryImages({ golf_courses_json: null, hotels_json: undefined, attractions_json: [] }),
    ).toEqual([]);
  });
});

describe("mapAdminListProductRow", () => {
  it("keeps stored cover when gallery has a different first image", () => {
    const row = mapAdminListProductRow({
      id: "p1",
      image_url: "https://example.com/cover.jpg",
      images_json: [
        "https://example.com/first.jpg",
        "https://example.com/cover.jpg",
      ],
    });

    expect(row.image_url).toBe("https://example.com/cover.jpg");
    expect(row.images_json).toEqual([
      "https://example.com/first.jpg",
      "https://example.com/cover.jpg",
    ]);
  });
});

describe("normalizeProduct cover image", () => {
  it("keeps stored image_url when gallery contains it", () => {
    const product = normalizeProduct({
      id: "p1",
      title: "테스트",
      description: "설명",
      image_url: "https://example.com/cover.jpg",
      images_json: [
        "https://example.com/first.jpg",
        "https://example.com/cover.jpg",
      ],
      category: "여행상품",
    });

    expect(product.image_url).toBe("https://example.com/cover.jpg");
  });
});
