import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { createDryRunMemoryStore } from "@/lib/marketing/memory/memoryStore";
import { MemoryIngestionError } from "@/lib/marketing/memory/errors";
import { parseProductMemoryCliArgs } from "@/lib/marketing/memory/productMemoryCli";
import { runProductMemoryIngestion } from "@/lib/marketing/memory/productMemoryIngestionRun";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import type {
  ExistingMemoryRow,
  MemoryDocument,
  MemoryInsertRow,
  MemoryStore,
  MemoryUpdateRow,
} from "@/lib/marketing/memory/types";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-08-25T00:00:00.000Z");
const ENV = { EMBEDDING_DIMENSION: "4" };

function document(overrides: Partial<MemoryDocument> = {}): MemoryDocument {
  return {
    memoryType: "product_knowledge",
    title: "다낭",
    content: "효도여행 추천",
    sourceType: "product",
    sourceId: PRODUCT_ID,
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
    async findSourcelessDuplicate() {
      return null;
    },
    async insert(row) {
      inserted.push(row);
      return { id: `mem-${inserted.length}` };
    },
    async update(id, row) {
      updated.push({ id, row });
    },
  };
  return { store, inserted, updated };
}

function provider() {
  return {
    model: "BAAI/bge-m3",
    embed: vi.fn(async () => [0.1, 0.2, 0.3, 0.4]),
    embedMany: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3, 0.4])),
  };
}

describe("dry-run memory store", () => {
  it("allows lookup but forbids insert and update", async () => {
    const inner = createStore([existingFrom(document())]);
    const store = createDryRunMemoryStore(inner.store);
    await expect(
      store.findBySource({
        memoryType: "product_knowledge",
        sourceType: "product",
        sourceId: PRODUCT_ID,
      }),
    ).resolves.toMatchObject({ id: "mem-existing" });
    await expect(store.insert({} as MemoryInsertRow)).rejects.toBeInstanceOf(MemoryIngestionError);
    await expect(store.update("mem-existing", {} as MemoryUpdateRow)).rejects.toBeInstanceOf(MemoryIngestionError);
    expect(inner.inserted).toHaveLength(0);
    expect(inner.updated).toHaveLength(0);
  });
});

describe("dry-run ingestion writes", () => {
  it("does not insert for a new document", async () => {
    const fixtures = createStore();
    const mockProvider = provider();
    const result = await ingestMemoryDocuments({
      documents: [document()],
      store: fixtures.store,
      provider: mockProvider,
      dryRun: true,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(result.dryRun).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.plannedInsert).toBe(1);
    expect(fixtures.inserted).toHaveLength(0);
    expect(mockProvider.embedMany).not.toHaveBeenCalled();
  });

  it("does not update a changed sourced document", async () => {
    const fixtures = createStore([existingFrom(document())]);
    const result = await ingestMemoryDocuments({
      documents: [document({ content: "허니문 추천" })],
      store: fixtures.store,
      provider: provider(),
      dryRun: true,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.plannedUpdate).toBe(1);
    expect(fixtures.updated).toHaveLength(0);
    expect(fixtures.inserted).toHaveLength(0);
  });

  it("does not write when unchanged", async () => {
    const fixtures = createStore([existingFrom(document())]);
    const result = await ingestMemoryDocuments({
      documents: [document()],
      store: fixtures.store,
      provider: provider(),
      dryRun: true,
      env: ENV,
      now: NOW,
      logger: { info() {} },
    });
    expect(result.plannedSkip).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(fixtures.inserted).toHaveLength(0);
    expect(fixtures.updated).toHaveLength(0);
  });
});

describe("CLI dry-run safety", () => {
  it("defaults to dry-run without --apply", () => {
    expect(parseProductMemoryCliArgs(["--product-id", PRODUCT_ID]).dryRun).toBe(true);
    expect(parseProductMemoryCliArgs(["--product-id", PRODUCT_ID]).apply).toBe(false);
  });

  it("forces dry-run for --preview even with --apply", () => {
    const args = parseProductMemoryCliArgs(["--product-id", PRODUCT_ID, "--preview", "--apply"]);
    expect(args.preview).toBe(true);
    expect(args.apply).toBe(false);
    expect(args.dryRun).toBe(true);
  });

  it("forces dry-run when --apply and --dry-run are both set", () => {
    const args = parseProductMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--dry-run"]);
    expect(args.apply).toBe(false);
    expect(args.dryRun).toBe(true);
  });
});

describe("runProductMemoryIngestion dry-run vs apply", () => {
  it("preview and default CLI do not write", async () => {
    const previewStore = createStore();
    const preview = await runProductMemoryIngestion({
      productId: PRODUCT_ID,
      apply: true,
      preview: true,
      store: previewStore.store,
      provider: provider(),
      env: ENV,
      log() {},
      loadDocuments: async () => [document()],
    });
    expect(preview.dryRun).toBe(true);
    expect(preview.ingested).toBe(false);
    expect(preview.result.inserted).toBe(0);
    expect(preview.result.plannedInsert).toBe(1);
    expect(previewStore.inserted).toHaveLength(0);

    const defaultStore = createStore();
    const args = parseProductMemoryCliArgs(["--product-id", PRODUCT_ID]);
    const def = await runProductMemoryIngestion({
      ...args,
      store: defaultStore.store,
      provider: provider(),
      env: ENV,
      log() {},
      loadDocuments: async () => [document()],
    });
    expect(def.dryRun).toBe(true);
    expect(defaultStore.inserted).toHaveLength(0);
  });

  it("apply inserts, apply+dry-run does not write", async () => {
    const applyStore = createStore();
    const applied = await runProductMemoryIngestion({
      productId: PRODUCT_ID,
      apply: true,
      store: applyStore.store,
      provider: provider(),
      env: {
        ...ENV,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1",
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
        EMBEDDING_PROVIDER: "http",
        EMBEDDING_BASE_URL: "http://embedding.test",
      },
      log() {},
      loadDocuments: async () => [document()],
    });
    expect(applied.dryRun).toBe(false);
    expect(applied.result.inserted).toBe(1);
    expect(applyStore.inserted).toHaveLength(1);

    const blocked = createStore();
    const args = parseProductMemoryCliArgs(["--product-id", PRODUCT_ID, "--apply", "--dry-run"]);
    const outcome = await runProductMemoryIngestion({
      ...args,
      store: blocked.store,
      provider: provider(),
      env: ENV,
      log() {},
      loadDocuments: async () => [document()],
    });
    expect(outcome.dryRun).toBe(true);
    expect(outcome.result.inserted).toBe(0);
    expect(blocked.inserted).toHaveLength(0);
  });
});
