import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  aggregateCustomerInsights,
  countInquiryQuestions,
  INQUIRY_INSIGHT_COLUMN_LIST,
  mapInquiryRowToInsight,
} from "@/lib/marketing/context/mappers/inquiryInsightMapper";
import type { InquiryInsightContext } from "@/lib/marketing/context/types";
import {
  CUSTOMER_INSIGHT_CONFIDENCE_HIGH,
  CUSTOMER_INSIGHT_CONFIDENCE_LOW,
  CUSTOMER_INSIGHT_CONFIDENCE_MID,
  CUSTOMER_INSIGHT_EXPIRES_DAYS,
  CUSTOMER_INSIGHT_IMPORTANCE_HIGH,
  CUSTOMER_INSIGHT_IMPORTANCE_LOW,
  CUSTOMER_INSIGHT_IMPORTANCE_MID,
  CUSTOMER_INSIGHT_MEMORY_TYPE,
  CUSTOMER_INSIGHT_SOURCE_TYPE,
} from "@/lib/marketing/memory/constants";
import { parseCustomerInsightMemoryCliArgs } from "@/lib/marketing/memory/customerInsightMemoryCli";
import {
  customerInsightConfidence,
  customerInsightExpiresAt,
  customerInsightImportance,
  customerInsightSourceId,
  mapCustomerInsightToMemoryDocument,
} from "@/lib/marketing/memory/customerInsightMemoryContent";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import {
  CustomerInsightMemorySource,
  parseCustomerInsightMemoryLoadParams,
} from "@/lib/marketing/memory/sources/customerInsightMemorySource";
import type { CustomerInsightMemoryBundle } from "@/lib/marketing/memory/sources/customerInsightMemorySource";
import type { ExistingMemoryRow, MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID_B = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-08-25T00:00:00.000Z");
const PERIOD = { start: "2026-07-26T00:00:00.000Z", end: "2026-08-25T00:00:00.000Z" };
const ENV = { EMBEDDING_DIMENSION: "4" };

function inquiry(overrides: Partial<InquiryInsightContext> = {}): InquiryInsightContext {
  return {
    content: "호텔 위치가 어디인가요?",
    productId: PRODUCT_ID,
    productTitle: "스페인 일주",
    acquisitionChannel: "organic",
    acquisitionSourceLabel: "네이버",
    acquisitionMedium: null,
    firstTouch: {
      firstLandingUrl: "https://example.com/?email=hong@example.com",
      utm_term: "010-9999-8888",
    },
    consultationStatus: "new",
    bookingStatus: "none",
    createdAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

function window30() {
  return {
    key: "30d",
    lookbackDays: 30,
    explicitRange: false,
    period: PERIOD,
  };
}

function insightFrom(inquiries: InquiryInsightContext[]) {
  return aggregateCustomerInsights({
    topic: "voice_of_customer",
    productId: PRODUCT_ID,
    period: PERIOD,
    inquiries,
  });
}

function documentFrom(inquiries: InquiryInsightContext[], title = "스페인 일주") {
  return mapCustomerInsightToMemoryDocument(
    {
      productId: PRODUCT_ID,
      productTitle: title,
      window: window30(),
      inquiries,
      insight: insightFrom(inquiries),
    },
    NOW,
  );
}

function bundle(overrides: Partial<CustomerInsightMemoryBundle> = {}): CustomerInsightMemoryBundle {
  return {
    productId: PRODUCT_ID,
    productTitle: "스페인 일주",
    inquiries: [inquiry(), inquiry(), inquiry({ content: "자유시간이 있나요?" })],
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

describe("inquiry PII projection", () => {
  it("does not select customer identifying columns", () => {
    expect(INQUIRY_INSIGHT_COLUMN_LIST).not.toEqual(expect.arrayContaining(["name", "phone", "email"]));
    expect(INQUIRY_INSIGHT_COLUMN_LIST).not.toContain("member_id");
    expect(INQUIRY_INSIGHT_COLUMN_LIST).not.toContain("address");
    expect(INQUIRY_INSIGHT_COLUMN_LIST).not.toContain("passport");
    const row = mapInquiryRowToInsight({
      content: "일정 문의",
      product_id: PRODUCT_ID,
      name: "홍길동",
      phone: "010-1111-2222",
      email: "leak@example.com",
    } as never);
    expect(row).not.toHaveProperty("name");
    expect(row).not.toHaveProperty("phone");
    expect(row).not.toHaveProperty("email");
  });
});

describe("inquiry aggregation", () => {
  it("counts duplicate questions in deterministic order", () => {
    const inquiries = [
      inquiry({ content: "자유시간이 있나요?" }),
      inquiry({ content: "호텔 위치가 어디인가요?" }),
      inquiry({ content: "호텔 위치가 어디인가요?" }),
      inquiry({ content: "호텔 위치가 어디인가요?" }),
      inquiry({ content: "자유시간이 있나요?" }),
    ];
    expect(countInquiryQuestions(inquiries)).toEqual([
      { label: "호텔 위치가 어디인가요?", count: 3 },
      { label: "자유시간이 있나요?", count: 2 },
    ]);
    expect(insightFrom(inquiries).inquiryCount).toBe(5);
    expect(insightFrom(inquiries).topQuestions[0]).toBe("호텔 위치가 어디인가요?");
  });

  it("counts consultation and booking statuses conservatively", () => {
    const inquiries = [
      inquiry({ consultationStatus: "new", bookingStatus: "none" }),
      inquiry({ consultationStatus: "new", bookingStatus: "none" }),
      inquiry({ consultationStatus: "contacted", bookingStatus: "reserved" }),
      inquiry({ consultationStatus: "closed", bookingStatus: "completed" }),
      inquiry({ consultationStatus: "on_hold", bookingStatus: "canceled", content: "취소하고 싶어요" }),
    ];
    const mapped = insightFrom(inquiries);
    expect(mapped.conversionSummary).toEqual({
      none: 2,
      reserved: 1,
      completed: 1,
      canceled: 1,
      other: 0,
    });
    expect(mapped.topConcerns).toEqual(["취소하고 싶어요"]);
  });
});

describe("customer insight memory mapping", () => {
  it("maps identity, period window, expiresAt, and section order", () => {
    const inquiries = [
      inquiry(),
      inquiry(),
      inquiry({ content: "자유시간이 있나요?", acquisitionSourceLabel: "카카오", consultationStatus: "contacted" }),
      inquiry({
        content: "취소하고 싶어요",
        bookingStatus: "canceled",
        consultationStatus: "closed",
        acquisitionSourceLabel: "네이버",
      }),
    ];
    const document = documentFrom(inquiries);
    expect(document?.memoryType).toBe(CUSTOMER_INSIGHT_MEMORY_TYPE);
    expect(document?.sourceType).toBe(CUSTOMER_INSIGHT_SOURCE_TYPE);
    expect(document?.sourceId).toBe(customerInsightSourceId(PRODUCT_ID, "30d"));
    expect(document?.title).toBe("스페인 일주 고객 문의 인사이트");
    expect(document?.expiresAt).toBe(customerInsightExpiresAt(NOW, CUSTOMER_INSIGHT_EXPIRES_DAYS));
    expect(document?.content).toContain("기간: 최근 30일");
    expect(document?.content).toContain("문의 수: 4");
    const content = document?.content ?? "";
    expect(content.indexOf("상품")).toBeLessThan(content.indexOf("기간"));
    expect(content.indexOf("기간")).toBeLessThan(content.indexOf("문의 수"));
    expect(content.indexOf("문의 수")).toBeLessThan(content.indexOf("주요 고객 질문"));
    expect(content.indexOf("주요 고객 질문")).toBeLessThan(content.indexOf("유입"));
    expect(content.indexOf("유입")).toBeLessThan(content.indexOf("상담 상태"));
    expect(content.indexOf("상담 상태")).toBeLessThan(content.indexOf("예약 전환"));
    expect(content).toContain("- 호텔 위치가 어디인가요? (2)");
    expect(content).toContain("- 네이버 (3)");
    expect(content).toContain("- new (2)");
    expect(content).toContain("- none (3)");
    expect(JSON.stringify(content)).not.toMatch(/\[object Object\]/);
  });

  it("does not dump raw inquiries, first_touch, or customer PII", () => {
    const document = documentFrom([
      inquiry({
        content: "부모님이 많이 걸어야 하나요? 연락은 010-1234-5678 또는 hong@example.com",
      }),
      inquiry(),
      inquiry(),
    ]);
    expect(document?.content).not.toContain("홍길동");
    expect(document?.content).not.toContain("hong@example.com");
    expect(document?.content).not.toContain("010-1234-5678");
    expect(document?.content).not.toContain("010-9999-8888");
    expect(document?.content).not.toContain("firstLandingUrl");
    expect(document?.content).not.toContain("example.com/?email");
    expect(document?.content).not.toMatch(/\[\s*\{/);
  });

  it("uses explicit date-range source identity instead of sliding 30d", () => {
    const inquiries = [inquiry(), inquiry(), inquiry()];
    const document = mapCustomerInsightToMemoryDocument(
      {
        productId: PRODUCT_ID,
        productTitle: "스페인 일주",
        window: {
          key: "2026-08-01_2026-08-31",
          lookbackDays: 30,
          explicitRange: true,
          period: { start: "2026-08-01T00:00:00.000Z", end: "2026-08-31T00:00:00.000Z" },
        },
        inquiries,
        insight: insightFrom(inquiries),
      },
      NOW,
    );
    expect(document?.sourceId).toBe(`${PRODUCT_ID}:2026-08-01_2026-08-31`);
    expect(document?.content).toContain("기간: 2026-08-01 ~ 2026-08-31");
    expect(document?.content).not.toContain("최근 30일");
  });
});

describe("customer insight confidence and importance", () => {
  it("uses simple inquiry-count buckets", () => {
    expect(customerInsightConfidence(1)).toBe(CUSTOMER_INSIGHT_CONFIDENCE_LOW);
    expect(customerInsightConfidence(2)).toBe(CUSTOMER_INSIGHT_CONFIDENCE_LOW);
    expect(customerInsightConfidence(3)).toBe(CUSTOMER_INSIGHT_CONFIDENCE_MID);
    expect(customerInsightConfidence(9)).toBe(CUSTOMER_INSIGHT_CONFIDENCE_MID);
    expect(customerInsightConfidence(10)).toBe(CUSTOMER_INSIGHT_CONFIDENCE_HIGH);
    expect(customerInsightImportance(1)).toBe(CUSTOMER_INSIGHT_IMPORTANCE_LOW);
    expect(customerInsightImportance(3)).toBe(CUSTOMER_INSIGHT_IMPORTANCE_MID);
    expect(customerInsightImportance(10)).toBe(CUSTOMER_INSIGHT_IMPORTANCE_HIGH);
  });
});

describe("parseCustomerInsightMemoryLoadParams", () => {
  it("requires productId and defaults to a 30d sliding window", () => {
    expect(() => parseCustomerInsightMemoryLoadParams({})).toThrow(MemoryValidationError);
    const parsed = parseCustomerInsightMemoryLoadParams({ productId: PRODUCT_ID, now: NOW });
    expect(parsed.ids).toEqual([PRODUCT_ID]);
    expect(parsed.minInquiryCount).toBe(3);
    expect(parsed.lookbackDays).toBe(30);
    expect(parsed.explicitRange).toBe(false);
    expect(parsed.windowKey).toBe("30d");
    expect(parsed.period.end).toBe(NOW.toISOString());
  });

  it("parses productIds, minInquiryCount, lookback, and explicit range", () => {
    const parsed = parseCustomerInsightMemoryLoadParams({
      productIds: [PRODUCT_ID, PRODUCT_ID_B],
      minInquiryCount: 1,
      lookbackDays: 14,
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-15T00:00:00.000Z",
      now: NOW,
    });
    expect(parsed.ids).toEqual([PRODUCT_ID, PRODUCT_ID_B]);
    expect(parsed.minInquiryCount).toBe(1);
    expect(parsed.explicitRange).toBe(true);
    expect(parsed.windowKey).toBe("2026-08-01_2026-08-15");
    expect(parsed.period).toEqual({
      start: "2026-08-01T00:00:00.000Z",
      end: "2026-08-15T00:00:00.000Z",
    });
  });
});

describe("CustomerInsightMemorySource", () => {
  it("loads one customer_insight document per product window", async () => {
    const loadBundles = vi.fn(async () => [bundle()]);
    const source = new CustomerInsightMemorySource({ loadBundles });
    const documents = await source.load({ productId: PRODUCT_ID, now: NOW, minInquiryCount: 3 });
    expect(source.name).toBe("customer_insight");
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(`${PRODUCT_ID}:30d`);
    expect(loadBundles).toHaveBeenCalledWith(
      expect.objectContaining({
        ids: [PRODUCT_ID],
        minInquiryCount: 3,
        windowKey: "30d",
      }),
    );
  });

  it("filters by productIds, minInquiryCount, and limit", async () => {
    const loadBundles = vi.fn(async () => [
      bundle({ productId: PRODUCT_ID, inquiries: [inquiry()] }),
      bundle({
        productId: PRODUCT_ID_B,
        productTitle: "포르투갈",
        inquiries: [
          inquiry({ productId: PRODUCT_ID_B }),
          inquiry({ productId: PRODUCT_ID_B }),
          inquiry({ productId: PRODUCT_ID_B }),
        ],
      }),
    ]);
    const source = new CustomerInsightMemorySource({ loadBundles });
    const documents = await source.load({
      productIds: [PRODUCT_ID, PRODUCT_ID_B],
      minInquiryCount: 3,
      limit: 2,
      now: NOW,
    });
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(`${PRODUCT_ID_B}:30d`);
  });

  it("returns no documents for zero inquiries or below minInquiryCount", async () => {
    const empty = new CustomerInsightMemorySource({
      loadBundles: async () => [bundle({ inquiries: [] })],
    });
    await expect(empty.load({ productId: PRODUCT_ID, minInquiryCount: 0, now: NOW })).resolves.toEqual([]);

    const low = new CustomerInsightMemorySource({
      loadBundles: async () => [bundle({ inquiries: [inquiry(), inquiry()] })],
    });
    await expect(low.load({ productId: PRODUCT_ID, minInquiryCount: 3, now: NOW })).resolves.toEqual([]);
  });
});

describe("customer insight memory ingestion", () => {
  it("plans insert, skip, and update for sourced customer insight memory", async () => {
    const created = documentFrom([inquiry(), inquiry(), inquiry()]);
    const changed = documentFrom([
      inquiry(),
      inquiry(),
      inquiry({ content: "부모님이 많이 걸어야 하나요?" }),
    ]);
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
    expect(updateRun.updated[0]?.row.content).toContain("부모님이 많이 걸어야 하나요?");
    expect(updateRun.updated[0]?.row.embedding_model).toBe("BAAI/bge-m3");
  });

  it("does not write or embed during dry-run", async () => {
    const created = documentFrom([inquiry(), inquiry(), inquiry()]);
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
    expect(fixtures.inserted).toHaveLength(0);
    expect(mockProvider.embedMany).not.toHaveBeenCalled();
    expect(mockProvider.embed).not.toHaveBeenCalled();
  });
});

describe("customer insight CLI", () => {
  it("requires product id, defaults to dry-run, and keeps preview/dry-run over apply", () => {
    expect(() => parseCustomerInsightMemoryCliArgs([])).toThrow("--product-id is required");
    expect(parseCustomerInsightMemoryCliArgs(["--product-id", PRODUCT_ID, "--lookback-days", "30"])).toEqual({
      productId: PRODUCT_ID,
      apply: false,
      preview: false,
      dryRun: true,
      lookbackDays: 30,
      minInquiryCount: undefined,
    });
    expect(
      parseCustomerInsightMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--preview"]),
    ).toMatchObject({ apply: false, preview: true, dryRun: true });
    expect(
      parseCustomerInsightMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--dry-run"]),
    ).toMatchObject({ apply: false, dryRun: true });
    expect(parseCustomerInsightMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply"])).toMatchObject({
      apply: true,
      dryRun: false,
    });
  });
});
