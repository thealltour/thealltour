import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyReviewInsight, mapReviewInsight } from "@/lib/marketing/context/mappers/reviewInsightMapper";
import type { ReviewInsightContext } from "@/lib/marketing/context/types";
import {
  REVIEW_MEMORY_CONFIDENCE_HIGH,
  REVIEW_MEMORY_CONFIDENCE_LOW,
  REVIEW_MEMORY_CONFIDENCE_MID,
  REVIEW_MEMORY_IMPORTANCE,
  REVIEW_MEMORY_IMPORTANCE_ENOUGH,
  REVIEW_MEMORY_IMPORTANCE_RICH,
  REVIEW_MEMORY_SOURCE_TYPE,
  REVIEW_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import { parseProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
import {
  buildReviewMemoryContent,
  mapReviewInsightToMemoryDocument,
  reviewMemoryConfidence,
  reviewMemoryImportance,
} from "@/lib/marketing/memory/reviewMemoryContent";
import {
  ReviewMemorySource,
  parseReviewMemoryLoadParams,
} from "@/lib/marketing/memory/sources/reviewMemorySource";
import type { ReviewMemoryBundle } from "@/lib/marketing/memory/sources/reviewMemorySource";
import type { ExistingMemoryRow, MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-08-25T00:00:00.000Z");
const ENV = { EMBEDDING_DIMENSION: "4" };

function insight(overrides: Partial<ReviewInsightContext> = {}): ReviewInsightContext {
  return {
    ...emptyReviewInsight(),
    reviewCount: 12,
    averageRating: 4.6,
    summaryText: "일정과 가이드가 좋다는 평가가 많습니다.",
    positivePoints: ["가이드가 친절"],
    negativePoints: ["이동이 김"],
    contentTips: ["편한 신발"],
    scheduleRating: 4.5,
    stayRating: 4,
    guideRating: 5,
    foodRating: 3.8,
    recommendedFor: ["커플"],
    ...overrides,
  };
}

function documentFromInsight(overrides: Partial<ReviewInsightContext> = {}, title = "스페인 일주") {
  return mapReviewInsightToMemoryDocument({
    productId: PRODUCT_ID,
    productTitle: title,
    insight: insight(overrides),
  });
}

function bundle(overrides: Partial<ReviewMemoryBundle> = {}): ReviewMemoryBundle {
  return {
    productId: PRODUCT_ID,
    productTitle: "스페인 일주",
    summary: {
      product_id: PRODUCT_ID,
      review_count: 12,
      average_rating: 4.6,
      summary_text: "일정과 가이드가 좋다는 평가가 많습니다.",
      positive_points: ["가이드가 친절"],
      negative_points: ["이동이 김"],
      recommended_for: ["커플"],
    },
    reviews: [
      {
        content_good: "일정이 알참",
        content_bad: "버스가 오래 걸림",
        content_tip: "편한 신발",
        rating: 5,
        rating_schedule: 5,
        rating_stay: 4,
        rating_guide: 5,
        rating_food: 4,
      },
    ],
    ...overrides,
  };
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

describe("mapReviewInsight / review memory content", () => {
  it("maps summary fields including summary_text", () => {
    const mapped = mapReviewInsight({
      summary: {
        review_count: 12,
        average_rating: 4.6,
        summary_text: "요약 본문",
        positive_points: ["친절"],
        negative_points: ["이동"],
        recommended_for: ["가족"],
      },
      reviews: [],
    });
    expect(mapped.summaryText).toBe("요약 본문");
    expect(mapped.reviewCount).toBe(12);
    expect(mapped.averageRating).toBe(4.6);
    expect(mapped.positivePoints).toEqual(["친절"]);
    expect(mapped.recommendedFor).toEqual(["가족"]);
  });

  it("falls back to raw review aggregation when summary is missing", () => {
    const mapped = mapReviewInsight({
      summary: null,
      reviews: [
        {
          content_good: "가이드가 좋음",
          content_bad: "식사 아쉬움",
          content_tip: "편한 신발",
          rating: 4,
          rating_schedule: 5,
          rating_stay: 4,
          rating_guide: 5,
          rating_food: 3,
        },
        {
          content_good: "일정 알참",
          content_bad: null,
          content_tip: "편한 신발",
          rating: 5,
          rating_schedule: 4,
          rating_stay: 4,
          rating_guide: 5,
          rating_food: 3,
        },
      ],
    });
    expect(mapped.reviewCount).toBe(2);
    expect(mapped.averageRating).toBe(4.5);
    expect(mapped.summaryText).toBeNull();
    expect(mapped.positivePoints).toEqual(["가이드가 좋음", "일정 알참"]);
    expect(mapped.negativePoints).toEqual(["식사 아쉬움"]);
    expect(mapped.contentTips).toEqual(["편한 신발"]);
    expect(mapped.scheduleRating).toBe(4.5);
    expect(mapped.stayRating).toBe(4);
    expect(mapped.guideRating).toBe(5);
    expect(mapped.foodRating).toBe(3);

    const document = mapReviewInsightToMemoryDocument({
      productId: PRODUCT_ID,
      productTitle: "스페인 일주",
      insight: mapped,
    });
    expect(document?.content).toContain("리뷰 수: 2");
    expect(document?.content).toContain("긍정 포인트:");
    expect(document?.content).not.toContain("리뷰 요약:");
  });

  it("returns no memory document when there are zero reviews and no summary", () => {
    expect(mapReviewInsight({ summary: null, reviews: [] })).toEqual(emptyReviewInsight());
    expect(
      mapReviewInsightToMemoryDocument({
        productId: PRODUCT_ID,
        productTitle: "스페인 일주",
        insight: emptyReviewInsight(),
      }),
    ).toBeNull();
  });

  it("omits null positive/negative sections and empty recommendedFor", () => {
    const content = buildReviewMemoryContent({
      productId: PRODUCT_ID,
      productTitle: "스페인 일주",
      insight: insight({
        positivePoints: [],
        negativePoints: [],
        recommendedFor: [],
        contentTips: [],
        summaryText: "요약만",
      }),
    });
    expect(content).toContain("리뷰 요약: 요약만");
    expect(content).not.toContain("긍정 포인트");
    expect(content).not.toContain("부정 포인트");
    expect(content).not.toContain("추천 대상");
    expect(content).not.toContain("고객 팁");
  });

  it("includes subratings and recommendedFor in a deterministic section order", () => {
    const content = buildReviewMemoryContent({
      productId: PRODUCT_ID,
      productTitle: "스페인 일주",
      insight: insight(),
    });
    expect(content).toBe(
      buildReviewMemoryContent({
        productId: PRODUCT_ID,
        productTitle: "스페인 일주",
        insight: insight(),
      }),
    );
    expect(content.indexOf("상품")).toBeLessThan(content.indexOf("리뷰 요약"));
    expect(content.indexOf("리뷰 요약")).toBeLessThan(content.indexOf("평균 평점"));
    expect(content.indexOf("평균 평점")).toBeLessThan(content.indexOf("리뷰 수"));
    expect(content.indexOf("리뷰 수")).toBeLessThan(content.indexOf("긍정 포인트"));
    expect(content.indexOf("긍정 포인트")).toBeLessThan(content.indexOf("부정 포인트"));
    expect(content.indexOf("부정 포인트")).toBeLessThan(content.indexOf("추천 대상"));
    expect(content.indexOf("추천 대상")).toBeLessThan(content.indexOf("세부 평가"));
    expect(content.indexOf("세부 평가")).toBeLessThan(content.indexOf("고객 팁"));
    expect(content).toContain("- 일정: 4.5");
    expect(content).toContain("- 숙박: 4");
    expect(content).toContain("- 가이드: 5");
    expect(content).toContain("- 식사: 3.8");
    expect(content).toContain("- 커플");
  });

  it("caps fallback snippets instead of dumping every raw review", () => {
    const mapped = mapReviewInsight({
      summary: null,
      reviews: Array.from({ length: 12 }, (_, index) => ({
        content_good: `좋은점 ${index + 1} ${"가".repeat(80)}`,
        content_bad: `아쉬운점 ${index + 1}`,
        content_tip: `팁 ${index + 1}`,
        rating: 5,
      })),
    });
    const content = buildReviewMemoryContent({
      productId: PRODUCT_ID,
      productTitle: null,
      insight: mapped,
    });
    expect(content.match(/^- 좋은점 /gm)?.length).toBe(8);
    expect(content.match(/^- 팁 /gm)?.length).toBe(5);
    expect(content).not.toContain("좋은점 9");
    expect(content).not.toContain("팁 6");
    expect(JSON.stringify(content)).not.toMatch(/\[object Object\]/);
  });

  it("does not include customer identifying fields in memory content", () => {
    const mapped = mapReviewInsight({
      summary: {
        summary_text: "일정 만족",
        review_count: 2,
        positive_points: ["가이드"],
        source_review_ids: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      } as never,
      reviews: [
        {
          content_good: "가이드가 친절",
          content_bad: "이동이 김",
          content_tip: "편한 신발",
          rating: 5,
          booking_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          author_name: "홍길동",
          member_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          email: "hong@example.com",
          phone: "010-1234-5678",
          passport: "M1234567",
          address: "서울시 강남구",
        } as never,
      ],
    });
    const document = mapReviewInsightToMemoryDocument({
      productId: PRODUCT_ID,
      productTitle: "스페인 일주",
      insight: mapped,
    });
    expect(document?.sourceId).toBe(PRODUCT_ID);
    expect(document?.content).not.toContain("홍길동");
    expect(document?.content).not.toContain("hong@example.com");
    expect(document?.content).not.toContain("010-1234-5678");
    expect(document?.content).not.toContain("M1234567");
    expect(document?.content).not.toContain("서울시 강남구");
    expect(document?.content).not.toContain("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(document?.content).not.toContain("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(document?.content).not.toContain("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});

describe("review memory confidence and importance", () => {
  it("uses simple review-count buckets", () => {
    expect(reviewMemoryConfidence(1)).toBe(REVIEW_MEMORY_CONFIDENCE_LOW);
    expect(reviewMemoryConfidence(2)).toBe(REVIEW_MEMORY_CONFIDENCE_LOW);
    expect(reviewMemoryConfidence(3)).toBe(REVIEW_MEMORY_CONFIDENCE_MID);
    expect(reviewMemoryConfidence(9)).toBe(REVIEW_MEMORY_CONFIDENCE_MID);
    expect(reviewMemoryConfidence(10)).toBe(REVIEW_MEMORY_CONFIDENCE_HIGH);
    expect(reviewMemoryImportance(1)).toBe(REVIEW_MEMORY_IMPORTANCE);
    expect(reviewMemoryImportance(5)).toBe(REVIEW_MEMORY_IMPORTANCE_ENOUGH);
    expect(reviewMemoryImportance(10)).toBe(REVIEW_MEMORY_IMPORTANCE_RICH);
  });
});

describe("parseReviewMemoryLoadParams", () => {
  it("requires productId or productIds and parses exact productId", () => {
    expect(() => parseReviewMemoryLoadParams({})).toThrow(MemoryValidationError);
    expect(parseReviewMemoryLoadParams({ productId: PRODUCT_ID })).toEqual({
      ids: [PRODUCT_ID],
      limit: 20,
      minReviewCount: 1,
      period: null,
    });
  });

  it("parses productIds, minReviewCount, limit, and period", () => {
    const parsed = parseReviewMemoryLoadParams({
      productIds: [PRODUCT_ID, PRODUCT_ID_B],
      minReviewCount: 3,
      limit: 2,
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-01-31T00:00:00.000Z",
    });
    expect(parsed.ids).toEqual([PRODUCT_ID, PRODUCT_ID_B]);
    expect(parsed.minReviewCount).toBe(3);
    expect(parsed.limit).toBe(2);
    expect(parsed.period).toEqual({
      start: "2026-01-01T00:00:00.000Z",
      end: "2026-01-31T00:00:00.000Z",
    });
  });

  it("rejects oversized limit", () => {
    expect(() => parseReviewMemoryLoadParams({ productId: PRODUCT_ID, limit: 101 })).toThrow(MemoryValidationError);
  });
});

describe("ReviewMemorySource", () => {
  it("loads one review_insight document per product with fixed identity", async () => {
    const loadBundles = vi.fn(async () => [bundle()]);
    const source = new ReviewMemorySource({ loadBundles });
    const documents = await source.load({ productId: PRODUCT_ID });
    expect(source.name).toBe("review");
    expect(loadBundles).toHaveBeenCalledWith({
      ids: [PRODUCT_ID],
      limit: 20,
      minReviewCount: 1,
      period: null,
    });
    expect(documents).toHaveLength(1);
    expect(documents[0]?.memoryType).toBe(REVIEW_MEMORY_TYPE);
    expect(documents[0]?.sourceType).toBe(REVIEW_MEMORY_SOURCE_TYPE);
    expect(documents[0]?.sourceId).toBe(PRODUCT_ID);
    expect(documents[0]?.expiresAt).toBeNull();
    expect(documents[0]?.title).toBe("스페인 일주 리뷰 인사이트");
  });

  it("filters by productIds, minReviewCount, and limit", async () => {
    const loadBundles = vi.fn(async () => [
      bundle({ productId: PRODUCT_ID, summary: { review_count: 2, summary_text: "적음" } }),
      bundle({
        productId: PRODUCT_ID_B,
        productTitle: "포르투갈",
        summary: { review_count: 12, summary_text: "충분" },
      }),
    ]);
    const source = new ReviewMemorySource({ loadBundles });
    const documents = await source.load({
      productIds: [PRODUCT_ID, PRODUCT_ID_B],
      minReviewCount: 5,
      limit: 2,
    });
    expect(loadBundles).toHaveBeenCalledWith({
      ids: [PRODUCT_ID, PRODUCT_ID_B],
      limit: 2,
      minReviewCount: 5,
      period: null,
    });
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(PRODUCT_ID_B);
  });

  it("returns no documents for a product with zero reviews", async () => {
    const source = new ReviewMemorySource({
      loadBundles: async () => [bundle({ summary: null, reviews: [] })],
    });
    await expect(source.load({ productId: PRODUCT_ID, minReviewCount: 0 })).resolves.toEqual([]);
  });
});

describe("review memory ingestion", () => {
  it("plans insert, skip, and update for sourced review memory", async () => {
    const created = documentFromInsight();
    const changed = documentFromInsight({ summaryText: "리뷰가 더 늘었습니다." });
    if (!created || !changed) throw new Error("expected documents");
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
    expect(updateRun.updated[0]?.row.content).toContain("리뷰가 더 늘었습니다.");
    expect(updateRun.updated[0]?.row.embedding_model).toBe("BAAI/bge-m3");
    expect(updateRun.updated[0]?.row.embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("does not write or embed during dry-run", async () => {
    const created = documentFromInsight();
    if (!created) throw new Error("expected document");
    const fixtures = createStore();
    const mockProvider = provider();
    const result = await ingestMemoryDocuments({
      documents: [created],
      store: fixtures.store,
      provider: mockProvider,
      dryRun: true,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(result.inserted).toBe(0);
    expect(result.plannedInsert).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(result.results[0]?.reason).toBe("dry_run");
    expect(fixtures.inserted).toHaveLength(0);
    expect(mockProvider.embedMany).not.toHaveBeenCalled();
    expect(mockProvider.embed).not.toHaveBeenCalled();
  });
});

describe("review memory CLI", () => {
  it("requires product id and defaults to dry-run", () => {
    expect(() => parseProductMemoryCliArgs([])).toThrow("--product-id is required");
    expect(parseProductMemoryCliArgs(["--product-id", PRODUCT_ID])).toMatchObject({
      productId: PRODUCT_ID,
      apply: false,
      dryRun: true,
    });
  });
});
