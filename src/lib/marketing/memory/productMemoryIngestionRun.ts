import "server-only";

import { createEmbeddingProvider } from "@/lib/marketing/semantic/embeddingProvider";
import { isVectorMemoryRepositoryConfigured } from "@/lib/marketing/semantic/vectorMemoryRepository";
import { MemoryIngestionError } from "@/lib/marketing/memory/errors";
import { ingestMemoryDocuments } from "@/lib/marketing/memory/memoryIngestionService";
import { normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import { createProductMemorySource } from "@/lib/marketing/memory/sources/productMemorySource";
import type { MemoryWriteResult } from "@/lib/marketing/memory/types";

const PREVIEW_CHARS = 500;

export type RunProductMemoryIngestionInput = {
  productId: string;
  apply: boolean;
  preview?: boolean;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  log?: (line: string) => void;
};

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

export async function runProductMemoryIngestion(input: RunProductMemoryIngestionInput): Promise<{
  dryRun: boolean;
  ingested: boolean;
  result: Awaited<ReturnType<typeof ingestMemoryDocuments>>;
}> {
  const env = input.env ?? process.env;
  const log = input.log ?? console.log;
  const dryRun = input.apply !== true;
  if (!dryRun) assertApplyReady(env);

  const source = createProductMemorySource();
  const documents = await source.load({ productId: input.productId, limit: 1 });
  if (documents.length === 0) {
    throw new MemoryIngestionError("product not found");
  }

  const logger = { info() {} };
  const result = await ingestMemoryDocuments({
    documents,
    dryRun,
    sourceName: source.name,
    env,
    logger,
  });

  for (const document of documents) {
    const normalized = normalizeMemoryDocument(document);
    const write = result.results.find((item) => item.sourceId === document.sourceId);
    log(`product id: ${document.sourceId}`);
    log(`memory type: ${document.memoryType}`);
    log(`source type: ${document.sourceType}`);
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

  log(`inserted: ${result.inserted}`);
  log(`updated: ${result.updated}`);
  log(`skipped: ${result.skipped}`);
  log(`failed: ${result.failed}`);
  log(`dryRun: ${dryRun}`);

  return { dryRun, ingested: !dryRun, result };
}
