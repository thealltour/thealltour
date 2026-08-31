import { describe, expect, it } from "vitest";
import {
  mapProductRowToListItem,
  PRODUCT_LISTING_COLUMN_KEYS,
  PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS,
  PRODUCT_LISTING_SELECT,
} from "@/lib/products/productListItem";

describe("PRODUCT_LISTING_SELECT projection", () => {
  it("includes card-required columns", () => {
    const select = PRODUCT_LISTING_SELECT;
    for (const key of [
      "id",
      "title",
      "price",
      "seasonal_price_bands",
      "price_meta",
      "duration",
      "category",
      "theme",
      "meta_title",
      "status",
      "campaigns_json",
      "image_url",
      "images_json",
      "meta_info",
      "one_liner",
      "overview_accommodation",
      "overview_region",
      "overview_duration",
      "departure_from_date",
      "departure_schedules_json",
      "destination_id",
    ]) {
      expect(select).toContain(key);
    }
    // Absent on current prod DB — must not be in explicit select
    expect(select.split(",")).not.toContain("campaigns");
    expect(select.split(",")).not.toContain("is_recommend");
    expect(select.split(",")).not.toContain("is_popular");
    expect(select.split(",")).not.toContain("trust");
    expect(PRODUCT_LISTING_COLUMN_KEYS.join(",")).toBe(select);
  });

  it("excludes PDP heavy columns", () => {
    const select = PRODUCT_LISTING_SELECT;
    for (const key of PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS) {
      expect(select).not.toContain(key);
    }
  });
});

describe("mapProductRowToListItem", () => {
  it("maps image, pricing, campaign, trust, overview, departure fields", () => {
    const item = mapProductRowToListItem({
      id: "p1",
      title: "일본 골프",
      category: "일본",
      price: 1200000,
      seasonal_price_bands: { off_season: 900000, weekend: 1100000, peak_season: 1300000 },
      price_meta: "1인 기준",
      duration: "4박5일",
      theme: "골프 / 온천",
      meta_title: "#골프 #온천",
      status: "AVAILABLE",
      campaigns: ["추천"],
      campaigns_json: ["추천"],
      is_recommend: true,
      is_popular: false,
      image_url: "https://cdn.example/cover.jpg",
      images_json: ["https://cdn.example/cover.jpg", "https://cdn.example/2.jpg"],
      meta_info: "4성급 호텔",
      one_liner: "가성비 골프",
      overview_accommodation: "4성급",
      overview_region: "오사카",
      overview_duration: "4박5일",
      trust: { ratingAvg: 4.8, reviewCount: 12, recentConsultCount: 5 },
      departure_from_date: "2026-09-01",
      departure_schedules_json: [{ departureDate: "2026-10-01", status: "AVAILABLE" }],
    });

    expect(item.id).toBe("p1");
    expect(item.title).toBe("일본 골프");
    expect(item.image_url).toBe("https://cdn.example/cover.jpg");
    expect(item.images_json).toEqual([
      "https://cdn.example/cover.jpg",
      "https://cdn.example/2.jpg",
    ]);
    expect(item.seasonal_price_bands).toEqual({
      offSeason: 900000,
      weekend: 1100000,
      peakSeason: 1300000,
    });
    expect(item.price_meta).toBe("1인 기준");
    expect(item.campaigns_json).toEqual(["추천"]);
    expect(item.is_recommend).toBe(true);
    expect(item.trust?.ratingAvg).toBe(4.8);
    expect(item.trust?.reviewCount).toBe(12);
    expect(item.overview_region).toBe("오사카");
    expect(item.departure_from_date).toBe("2026-09-01");
    expect(item.departures).toEqual(["2026-10-01"]);
  });

  it("handles null/malformed JSON safely", () => {
    const item = mapProductRowToListItem({
      id: "p2",
      title: null,
      images_json: "not-json",
      seasonal_price_bands: "bad",
      trust: null,
    });
    expect(item.title).toBe("상품명 미정");
    expect(item.category).toBe("여행상품");
    expect(item.images_json).toBeUndefined();
    expect(item.seasonal_price_bands).toBeUndefined();
    expect(item.trust).toBeUndefined();
  });
});
