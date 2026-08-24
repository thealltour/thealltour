import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SemanticProviderError } from "@/lib/marketing/semantic/errors";
import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";
import { MEMORY_INGEST_MAX_DOCUMENTS } from "@/lib/marketing/memory/constants";
import { decideMemoryWrite } from "@/lib/marketing/memory/dedupe";
import { ingestMemoryDocuments, ingestMemorySource } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import type {
  ExistingMemoryRow,
  MemoryDocument,
  MemoryIngestionLogger,
  MemoryInsertRow,
  MemoryStore,
  MemoryUpdateRow,
} from "@/lib/marketing/memory/types";

const MODEL = "BAAI/bge-m3";
const DIMENSION = 4;
const ENV = { EMBEDDING_DIMENSION: String(DIMENSION) };
const NOW = new Date("2026-08-25T00:00:00.000Z");
const SECRET_CONTENT = "sk-test-secret-should-not-appear-in-logs";

function vector(fill = 0.1): number[] {
  return Array.from({ length: DIMENSION }, () => fill);
}

function document(overrides: Partial<MemoryDocument> = {}): MemoryDocument {
  return {
    memoryType: "product_knowledge",
    title: "다낭",
    content: "효도여행 추천",
    sourceType: "products",
    sourceId: "prod-1",
    ...overrides,
  };
}

function existingFrom(doc: MemoryDocument, id = "mem-existing"): ExistingMemoryRow {
  const normalized = normalizeMemoryDocument(doc, NOW);
  if ("skip" in normalized) throw new Error("fixture expired");
  return {
    id,
    memoryType: normalized.memoryType,
    title: normalized.title,
    content: normalized.content,
    sourceType: normalized.sourceType,
    sourceId: normalized.sourceId,
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
    async findSourcelessDuplicate(input) {
      return (
        rows.find(
          (row) =>
            row.memoryType === input.memoryType &&
            row.sourceType == null &&
            row.sourceId == null &&
            row.content === input.content,
        ) ?? null
      );
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
      const current = rows.find((item) => item.id === id);
      if (current) {
        current.title = row.title;
        current.content = row.content;
      }
    },
  };
  return { store, inserted, updated, rows };
}

function createProvider(embedManyImpl?: EmbeddingProvider["embedMany"]): EmbeddingProvider & {
  embed: ReturnType<typeof vi.fn>;
  embedMany: ReturnType<typeof vi.fn>;
} {
  const embed = vi.fn(async () => vector());
  const embedMany = vi.fn(embedManyImpl ?? (async (texts: string[]) => texts.map(() => vector())));
  return { model: MODEL, embed, embedMany };
}

async function ingest(
  documents: MemoryDocument[],
  overrides: Partial<Parameters<typeof ingestMemoryDocuments>[0]> & { seed?: ExistingMemoryRow[] } = {},
) {
  const { seed, provider: providedProvider, store: providedStore, ...rest } = overrides;
  const fixtures = createStore(seed ?? []);
  const provider = providedProvider ?? createProvider();
  const result = await ingestMemoryDocuments({
    documents,
    env: ENV,
    now: NOW,
    logger: { info() {} },
    ...rest,
    store: providedStore ?? fixtures.store,
    provider,
  });
  return { result, provider, ...fixtures };
}

describe("decideMemoryWrite", () => {
  it("inserts new sourced memory, skips identical, and updates changed content", () => {
    const created = normalizeMemoryDocument(document(), NOW);
    const changed = normalizeMemoryDocument(document({ content: "허니문 추천" }), NOW);
    if ("skip" in created || "skip" in changed) throw new Error("unexpected skip");

    expect(decideMemoryWrite(created, null)).toEqual({ action: "insert" });
    expect(decideMemoryWrite(created, existingFrom(document()))).toEqual({
      action: "skip",
      reason: "unchanged",
      existingId: "mem-existing",
    });
    expect(decideMemoryWrite(changed, existingFrom(document()))).toEqual({
      action: "update",
      existingId: "mem-existing",
    });
  });

  it("never updates sourceless memory", () => {
    const sourceless = document({ sourceType: null, sourceId: null });
    const created = normalizeMemoryDocument(sourceless, NOW);
    if ("skip" in created) throw new Error("unexpected skip");
    expect(decideMemoryWrite(created, existingFrom(sourceless))).toEqual({
      action: "skip",
      reason: "duplicate",
      existingId: "mem-existing",
    });
    const changed = normalizeMemoryDocument({ ...sourceless, content: "다른 내용" }, NOW);
    if ("skip" in changed) throw new Error("unexpected skip");
    expect(decideMemoryWrite(changed, null)).toEqual({ action: "insert" });
  });
});

