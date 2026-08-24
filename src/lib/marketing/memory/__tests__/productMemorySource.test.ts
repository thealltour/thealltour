import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ProductContext, TaxonomyContext } from "@/lib/marketing/context/types";
import {
  PRODUCT_MEMORY_CONFIDENCE,
  PRODUCT_MEMORY_IMPORTANCE_ACTIVE,
  PRODUCT_MEMORY_IMPORTANCE_INACTIVE,
  PRODUCT_MEMORY_SOURCE_TYPE,
  PRODUCT_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { parseProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
import { buildProductMemoryContent, mapProductContextToMemoryDocument } from "@/lib/marketing/memory/productMemoryContent";
import {
  ProductMemorySource,
  parseProductMemoryLoadParams,
} from "@/lib/marketing/memory/sources/productMemorySource";
import type { ExistingMemoryRow, MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-08-25T00:00:00.000Z");
const ENV = { EMBEDDING_DIMENSION: "4" };

function taxonomy(overrides: Partial<TaxonomyContext> = {}): TaxonomyContext {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    name: "다낭",
    slug: "danang",
    taxonomyType: "destination",
    parentId: null,
    displayLabel: "다낭",
    badgeDescription: null,
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

function product(overrides: Partial<ProductContext> = {}): ProductContext {
  return {
    id: PRODUCT_ID,
    title: "다낭 골프 4일",
    oneLiner: null,
    description: null,
    status: null,
    isActive: true,
    price: null,
    priceMeta: null,
    duration: null,
    destination: null,
    productLine: null,
    campaigns: [],
    unresolvedCampaignLabels: [],
    tags: [],
    sellingPoints: null,
    benefits: null,
    tourismPoints: null,
    guidePoints: null,
    inclusions: null,
    includedItems: null,
    exclusions: null,
    optionalTours: null,
    optionalExpenses: null,
    itinerary: null,
    detailedSchedule: null,
    itineraryDays: null,
    itineraryV2: null,
    departureSchedules: null,
    accommodation: null,
    transportation: null,
    insurance: null,
    bookingNotes: null,
    travelNotes: null,
    refundPolicy: null,
    images: ["https://cdn.example.com/secret-token-image.jpg"],
    sourceUrl: "https://internal.example.com/admin",
    ...overrides,
  };
}

function fullProduct(): ProductContext {
  return product({
    oneLiner: "치기 좋은 코스",
    description: "<p>상세 설명</p>",
    status: "AVAILABLE",
    price: 1_290_000,
    priceMeta: "1인 기준",
    duration: "3박 4일",
    destination: taxonomy(),
    productLine: taxonomy({
      id: "44444444-4444-4444-8444-444444444444",
      name: "골프",
      displayLabel: "골프",
      taxonomyType: "product_line",
    }),
    campaigns: [taxonomy({ name: "봄캠페인", displayLabel: "봄특가" })],
    unresolvedCampaignLabels: ["라벨캠페인"],
    tags: ["골프", "다낭"],
    sellingPoints: {
      corePoints: "핵심 포인트",
      tourism: "관광",
      meals: "조식",
      transport: "항공 포함",
      insurance: "여행자보험",
    },
    benefits: "혜택",
    tourismPoints: "관광 포인트",
    guidePoints: "가이드 포인트",
    inclusions: "항공\n호텔",
    includedItems: "카트",
    exclusions: "캐디피",
    optionalTours: "호이안",
    optionalExpenses: "그린피",
    itineraryV2: {
      days: [
        {
          day: 1,
          title: "다낭 도착",
          events: [
            { heading: "공항 픽업", location: "다낭공항" },
            { heading: "시내 관광" },
            { heading: "extra1" },
            { heading: "extra2" },
            { heading: "should-not-appear" },
          ],
        },
        { day: 2, title: "골프", events: [{ heading: "오전 라운딩" }] },
      ],
    },
    itinerary: "이 텍스트는 구조화 일정이 있으면 쓰지 않음",
    detailedSchedule: "중복 상세일정",
    departureSchedules: [{ departureDate: "2026-09-01", price: 1290000, label: "9/1 출발" }],
    accommodation: "호텔",
    transportation: "리무진",
    insurance: "실손",
    bookingNotes: "예약 주의",
    travelNotes: "여행 주의",
    refundPolicy: "환불 규정",
  });
}

function createStore(seed: ExistingMemoryRow[] = []) {
  const rows = [...seed];
  const inserted: MemoryInsertRow[] = [];
  const updated: Array<{ id: string; row: MemoryUpdateRow }> = [];
  const store: MemoryStore = {
    async findBySource(input) {
      return (
        rows.find(
          (row) =>
            row.memoryType === input.memoryType &&
            row.sourceType === input.sourceType &&
            row.sourceId === input.sourceId,
        ) ?? null
      );
    },
    async findSourcelessDuplicate() {
      return null;
    },
    async insert(row) {
      inserted.push(row);
      const id = `mem-${inserted.length}`;
      rows.push({
        id,
        memoryType: row.memory_type,
        title: row.title,
        content: row.content,
        sourceType: row.source_type,
        sourceId: row.source_id,
      });
      return { id };
    },
    async update(id, row) {
      updated.push({ id, row });
    },
  };
  return { store, inserted, updated };
}

function provider() {
  const embed = vi.fn(async () => [0.1, 0.2, 0.3, 0.4]);
  const embedMany = vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4]));
  return { model: "BAAI/bge-m3", embed, embedMany };
}

describe("mapProductContextToMemoryDocument", () => {
  it("maps a minimal product with fixed identity and omits empty sections", () => {
    const document = mapProductContextToMemoryDocument(product());
    expect(document.memoryType).toBe(PRODUCT_MEMORY_TYPE);
    expect(document.sourceType).toBe(PRODUCT_MEMORY_SOURCE_TYPE);
    expect(document.sourceId).toBe(PRODUCT_ID);
    expect(document.title).toBe("다낭 골프 4일");
    expect(document.confidence).toBe(PRODUCT_MEMORY_CONFIDENCE);
    expect(document.importance).toBe(PRODUCT_MEMORY_IMPORTANCE_ACTIVE);
    expect(document.expiresAt).toBeNull();
    expect(document.content).toBe("상품명: 다낭 골프 4일");
    expect(document.content).not.toContain("한줄소개");
    expect(document.content).not.toContain("secret-token");
    expect(document.content).not.toContain("admin");
  });

  it("builds full product content in a deterministic section order", () => {
    const content = buildProductMemoryContent(fullProduct());
    expect(content).toBe(buildProductMemoryContent(fullProduct()));
    expect(content.indexOf("상품명")).toBeLessThan(content.indexOf("한줄소개"));
    expect(content.indexOf("한줄소개")).toBeLessThan(content.indexOf("설명"));
    expect(content.indexOf("목적지")).toBeLessThan(content.indexOf("상품라인"));
    expect(content.indexOf("판매포인트")).toBeLessThan(content.indexOf("포함사항"));
    expect(content.indexOf("포함사항")).toBeLessThan(content.indexOf("불포함사항"));
    expect(content.indexOf("주요일정")).toBeLessThan(content.indexOf("출발일정"));
    expect(content.indexOf("태그")).toBeLessThan(content.indexOf("캠페인"));
    expect(content).toContain("설명: 상세 설명");
    expect(content).toContain("가격: 1290000 (1인 기준)");
    expect(content).toContain("- 핵심: 핵심 포인트");
    expect(content).toContain("- 항공");
    expect(content).toContain("- 카트");
    expect(content).toContain("Day 1 다낭 도착: 공항 픽업 (다낭공항) / 시내 관광 / extra1 / extra2");
    expect(content).not.toContain("should-not-appear");
    expect(content).not.toContain("이 텍스트는 구조화 일정이 있으면 쓰지 않음");
    expect(content).toContain("- 골프");
    expect(content).toContain("- 봄특가");
    expect(content).toContain("- 라벨캠페인");
    expect(JSON.stringify(content)).not.toMatch(/\[object Object\]/);
  });

  it("flattens nested itineraryDays when v2 is absent", () => {
    const content = buildProductMemoryContent(
      product({
        itineraryDays: [
          { day: 1, title: "이동", description: "공항에서 호텔" },
        ],
      }),
    );
    expect(content).toContain("Day 1 이동: 공항에서 호텔");
  });

  it("uses inactive importance without inventing status meaning", () => {
    const document = mapProductContextToMemoryDocument(product({ isActive: false, status: "SOLD_OUT" }));
    expect(document.importance).toBe(PRODUCT_MEMORY_IMPORTANCE_INACTIVE);
    expect(document.content).not.toContain("SOLD_OUT");
  });
});

describe("parseProductMemoryLoadParams", () => {
  it("parses exact productId and default limit", () => {
    expect(parseProductMemoryLoadParams({ productId: PRODUCT_ID })).toEqual({
      ids: [PRODUCT_ID],
      activeOnly: false,
      limit: 20,
    });
  });

  it("rejects oversized limit and unsupported updatedAfter", () => {
    expect(() => parseProductMemoryLoadParams({ productId: PRODUCT_ID, limit: 101 })).toThrow(MemoryValidationError);
    expect(() => parseProductMemoryLoadParams({ productId: PRODUCT_ID, updatedAfter: "2026-01-01" })).toThrow(
      MemoryValidationError,
    );
  });
});

describe("ProductMemorySource", () => {
  it("loads an exact productId through the injected ProductContext loader", async () => {
    const loadProducts = vi.fn(async () => [product()]);
    const source = new ProductMemorySource({ loadProducts });
    const documents = await source.load({ productId: PRODUCT_ID, activeOnly: true, limit: 5 });
    expect(source.name).toBe("product");
    expect(loadProducts).toHaveBeenCalledWith({ ids: [PRODUCT_ID], activeOnly: true, limit: 5 });
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(PRODUCT_ID);
  });

  it("passes productIds and limit to the loader", async () => {
    const loadProducts = vi.fn(async () => [product(), product({ id: PRODUCT_ID_B, title: "나트랑" })]);
    const source = new ProductMemorySource({ loadProducts });
    await source.load({ productIds: [PRODUCT_ID, PRODUCT_ID_B], limit: 2 });
    expect(loadProducts).toHaveBeenCalledWith({
      ids: [PRODUCT_ID, PRODUCT_ID_B],
      activeOnly: false,
      limit: 2,
    });
  });
});

describe("product memory ingestion", () => {
  it("plans insert, skip, and update for sourced product memory", async () => {
    const created = mapProductContextToMemoryDocument(product());
    const changed = mapProductContextToMemoryDocument(product({ oneLiner: "변경" }));
    const seedNormalized = normalizeMemoryDocument(created, NOW);
    if ("skip" in seedNormalized) throw new Error("unexpected skip");
    const seed: ExistingMemoryRow = {
      id: "mem-existing",
      memoryType: seedNormalized.memoryType,
      title: seedNormalized.title,
      content: seedNormalized.content,
      sourceType: seedNormalized.sourceType,
      sourceId: seedNormalized.sourceId,
    };

    const insertRun = createStore();
    const insertProvider = provider();
    const inserted = await ingestMemoryDocuments({
      documents: [created],
      store: insertRun.store,
      provider: insertProvider,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(inserted.inserted).toBe(1);
    expect(insertProvider.embedMany).toHaveBeenCalledTimes(1);

    const skipRun = createStore([seed]);
    const skipProvider = provider();
    const skipped = await ingestMemoryDocuments({
      documents: [created],
      store: skipRun.store,
      provider: skipProvider,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(skipped.skipped).toBe(1);
    expect(skipRun.inserted).toHaveLength(0);
    expect(skipProvider.embedMany).not.toHaveBeenCalled();

    const updateRun = createStore([seed]);
    const updated = await ingestMemoryDocuments({
      documents: [changed],
      store: updateRun.store,
      provider: provider(),
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(updated.updated).toBe(1);
    expect(updateRun.updated[0]?.row.content).toContain("한줄소개: 변경");
    expect(updateRun.updated[0]?.row.embedding_model).toBe("BAAI/bge-m3");
  });

  it("does not write or embed during dry-run", async () => {
    const fixtures = createStore();
    const mockProvider = provider();
    const result = await ingestMemoryDocuments({
      documents: [mapProductContextToMemoryDocument(product())],
      store: fixtures.store,
      provider: mockProvider,
      dryRun: true,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(result.inserted).toBe(1);
    expect(result.results[0]?.reason).toBe("dry_run");
    expect(fixtures.inserted).toHaveLength(0);
    expect(mockProvider.embedMany).not.toHaveBeenCalled();
    expect(mockProvider.embed).not.toHaveBeenCalled();
  });
});

describe("parseProductMemoryCliArgs", () => {
  it("requires product id and defaults to dry-run", () => {
    expect(() => parseProductMemoryCliArgs([])).toThrow("--product-id is required");
    expect(parseProductMemoryCliArgs(["--product-id", PRODUCT_ID])).toEqual({
      productId: PRODUCT_ID,
      apply: false,
      preview: false,
    });
  });

  it("enables apply unless dry-run is also present", () => {
    expect(parseProductMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--preview"])).toMatchObject({
      apply: true,
      preview: true,
    });
    expect(parseProductMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--dry-run"]).apply).toBe(false);
  });
});
