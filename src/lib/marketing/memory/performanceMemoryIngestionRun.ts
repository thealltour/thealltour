import "server-only";

import { createEmbeddingProvider } from "@/lib/marketing/semantic/embeddingProvider";
import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";
import { isVectorMemoryRepositoryConfigured } from "@/lib/marketing/semantic/vectorMemoryRepository";
import { MemoryIngestionError } from "@/lib/marketing/memory/errors";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import { createPerformanceMemorySource } from "@/lib/marketing/memory/sources/performanceMemorySource";
import type { MemoryDocument, MemoryIngestionResult, MemoryStore, MemoryWriteResult } from "@/lib/marketing/memory/types";

const PREVIEW_CHARS = 500;

export type RunPerformanceMemoryIngestionInput = {
  productId: string;
  apply: boolean;
  preview?: boolean;
  dryRun?: boolean;
  lookbackDays?: number;
  channel?: string;
  minEventCount?: number;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  log?: (line: string) => void;
  store?: MemoryStore | null;
  provider?: EmbeddingProvider | null;
  loadDocuments?: () => Promise<MemoryDocument[]>;
};

function resolveDryRun(input: RunPerformanceMemoryIngestionInput): boolean {
  if (input.preview === true) return true;
  if (input.dryRun === true) return true;
  return input.apply !== true;
}

function assertApplyReady(env: NodeJS.ProcessEnv | Record<string, string | undefined>): void {
  if (!isVectorMemoryRepositoryConfigured(env)) {
    throw new MemoryIngestionError("Supabase memory store is not configured");
  }
  const provider = createEmbeddingProvider(env);
  if (!provider || provider.model === "none") {
    throw new MemoryIngestionError("Embedding provider is not configured");
  }
}

function actionLabel(result: MemoryWriteResult | undefined): string {
  if (!result) return "unknown";
  if (result.status === "inserted") return "insert";
  if (result.status === "updated") return "update";
  if (result.status === "skipped") return "skip";
  return "fail";
}

function emptyResult(dryRun: boolean): MemoryIngestionResult {
  return {
    total: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    plannedInsert: 0,
    plannedUpdate: 0,
    plannedSkip: 0,
    dryRun,
    elapsedMs: 0,
    results: [],
  };
}

export async function runPerformanceMemoryIngestion(input: RunPerformanceMemoryIngestionInput): Promise<{
  dryRun: boolean;
  ingested: boolean;
  found: boolean;
  result: MemoryIngestionResult;
}> {
  const env = input.env ?? process.env;
  const log = input.log ?? console.log;
  const dryRun = resolveDryRun(input);
  if (!dryRun) assertApplyReady(env);

  const source = createPerformanceMemorySource();
  const documents = input.loadDocuments
    ? await input.loadDocuments()
    : await source.load({
        productId: input.productId,
        lookbackDays: input.lookbackDays,
        channel: input.channel,
        minEventCount: input.minEventCount,
        limit: 1,
      });

  if (documents.length === 0) {
    log("performance insight not found / insufficient events");
    log(`product id: ${input.productId}`);
    if (input.channel) log(`channel: ${input.channel}`);
    if (input.lookbackDays != null) log(`lookback days: ${input.lookbackDays}`);
    log(`dryRun: ${dryRun}`);
    return { dryRun, ingested: false, found: false, result: emptyResult(dryRun) };
  }

  const logger = { info() {} };
  const result = await ingestMemoryDocuments({
    documents,
    dryRun,
    sourceName: source.name,
    env,
    logger,
    store: input.store,
    provider: input.provider,
  });

  for (const document of documents) {
    const normalized = normalizeMemoryDocument(document);
    const write = result.results.find((item) => item.sourceId === document.sourceId);
    const meta = document.metadata ?? {};
    log(`product id: ${typeof meta.productId === "string" ? meta.productId : input.productId}`);
    log(`channel: ${typeof meta.channel === "string" ? meta.channel : input.channel ?? "all"}`);
    if (typeof meta.periodStart === "string" && typeof meta.periodEnd === "string") {
      log(`period: ${meta.periodStart} ~ ${meta.periodEnd}`);
    }
    if (typeof meta.publicationCount === "number") log(`publication count: ${meta.publicationCount}`);
    if (typeof meta.signalCount === "number") log(`event count: ${meta.signalCount}`);
    log(`memory type: ${document.memoryType}`);
    log(`source type: ${document.sourceType}`);
    log(`source id: ${document.sourceId}`);
    log(`title: ${document.title}`);
    log(`content length: ${document.content.length}`);
    if (!("skip" in normalized)) {
      log(`fingerprint: ${normalized.fingerprint.slice(0, 12)}`);
    }
    log(`planned action: ${actionLabel(write)}`);
    if (write?.reason) log(`reason: ${write.reason}`);
    if (input.preview) {
      log(`preview:\n${document.content.slice(0, PREVIEW_CHARS)}`);
    }
  }

  if (result.dryRun) {
    log(`plannedInsert: ${result.plannedInsert}`);
    log(`plannedUpdate: ${result.plannedUpdate}`);
    log(`plannedSkip: ${result.plannedSkip}`);
    log(`failed: ${result.failed}`);
    log(`inserted: 0`);
    log(`updated: 0`);
  } else {
    log(`inserted: ${result.inserted}`);
    log(`updated: ${result.updated}`);
    log(`skipped: ${result.skipped}`);
    log(`failed: ${result.failed}`);
  }
  log(`dryRun: ${result.dryRun}`);

  return {
    dryRun: result.dryRun,
    ingested: !result.dryRun && result.inserted + result.updated > 0,
    found: true,
    result,
  };
}