describe("ingestMemoryDocuments", () => {
  it("inserts new memory with provider model and embedMany", async () => {
    const { result, inserted, provider } = await ingest([document({ importance: undefined, confidence: 0.7 })]);
    expect(result).toMatchObject({ total: 1, inserted: 1, updated: 0, skipped: 0, failed: 0 });
    expect(inserted[0]?.embedding_model).toBe(MODEL);
    expect(inserted[0]?.embedding).toEqual(vector());
    expect(inserted[0]?.importance).toBeNull();
    expect(inserted[0]?.confidence).toBe(0.7);
    expect(inserted[0]).not.toHaveProperty("metadata");
    expect(provider.embedMany).toHaveBeenCalledTimes(1);
    expect(provider.embed).not.toHaveBeenCalled();
  });

  it("skips identical sourced memory", async () => {
    const seed = existingFrom(document());
    const { result, inserted, updated, provider } = await ingest([document()], { seed: [seed] });
    expect(result.skipped).toBe(1);
    expect(result.results[0]).toMatchObject({ status: "skipped", reason: "unchanged", memoryId: seed.id });
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
    expect(provider.embedMany).not.toHaveBeenCalled();
  });

  it("updates sourced memory when content changes", async () => {
    const seed = existingFrom(document());
    const { result, updated, inserted } = await ingest([document({ content: "허니문 추천" })], { seed: [seed] });
    expect(result.updated).toBe(1);
    expect(inserted).toHaveLength(0);
    expect(updated[0]?.id).toBe(seed.id);
    expect(updated[0]?.row.content).toBe("허니문 추천");
    expect(updated[0]?.row.embedding_model).toBe(MODEL);
  });

  it("does not write or embed in dryRun by default", async () => {
    const { result, inserted, updated, provider } = await ingest([document()], { dryRun: true });
    expect(result.inserted).toBe(1);
    expect(result.results[0]?.reason).toBe("dry_run");
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(0);
    expect(provider.embedMany).not.toHaveBeenCalled();
    expect(provider.embed).not.toHaveBeenCalled();
  });

  it("uses embedMany in batches and rejects non-finite or wrong-dimension vectors per document", async () => {
    const provider = createProvider(async (texts) =>
      texts.map((_, index) => {
        if (index === 0) return [Number.NaN, 0.1, 0.1, 0.1];
        if (index === 1) return [0.1, 0.1, 0.1];
        return vector();
      }),
    );
    const { result, inserted } = await ingest(
      [document({ sourceId: "a" }), document({ sourceId: "b" }), document({ sourceId: "c" })],
      { provider, batchSize: 50 },
    );
    expect(provider.embedMany).toHaveBeenCalledTimes(1);
    expect(provider.embedMany.mock.calls[0]?.[0]).toHaveLength(3);
    expect(result.failed).toBe(2);
    expect(result.inserted).toBe(1);
    expect(inserted).toHaveLength(1);
  });

  it("keeps successful writes when one document fails", async () => {
    const fixtures = createStore();
    fixtures.store.insert = async (row) => {
      if (row.source_id === "bad") throw new Error("supabase write failed");
      fixtures.inserted.push(row);
      return { id: `mem-${fixtures.inserted.length}` };
    };
    const { result } = await ingest(
      [document({ sourceId: "ok" }), document({ sourceId: "bad" }), document({ sourceId: "ok2" })],
      { store: fixtures.store },
    );
    expect(result.inserted).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results.find((item) => item.sourceId === "bad")?.reason).toBe("supabase write failed");
  });

  it("validates importance/confidence, skips expired memory, and rejects empty content", async () => {
    const { result } = await ingest([
      document({ sourceId: "score", importance: 1.4 }),
      document({ sourceId: "confidence", confidence: -0.1 }),
      document({ sourceId: "expired", expiresAt: "2020-01-01T00:00:00.000Z" }),
      document({ sourceId: "empty", content: "   " }),
    ]);
    expect(result.failed).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.results.map((item) => item.reason)).toEqual([
      "importance must be between 0 and 1",
      "confidence must be between 0 and 1",
      "expired",
      "content is required",
    ]);
  });

  it("does not log content, embeddings, or tokens", async () => {
    const logs: Array<{ message: string; meta?: Record<string, unknown> }> = [];
    const logger: MemoryIngestionLogger = {
      info(message, meta) {
        logs.push({ message, meta });
      },
    };
    await ingest([document({ content: SECRET_CONTENT, sourceId: "pii" })], { logger });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(SECRET_CONTENT);
    expect(serialized).not.toContain("0.1,0.1");
    expect(logs[0]?.meta).toMatchObject({
      source: "documents",
      total: 1,
      inserted: 1,
      updated: 0,
      skipped: 0,
      failed: 0,
    });
    expect(logs[0]?.meta).not.toHaveProperty("content");
    expect(logs[0]?.meta).not.toHaveProperty("embedding");
  });

  it("retries embedMany once, then records remaining batches as aborted after consecutive provider failures", async () => {
    const provider = createProvider(async () => {
      throw new SemanticProviderError("embedding http 503");
    });
    const { result } = await ingest(
      [document({ sourceId: "1" }), document({ sourceId: "2" }), document({ sourceId: "3" })],
      { provider, batchSize: 1 },
    );
    expect(provider.embedMany).toHaveBeenCalledTimes(4);
    expect(result.failed).toBe(3);
    expect(result.results[2]?.reason).toBe("aborted");
  });

  it("loads a generic source then runs the pipeline", async () => {
    const source = {
      name: "fixture-source",
      async load() {
        return [document({ sourceId: "from-source" })];
      },
    };
    const fixtures = createStore();
    const provider = createProvider();
    const result = await ingestMemorySource(
      source,
      {},
      {
        store: fixtures.store,
        provider,
        env: ENV,
        now: NOW,
        logger: { info() {} },
      },
    );
    expect(result.inserted).toBe(1);
    expect(fixtures.inserted[0]?.source_id).toBe("from-source");
  });

  it("rejects oversized input arrays", async () => {
    await expect(
      ingestMemoryDocuments({
        documents: Array.from({ length: MEMORY_INGEST_MAX_DOCUMENTS + 1 }, () => document()),
        dryRun: true,
        store: null,
        provider: createProvider(),
        env: ENV,
        logger: { info() {} },
      }),
    ).rejects.toThrow(`documents exceed MEMORY_INGEST_MAX_DOCUMENTS (${MEMORY_INGEST_MAX_DOCUMENTS})`);
  });
});
