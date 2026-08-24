import { describe, expect, it } from "vitest";
import { ContextValidationError } from "@/lib/marketing/context/errors";
import { createContextSource } from "@/lib/marketing/context/provenance";
import { assembleMarketingContextPackage } from "@/lib/marketing/context/assembleMarketingContextPackage";
import { mapProductRowToContext } from "@/lib/marketing/context/mappers/productContextMapper";
import { mapTaxonomyRowToContext, type ProductTaxonomyRow } from "@/lib/marketing/context/mappers/taxonomyContextMapper";
import { mapThreadMarketingPostToHistory } from "@/lib/marketing/context/mappers/contentHistoryMapper";
import {
  DEFAULT_LOOKBACK_DAYS,
  MAX_LOOKBACK_DAYS,
  parseMarketingContextRequest,
  resolvePeriod,
} from "@/lib/marketing/context/validation";
import type { ProductContext } from "@/lib/marketing/context/types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const DESTINATION_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";

function sampleProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    title: "다낭 골프 4일",
    one_liner: "치기 좋은 코스",
    description: "상세 설명",
    status: "AVAILABLE",
    is_active: true,
    price: 1290000,
    price_meta: "1인 기준",
    duration: "3박 4일",
    destination_id: DESTINATION_ID,
    product_line_id: null,
    campaigns_json: [CAMPAIGN_ID, "봄특가"],
    tags_json: ["골프", "다낭"],
    selling_points_json: {
      corePoints: "핵심 포인트",
      tourism: "관광",
      transport: "항공 포함",
      insurance: "여행자보험",
    },
    point_benefits: "혜택",
    point_tourism: "관광 포인트",
    point_guide: "가이드 포인트",
    inclusions: "포함",
    included_items: "포함 항목",
    excluded_items: "불포함",
    optional_tours: "선택관광",
    optional_expenses: "선택경비",
    itinerary: "일정",
    detailed_schedule: "상세일정",
    itinerary_days_json: null,
    itinerary_v2_json: null,
    departure_schedules_json: [{ departureDate: "2026-09-01" }],
    overview_accommodation: "호텔",
    travel_insurance: "보험 안내",
    booking_notes: "예약 주의",
    travel_notes: "여행 주의",
    refund_policy: "환불 규정",
    images_json: ["https://cdn.example.com/a.jpg"],
    image_url: "https://cdn.example.com/hero.jpg",
    product_source_url: "https://example.com/source",
    ...overrides,
  };
}

describe("mapProductRowToContext", () => {
  it("maps an existing product row into ProductContext", () => {
    const destination = {
      id: DESTINATION_ID,
      name: "다낭",
      slug: "danang",
      taxonomy_type: "destination",
      parent_id: null,
      display_label: "다낭",
      badge_description: null,
      seo_title: "다낭 골프",
      seo_description: "다낭 골프 여행",
    };
    const campaign = {
      id: CAMPAIGN_ID,
      name: "얼리버드",
      slug: "early-bird",
      taxonomy_type: "campaign",
      parent_id: null,
      display_label: "얼리버드",
      badge_description: "조기예약",
      seo_title: null,
      seo_description: null,
    };

    const taxonomiesById = new Map<string, ProductTaxonomyRow>([
      [DESTINATION_ID, destination],
      [CAMPAIGN_ID, campaign],
    ]);

    const context = mapProductRowToContext(sampleProduct(), taxonomiesById);

    expect(context).not.toBeNull();
    expect(context?.id).toBe(PRODUCT_ID);
    expect(context?.title).toBe("다낭 골프 4일");
    expect(context?.oneLiner).toBe("치기 좋은 코스");
    expect(context?.isActive).toBe(true);
    expect(context?.destination?.name).toBe("다낭");
    expect(context?.campaigns).toHaveLength(1);
    expect(context?.campaigns[0]?.taxonomyType).toBe("campaign");
    expect(context?.unresolvedCampaignLabels).toEqual(["봄특가"]);
    expect(context?.tags).toEqual(["골프", "다낭"]);
    expect(context?.sellingPoints?.corePoints).toBe("핵심 포인트");
    expect(context?.transportation).toBe("항공 포함");
    expect(context?.images[0]).toBe("https://cdn.example.com/hero.jpg");
    expect(context?.sourceUrl).toBe("https://example.com/source");
  });

  it("returns null when the product row has no id", () => {
    expect(mapProductRowToContext(sampleProduct({ id: null }))).toBeNull();
  });

  it("keeps inactive products instead of dropping them", () => {
    const context = mapProductRowToContext(sampleProduct({ is_active: false }));
    expect(context?.isActive).toBe(false);
    expect(context?.title).toBe("다낭 골프 4일");
  });

  it("treats null jsonb fields as empty/null without inventing values", () => {
    const context = mapProductRowToContext(
      sampleProduct({
        campaigns_json: null,
        tags_json: null,
        selling_points_json: null,
        itinerary_days_json: null,
        images_json: null,
        image_url: null,
      }),
    );
    expect(context?.campaigns).toEqual([]);
    expect(context?.tags).toEqual([]);
    expect(context?.sellingPoints).toBeNull();
    expect(context?.itineraryDays).toBeNull();
    expect(context?.images).toEqual([]);
  });
});

