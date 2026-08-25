import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublishedPublication } from "@/lib/marketing/context/mappers/publicationContextMapper";
import { mapHomeHeroRowToHistory } from "@/lib/marketing/context/mappers/siteContentHistoryMapper";
import type { ContentHistoryItem } from "@/lib/marketing/context/types";
import {
  CONTENT_MEMORY_AI_SOURCE_TYPE,
  CONTENT_MEMORY_CONFIDENCE,
  CONTENT_MEMORY_IMPORTANCE_DEFAULT,
  CONTENT_MEMORY_IMPORTANCE_OLD,
  CONTENT_MEMORY_IMPORTANCE_RECENT,
  CONTENT_MEMORY_MAX_BODY_CHARS,
  CONTENT_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { parseContentMemoryCliArgs } from "@/lib/marketing/memory/contentMemoryCli";
import {
  contentMemoryImportance,
  mapContentToMemoryDocument,
  stripHtmlToMemoryText,
  truncateMemoryText,
} from "@/lib/marketing/memory/contentMemoryContent";
import type { ContentMemoryMappingInput } from "@/lib/marketing/memory/contentMemoryContent";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import {
  ContentMemorySource,
  parseContentMemoryLoadParams,
} from "@/lib/marketing/memory/sources/contentMemorySource";
import type { ContentMemoryBundle } from "@/lib/marketing/memory/sources/contentMemorySource";
import type { ExistingMemoryRow, MemoryInsertRow, MemoryStore, MemoryUpdateRow } from "@/lib/marketing/memory/types";

const CONTENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CONTENT_ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-25T00:00:00.000Z");
const ENV = { EMBEDDING_DIMENSION: "4" };

function history(overrides: Partial<ContentHistoryItem> = {}): ContentHistoryItem {
  return {
    id: CONTENT_ID,
    sourceType: "ai_content",
    sourceId: CONTENT_ID,
    channel: null,
    productId: PRODUCT_ID,
    title: "효도여행 일정 안내",
    body: "바르셀로나 자유시간이 있는 10일 일정입니다.",
    summary: null,
    publishedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    metadata: { cta: "지금 문의하기", campaignId: null, agendaId: null },
    similarityAvailable: false,
    ...overrides,
  };
}

function mapping(overrides: Partial<ContentMemoryMappingInput> = {}): ContentMemoryMappingInput {
  return {
    history: history(),
    channels: ["instagram", "threads"],
    publishedAt: "2026-08-20T10:00:00.000Z",
    productTitle: "스페인 일주",
    campaignName: "가을 캠페인",
    agendaTopic: "효도여행",
    agendaKey: "filial-trip",
    hook: "부모님과 함께 떠나는 일정",
    cta: "지금 문의하기",
    ...overrides,
  };
}

function bundle(overrides: Partial<ContentMemoryBundle> = {}): ContentMemoryBundle {
  return {
    ...mapping(),
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

describe("content HTML cleaning", () => {
  it("strips script/style tags and decodes entities deterministically", () => {
    const cleaned = stripHtmlToMemoryText("<p>안녕</p><script>alert(1)</script><style>p{}</style>&nbsp;여행");
    expect(cleaned).toContain("안녕");
    expect(cleaned).toContain("여행");
    expect(cleaned).not.toContain("alert");
    expect(cleaned).not.toContain("<script");
    expect(stripHtmlToMemoryText("A&amp;B")).toBe("A&B");
    expect(stripHtmlToMemoryText("A<br/>B")).toBe("A\nB");
    expect(stripHtmlToMemoryText("<p>같은</p>")).toBe(stripHtmlToMemoryText("<p>같은</p>"));
  });
});

describe("content length policy", () => {
  it("truncates from the end and keeps one memory", () => {
    const body = `본문 ${"가".repeat(CONTENT_MEMORY_MAX_BODY_CHARS + 80)}`;
    const document = mapContentToMemoryDocument(mapping({ history: history({ body }) }), NOW);
    expect(document).not.toBeNull();
    expect(document?.content.length).toBeLessThanOrEqual(8000);
    expect(document?.content).toContain("제목: 효도여행 일정 안내");
    expect(truncateMemoryText("abcdef", 3)).toBe("abc");
  });
});

describe("content memory mapping", () => {
  it("maps AI title, body, channels, product, agenda, campaign, and published date", () => {
    const document = mapContentToMemoryDocument(mapping(), NOW);
    expect(document?.memoryType).toBe(CONTENT_MEMORY_TYPE);
    expect(document?.sourceType).toBe(CONTENT_MEMORY_AI_SOURCE_TYPE);
    expect(document?.sourceId).toBe(CONTENT_ID);
    expect(document?.confidence).toBe(CONTENT_MEMORY_CONFIDENCE);
    expect(document?.expiresAt).toBeNull();
    expect(document?.importance).toBe(CONTENT_MEMORY_IMPORTANCE_RECENT);
    expect(document?.content).toContain("제목: 효도여행 일정 안내");
    expect(document?.content).toContain("채널: instagram, threads");
    expect(document?.content).toContain("게시일: 2026-08-20");
    expect(document?.content).toContain("상품: 스페인 일주");
    expect(document?.content).toContain("주제: 효도여행");
    expect(document?.content).toContain("아젠다: filial-trip");
    expect(document?.content).toContain("캠페인: 가을 캠페인");
    expect(document?.content).toContain("본문:\n바르셀로나 자유시간이 있는 10일 일정입니다.");
    expect(document?.content).toContain("훅:\n부모님과 함께 떠나는 일정");
    expect(document?.content).toContain("CTA:\n지금 문의하기");
    expect(document?.content).not.toContain("https://");
    expect(document?.content).not.toContain("last_checked");
  });

  it("does not emit a document when title and body are empty", () => {
    expect(
      mapContentToMemoryDocument(
        mapping({
          history: history({ title: null, body: null, summary: null }),
          hook: null,
          cta: null,
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it("skips thread marketing posts that have no body", () => {
    expect(
      mapContentToMemoryDocument(
        mapping({
          history: history({
            sourceType: "thread_marketing_post",
            title: "키워드",
            body: null,
            summary: null,
          }),
          hook: null,
          cta: null,
        }),
        NOW,
      ),
    ).toBeNull();
  });

  it("keeps a legacy notice that has body text", () => {
    const document = mapContentToMemoryDocument(
      mapping({
        history: history({
          sourceType: "notice",
          sourceId: CONTENT_ID_B,
          id: CONTENT_ID_B,
          channel: "notice",
          title: "공지",
          body: "<p>일정 변경 &amp; 안내</p>",
          summary: null,
          productId: null,
        }),
        channels: ["notice"],
        productTitle: null,
        campaignName: null,
        agendaTopic: null,
        agendaKey: null,
        hook: null,
        cta: null,
      }),
      NOW,
    );
    expect(document?.sourceType).toBe("notice");
    expect(document?.sourceId).toBe(CONTENT_ID_B);
    expect(document?.content).toContain("본문:\n일정 변경 & 안내");
  });
});

describe("content importance", () => {
  it("uses simple recency buckets", () => {
    expect(contentMemoryImportance("2026-08-20", NOW)).toBe(CONTENT_MEMORY_IMPORTANCE_RECENT);
    expect(contentMemoryImportance("2026-01-01", NOW)).toBe(CONTENT_MEMORY_IMPORTANCE_OLD);
    expect(contentMemoryImportance(null, NOW)).toBe(CONTENT_MEMORY_IMPORTANCE_DEFAULT);
  });
});

describe("published publication helper", () => {
  it("treats published status or publishedAt as published", () => {
    expect(isPublishedPublication({ status: "published", publishedAt: null })).toBe(true);
    expect(isPublishedPublication({ status: "scheduled", publishedAt: "2026-08-20T00:00:00.000Z" })).toBe(true);
    expect(isPublishedPublication({ status: "scheduled", publishedAt: null })).toBe(false);
    expect(isPublishedPublication({ status: "deleted", publishedAt: "2026-08-20T00:00:00.000Z" })).toBe(false);
  });
});

describe("home hero mapping", () => {
  it("uses copy fields when title/body columns are missing", () => {
    const item = mapHomeHeroRowToHistory({
      id: CONTENT_ID,
      badge: "추천",
      main_copy_accent: "스페인",
      main_copy_tail: "일주",
      sub_description: "시즌 카피",
      created_at: "2026-08-01T00:00:00.000Z",
    });
    expect(item?.title).toBe("추천 스페인 일주");
    expect(item?.body).toBe("시즌 카피");
  });
});

describe("parseContentMemoryLoadParams", () => {
  it("requires contentId or productId and skips period for exact content ids", () => {
    expect(() => parseContentMemoryLoadParams({})).toThrow(MemoryValidationError);
    const parsed = parseContentMemoryLoadParams({ contentId: CONTENT_ID, now: NOW });
    expect(parsed.contentIds).toEqual([CONTENT_ID]);
    expect(parsed.applyPeriod).toBe(false);
    expect(parsed.limit).toBe(20);
  });

  it("applies lookback when productId is used", () => {
    const parsed = parseContentMemoryLoadParams({ productId: PRODUCT_ID, channel: "Threads", now: NOW });
    expect(parsed.productIds).toEqual([PRODUCT_ID]);
    expect(parsed.channel).toBe("threads");
    expect(parsed.applyPeriod).toBe(true);
    expect(parsed.lookbackDays).toBe(30);
  });
});

describe("ContentMemorySource", () => {
  it("loads one content_knowledge document per master even with multiple channels", async () => {
    const loadBundles = vi.fn(async () => [bundle()]);
    const source = new ContentMemorySource({ loadBundles });
    const documents = await source.load({ contentId: CONTENT_ID, now: NOW });
    expect(source.name).toBe("content");
    expect(documents).toHaveLength(1);
    expect(documents[0]?.sourceId).toBe(CONTENT_ID);
    expect(documents[0]?.content).toContain("채널: instagram, threads");
  });

  it("drops empty and thread bundles", async () => {
    const source = new ContentMemorySource({
      loadBundles: async () => [
        bundle({
          history: history({ title: null, body: null, summary: null }),
          hook: null,
          cta: null,
        }),
        bundle({
          history: history({
            id: CONTENT_ID_B,
            sourceId: CONTENT_ID_B,
            sourceType: "thread_marketing_post",
            title: "키워드",
            body: null,
          }),
          hook: null,
          cta: null,
        }),
      ],
    });
    expect(await source.load({ contentIds: [CONTENT_ID, CONTENT_ID_B], now: NOW })).toEqual([]);
  });
});

describe("content memory ingestion", () => {
  it("plans insert, skip, and update", async () => {
    const created = mapContentToMemoryDocument(mapping(), NOW);
    const changed = mapContentToMemoryDocument(
      mapping({ history: history({ body: "본문이 바뀌었습니다." }) }),
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
    expect(updateRun.updated[0]?.row.content).toContain("본문이 바뀌었습니다.");
  });

  it("does not write or embed during dry-run", async () => {
    const created = mapContentToMemoryDocument(mapping(), NOW);
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

describe("content memory CLI", () => {
  it("requires content or product id and keeps preview over apply", () => {
    expect(() => parseContentMemoryCliArgs([])).toThrow("--content-id or --product-id is required");
    expect(
      parseContentMemoryCliArgs(["--product-id", PRODUCT_ID, "--channel", "threads", "--lookback-days", "30"]),
    ).toMatchObject({
      productId: PRODUCT_ID,
      channel: "threads",
      lookbackDays: 30,
      apply: false,
      dryRun: true,
    });
    expect(parseContentMemoryCliArgs(["--content-id", CONTENT_ID, "--apply", "--preview"])).toMatchObject({
      contentId: CONTENT_ID,
      apply: false,
      preview: true,
      dryRun: true,
    });
  });
});
