import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  collapseLatestFeedbackRows,
  mergeMetricsWithoutDuplicate,
  sumFeedbackMetrics,
} from "@/lib/marketing/context/mappers/performanceMapper";
import type { AiFeedbackRow } from "@/lib/marketing/context/mappers/performanceMapper";
import {
  PERFORMANCE_MEMORY_CONFIDENCE_HIGH,
  PERFORMANCE_MEMORY_CONFIDENCE_LOW,
  PERFORMANCE_MEMORY_CONFIDENCE_MID,
  PERFORMANCE_MEMORY_EXPIRES_DAYS,
  PERFORMANCE_MEMORY_IMPORTANCE_HIGH,
  PERFORMANCE_MEMORY_IMPORTANCE_LOW,
  PERFORMANCE_MEMORY_IMPORTANCE_MID,
  PERFORMANCE_MEMORY_SOURCE_TYPE,
  PERFORMANCE_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { parsePerformanceMemoryCliArgs } from "@/lib/marketing/memory/performanceMemoryCli";
import {
  mapPerformanceToMemoryDocument,
  performanceMemoryConfidence,
  performanceMemoryExpiresAt,
  performanceMemoryImportance,
  performanceMemorySourceId,
} from "@/lib/marketing/memory/performanceMemoryContent";
import type { PerformanceMemoryMappingInput } from "@/lib/marketing/memory/performanceMemoryContent";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import {
  PerformanceMemorySource,
  parsePerformanceMemoryLoadParams,
} from "@/lib/marketing/memory/sources/performanceMemorySource";
import type { PerformanceMemoryBundle } from "@/lib/marketing/memory/sources/performanceMemorySource";
import type { ExistingMemoryRow, MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID_B = "22222222-2222-4222-8222-222222222222";
const PUB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PUB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CONTENT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const NOW = new Date("2026-08-25T00:00:00.000Z");
const PERIOD = { start: "2026-07-26T00:00:00.000Z", end: "2026-08-25T00:00:00.000Z" };
const ENV = { EMBEDDING_DIMENSION: "4" };

function window30() {
  return {
    key: "30d",
    lookbackDays: 30,
    explicitRange: false,
    period: PERIOD,
  };
}

function feedback(overrides: AiFeedbackRow = {}): AiFeedbackRow {
  return {
    publication_id: PUB_A,
    channel: "threads",
    metric_type: "views",
    metric_value: 100,
    measured_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function mapping(overrides: Partial<PerformanceMemoryMappingInput> = {}): PerformanceMemoryMappingInput {
  return {
    productId: PRODUCT_ID,
    productTitle: "스페인 일주",
    channel: "threads",
    window: window30(),
    publicationCount: 8,
    threadPostCount: 0,
    inquiryCount: 11,
    bookingCount: 2,
    analyticsEventCount: 50,
    feedback: [
      feedback({ metric_type: "views", metric_value: 34200 }),
      feedback({ metric_type: "likes", metric_value: 410 }),
      feedback({ metric_type: "comments", metric_value: 62 }),
      feedback({ metric_type: "shares", metric_value: 24 }),
      feedback({ metric_type: "clicks", metric_value: 177 }),
    ],
    publicationContentIds: { [PUB_A]: CONTENT_A },
    contentTitles: { [CONTENT_A]: "효도여행 일정 안내" },
    ...overrides,
  };
}

function bundle(overrides: Partial<PerformanceMemoryBundle> = {}): PerformanceMemoryBundle {
  const mapped = mapping();
  return {
    productId: mapped.productId,
    productTitle: mapped.productTitle ?? null,
    channel: mapped.channel,
    publicationCount: mapped.publicationCount,
    threadPostCount: mapped.threadPostCount,
    inquiryCount: mapped.inquiryCount,
    bookingCount: mapped.bookingCount,
    analyticsEventCount: mapped.analyticsEventCount,
    feedback: mapped.feedback,
    publicationContentIds: mapped.publicationContentIds,
    contentTitles: mapped.contentTitles,
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

describe("performance metric aggregation", () => {
  it("keeps the latest snapshot per publication metric instead of summing time series", () => {
    const rows = [
      feedback({ metric_value: 10, measured_at: "2026-08-01T00:00:00.000Z" }),
      feedback({ metric_value: 40, measured_at: "2026-08-20T00:00:00.000Z" }),
      feedback({ publication_id: PUB_B, metric_value: 5, measured_at: "2026-08-21T00:00:00.000Z" }),
    ];
    expect(collapseLatestFeedbackRows(rows)).toHaveLength(2);
    expect(sumFeedbackMetrics(rows).find((item) => item.metricType === "views")?.value).toBe(45);
  });

  it("does not sum ratio metrics like ctr", () => {
    const totals = sumFeedbackMetrics([
      feedback({ metric_type: "ctr", metric_value: 0.1 }),
      feedback({ publication_id: PUB_B, metric_type: "ctr", metric_value: 0.2 }),
    ]);
    expect(totals.find((item) => item.metricType === "ctr")).toBeUndefined();
  });

  it("does not merge inquiry_count when feedback already has inquiries", () => {
    const merged = mergeMetricsWithoutDuplicate(
      [{ metricType: "inquiries", value: 5, change: null, measuredAt: null }],
      [{ metricType: "inquiry_count", value: 11, change: null, measuredAt: null }],
    );
    expect(merged).toEqual([{ metricType: "inquiries", value: 5, change: null, measuredAt: null }]);
  });
});

describe("performance memory mapping", () => {
  it("maps identity, channel window, metrics, averages, and expiresAt", () => {
    const document = mapPerformanceToMemoryDocument(mapping(), NOW);
    expect(document?.memoryType).toBe(PERFORMANCE_MEMORY_TYPE);
    expect(document?.sourceType).toBe(PERFORMANCE_MEMORY_SOURCE_TYPE);
    expect(document?.sourceId).toBe(performanceMemorySourceId(PRODUCT_ID, "threads", "30d"));
    expect(document?.expiresAt).toBe(performanceMemoryExpiresAt(NOW, PERFORMANCE_MEMORY_EXPIRES_DAYS));
    expect(document?.content).toContain("채널: threads");
    expect(document?.content).toContain("기간: 최근 30일");
    expect(document?.content).toContain("게시 수: 8");
    expect(document?.content).toContain("- 조회: 34,200");
    expect(document?.content).toContain("- 문의: 11");
    expect(document?.content).toContain("- 예약: 2");
    expect(document?.content).toContain("- 게시물당 조회: 4,275");
    expect(document?.content).toContain("- 효도여행 일정 안내");
    expect(document?.content).not.toContain("효도여행 콘텐츠가 잘 먹힌다");
    expect(document?.content).not.toContain("사이트 이벤트");
    expect(document?.content).not.toMatch(/\d{2,3}-\d{3,4}-\d{4}/);
    expect(JSON.stringify(document?.content)).not.toMatch(/\[object Object\]/);
  });

  it("uses thread fallback publication count and analytics only when feedback is empty", () => {
    const document = mapPerformanceToMemoryDocument(
      mapping({
        publicationCount: 0,
        threadPostCount: 4,
        feedback: [],
        inquiryCount: 0,
        bookingCount: 0,
        analyticsEventCount: 20,
      }),
      NOW,
    );
    expect(document?.content).toContain("게시 수: 4");
    expect(document?.content).toContain("- 사이트 이벤트: 20");
    expect(document?.content).not.toContain("조회");
  });

  it("does not double-count inquiries from feedback and the inquiries table", () => {
    const document = mapPerformanceToMemoryDocument(
      mapping({
        inquiryCount: 11,
        feedback: [feedback({ metric_type: "inquiries", metric_value: 5 })],
      }),
      NOW,
    );
    expect(document?.content).toContain("- 문의: 5");
    expect(document?.content).not.toContain("- 문의: 11");
  });

  it("omits a document when there is no performance signal", () => {
    expect(
      mapPerformanceToMemoryDocument(
        mapping({
          publicationCount: 0,
          threadPostCount: 0,
          inquiryCount: 0,
          bookingCount: 0,
          analyticsEventCount: 0,
          feedback: [],
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it("uses all channel key when channel is omitted", () => {
    const document = mapPerformanceToMemoryDocument(mapping({ channel: null }), NOW);
    expect(document?.sourceId).toBe(`${PRODUCT_ID}:all:30d`);
    expect(document?.content).toContain("채널: 전체");
  });
});

describe("performance memory confidence and importance", () => {
  it("uses publication/signal count buckets", () => {
    expect(performanceMemoryConfidence(1)).toBe(PERFORMANCE_MEMORY_CONFIDENCE_LOW);
    expect(performanceMemoryConfidence(4)).toBe(PERFORMANCE_MEMORY_CONFIDENCE_LOW);
    expect(performanceMemoryConfidence(5)).toBe(PERFORMANCE_MEMORY_CONFIDENCE_MID);
    expect(performanceMemoryConfidence(19)).toBe(PERFORMANCE_MEMORY_CONFIDENCE_MID);
    expect(performanceMemoryConfidence(20)).toBe(PERFORMANCE_MEMORY_CONFIDENCE_HIGH);
    expect(performanceMemoryImportance(1)).toBe(PERFORMANCE_MEMORY_IMPORTANCE_LOW);
    expect(performanceMemoryImportance(5)).toBe(PERFORMANCE_MEMORY_IMPORTANCE_MID);
    expect(performanceMemoryImportance(20)).toBe(PERFORMANCE_MEMORY_IMPORTANCE_HIGH);
  });
});

describe("parsePerformanceMemoryLoadParams", () => {
  it("requires productId and defaults to a 30d aggregate window", () => {
    expect(() => parsePerformanceMemoryLoadParams({})).toThrow(MemoryValidationError);
    const parsed = parsePerformanceMemoryLoadParams({ productId: PRODUCT_ID, now: NOW });
    expect(parsed.ids).toEqual([PRODUCT_ID]);
    expect(parsed.channel).toBeNull();
    expect(parsed.windowKey).toBe("30d");
    expect(parsed.minEventCount).toBe(1);
  });

  it("parses channel, productIds, and explicit range", () => {
    const parsed = parsePerformanceMemoryLoadParams({
      productIds: [PRODUCT_ID, PRODUCT_ID_B],
      channel: "Threads",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T00:00:00.000Z",
      now: NOW,
    });
    expect(parsed.channel).toBe("threads");
    expect(parsed.windowKey).toBe("2026-08-01_2026-08-31");
    expect(parsed.explicitRange).toBe(true);
  });
});

describe("PerformanceMemorySource", () => {
  it("loads one performance_insight document per product/channel/window", async () => {
    const loadBundles = vi.fn(async () => [bundle()]);
    const source = new PerformanceMemorySource({ loadBundles });
    const documents = await source.load({
      productId: PRODUCT_ID,
      channel: "threads",
      now: NOW,
    });
    expect(source.name).toBe("performance");
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(`${PRODUCT_ID}:threads:30d`);
  });

  it("skips products below minEventCount and zero-signal bundles", async () => {
    const source = new PerformanceMemorySource({
      loadBundles: async () => [
        bundle({
          productId: PRODUCT_ID,
          publicationCount: 0,
          threadPostCount: 0,
          inquiryCount: 0,
          bookingCount: 0,
          analyticsEventCount: 0,
          feedback: [],
        }),
        bundle({ productId: PRODUCT_ID_B, publicationCount: 8 }),
      ],
    });
    const documents = await source.load({
      productIds: [PRODUCT_ID, PRODUCT_ID_B],
      channel: "threads",
      now: NOW,
    });
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(`${PRODUCT_ID_B}:threads:30d`);
  });

  it("does not emit a document when signalCount is below minEventCount", async () => {
    const source = new PerformanceMemorySource({
      loadBundles: async () => [bundle({ publicationCount: 3 })],
    });
    const documents = await source.load({
      productId: PRODUCT_ID,
      channel: "threads",
      minEventCount: 5,
      now: NOW,
    });
    expect(documents).toHaveLength(0);
  });
});

describe("performance memory ingestion", () => {
  it("plans insert, skip, and update", async () => {
    const created = mapPerformanceToMemoryDocument(mapping(), NOW);
    const changed = mapPerformanceToMemoryDocument(
      mapping({
        feedback: [feedback({ metric_type: "views", metric_value: 50000 })],
      }),
      NOW,
    );
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
    const inserted = await ingestMemoryDocuments({
      documents: [created],
      store: insertRun.store,
      provider: provider(),
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(inserted.inserted).toBe(1);

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
    expect(updateRun.updated[0]?.row.content).toContain("50,000");
    expect(updateRun.updated[0]?.row.embedding_model).toBe("BAAI/bge-m3");
  });

  it("does not write or embed during dry-run", async () => {
    const created = mapPerformanceToMemoryDocument(mapping(), NOW);
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
    expect(fixtures.inserted).toHaveLength(0);
    expect(mockProvider.embedMany).not.toHaveBeenCalled();
  });
});

describe("performance memory CLI", () => {
  it("requires product id and keeps preview/dry-run over apply", () => {
    expect(() => parsePerformanceMemoryCliArgs([])).toThrow("--product-id is required");
    expect(
      parsePerformanceMemoryCliArgs([
        "--product-id",
        PRODUCT_ID,
        "--channel",
        "threads",
        "--lookback-days",
        "30",
      ]),
    ).toMatchObject({
      productId: PRODUCT_ID,
      channel: "threads",
      lookbackDays: 30,
      apply: false,
      dryRun: true,
    });
    expect(
      parsePerformanceMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--preview"]),
    ).toMatchObject({ apply: false, preview: true, dryRun: true });
  });
});