describe("mapTaxonomyRowToContext", () => {
  it("maps taxonomy fields without forcing taxonomyType into an enum", () => {
    const context = mapTaxonomyRowToContext({
      id: DESTINATION_ID,
      name: "다낭",
      slug: "danang",
      taxonomy_type: "custom_region",
      parent_id: null,
      display_label: "다낭",
      badge_description: "배지",
      seo_title: "SEO",
      seo_description: "설명",
    });
    expect(context).toEqual({
      id: DESTINATION_ID,
      name: "다낭",
      slug: "danang",
      taxonomyType: "custom_region",
      parentId: null,
      displayLabel: "다낭",
      badgeDescription: "배지",
      seoTitle: "SEO",
      seoDescription: "설명",
    });
  });
});

describe("provenance", () => {
  it("creates a product context source", () => {
    const source = createContextSource({
      sourceType: "product",
      sourceTable: "products",
      sourceId: PRODUCT_ID,
      retrievedAt: "2026-08-24T00:00:00.000Z",
    });
    expect(source).toEqual({
      sourceType: "product",
      sourceId: PRODUCT_ID,
      sourceTable: "products",
      retrievedAt: "2026-08-24T00:00:00.000Z",
      periodStart: null,
      periodEnd: null,
    });
  });
});

describe("assembleMarketingContextPackage", () => {
  it("includes product context and does not fail when optional contexts are missing", () => {
    const product = mapProductRowToContext(sampleProduct()) as ProductContext;
    const pkg = assembleMarketingContextPackage({
      request: { purpose: "content_generation", productId: PRODUCT_ID },
      product,
      sources: [
        createContextSource({
          sourceType: "product",
          sourceTable: "products",
          sourceId: PRODUCT_ID,
          retrievedAt: "2026-08-24T00:00:00.000Z",
        }),
      ],
      generatedAt: "2026-08-24T00:00:00.000Z",
    });

    expect(pkg.context.product?.id).toBe(PRODUCT_ID);
    expect(pkg.context.customerInsights).toBeNull();
    expect(pkg.context.bookingInsights).toBeNull();
    expect(pkg.context.reviewInsights).toBeNull();
    expect(pkg.context.memory).toBeNull();
    expect(pkg.governance.recentAgendaUsage).toBeUndefined();
    expect(pkg.sources[0]?.sourceType).toBe("product");
  });
});

describe("content history mapping", () => {
  it("keeps thread marketing post body as null", () => {
    const item = mapThreadMarketingPostToHistory({
      id: PRODUCT_ID,
      product_id: PRODUCT_ID,
      published_at: "2026-08-01T00:00:00.000Z",
      created_at: "2026-08-01T00:00:00.000Z",
      permalink: "https://threads.net/p/1",
      target_keyword: "다낭골프",
      media_id: "media-1",
    });
    expect(item?.body).toBeNull();
    expect(item?.sourceType).toBe("thread_marketing_post");
    expect(item?.similarityAvailable).toBe(false);
  });
});

describe("validation", () => {
  it("rejects a non-uuid productId", () => {
    expect(() =>
      parseMarketingContextRequest({ purpose: "content_generation", productId: "not-a-uuid" }),
    ).toThrow(ContextValidationError);
  });

  it("rejects a negative lookbackDays", () => {
    expect(() =>
      parseMarketingContextRequest({ purpose: "content_generation", lookbackDays: -1 }),
    ).toThrow(ContextValidationError);
  });

  it("rejects a lookbackDays above the cap", () => {
    expect(() =>
      parseMarketingContextRequest({
        purpose: "content_generation",
        lookbackDays: MAX_LOOKBACK_DAYS + 1,
      }),
    ).toThrow(ContextValidationError);
  });

  it("rejects a reversed date range", () => {
    expect(() =>
      parseMarketingContextRequest({
        purpose: "content_generation",
        periodStart: "2026-08-10",
        periodEnd: "2026-08-01",
      }),
    ).toThrow(ContextValidationError);
  });

  it("defaults lookback to 30 days", () => {
    const period = resolvePeriod({ now: new Date("2026-08-31T00:00:00.000Z") });
    expect(DEFAULT_LOOKBACK_DAYS).toBe(30);
    expect(period.end).toBe("2026-08-31T00:00:00.000Z");
    expect(period.start).toBe("2026-08-01T00:00:00.000Z");
  });
});
