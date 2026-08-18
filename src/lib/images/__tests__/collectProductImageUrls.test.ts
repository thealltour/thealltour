import { describe, expect, it } from "vitest";
import { collectProductImageUrls } from "@/lib/images/collectProductImageUrls";
import type { Product } from "@/types/product";

const supabaseCover =
  "https://qmswixmwquuazrhfyils.supabase.co/storage/v1/object/public/product-images/cover.webp";
const supabaseCatalog =
  "https://qmswixmwquuazrhfyils.supabase.co/storage/v1/object/public/product-images/catalog.webp";
const externalCdn = "https://image.hanatour.com/spot.jpg";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "테스트",
    description: "설명",
    image_url: supabaseCover,
    category: "여행상품",
    ...overrides,
  };
}

describe("collectProductImageUrls", () => {
  it("includes gallery, itinerary, catalog, and overview images", () => {
    const urls = collectProductImageUrls(
      baseProduct({
        images_json: [supabaseCover, "https://example.com/gallery.jpg"],
        itinerary_v2_json: {
          days: [
            {
              day: 1,
              events: [
                {
                  heading: "관광",
                  images: [{ url: "https://example.com/event.jpg", sortOrder: 0, isCover: true }],
                },
              ],
            },
          ],
        },
        package_catalog_json: {
          hotels: [],
          attractions: [
            {
              name: "오페라하우스",
              description: "",
              imageUrls: [supabaseCatalog],
            },
          ],
          optionalTours: [
            {
              name: "헬기투어",
              description: "",
              imageUrls: ["https://example.com/optional.jpg"],
            },
          ],
        },
        overview_json: {
          enabled: true,
          summaryCards: [],
          coverImageUrl: "https://example.com/overview.jpg",
        },
      }),
    );

    expect(urls).toEqual(
      expect.arrayContaining([
        supabaseCover,
        "https://example.com/gallery.jpg",
        "https://example.com/event.jpg",
        supabaseCatalog,
        "https://example.com/optional.jpg",
        "https://example.com/overview.jpg",
      ]),
    );
  });

  it("keeps external CDN urls in the list so storage delete can skip them", () => {
    const urls = collectProductImageUrls(baseProduct({ image_url: externalCdn }));
    expect(urls).toContain(externalCdn);
  });
});
