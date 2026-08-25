import "server-only";

import { DEFAULT_EMBEDDING_DIMENSION, EMBEDDING_DIMENSION_ENV } from "@/lib/marketing/semantic/embeddingConfig";
import { createEmbeddingProvider } from "@/lib/marketing/semantic/embeddingProvider";
import { SemanticNotConfiguredError, SemanticProviderError } from "@/lib/marketing/semantic/errors";
import { assertQueryEmbedding } from "@/lib/marketing/semantic/pgVector";
import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";
import { isVectorMemoryRepositoryConfigured } from "@/lib/marketing/semantic/vectorMemoryRepository";
import {
  MEMORY_EMBED_BATCH_SIZE,
  MEMORY_INGEST_BATCH_SIZE,
  MEMORY_INGEST_MAX_DOCUMENTS,
  MEMORY_PROVIDER_ABORT_AFTER,
} from "@/lib/marketing/memory/constants";
import { decideMemoryWrite } from "@/lib/marketing/memory/dedupe";
import { MemoryIngestionError, MemoryValidationError } from "@/lib/marketing/memory/errors";
import { MemoryWriter } from "@/lib/marketing/memory/memoryWriter";
import { createDryRunMemoryStore, createSupabaseMemoryStore } from "@/lib/marketing/memory/memoryStore";
import { hasStableSource, normalizeMemoryDocument } from "@/lib/marketing/memory/normalization";
import type {
  ExistingMemoryRow,
  IngestMemoryDocumentsOptions,
  MemoryIngestionLogger,
  MemoryIngestionResult,
  MemoryIngestionSource,
  MemoryStore,
  MemoryWriteResult,
  NormalizedMemoryDocument,
} from "@/lib/marketing/memory/types";

type PlannedDocument = {
  document: NormalizedMemoryDocument;
  decision: ReturnType<typeof decideMemoryWrite>;
};

const defaultLogger: MemoryIngestionLogger = {
  info(message, meta) {
    console.info(message, meta);
  },
};

function tally(total: number, elapsedMs: number, results: MemoryWriteResult[], dryRun: boolean): MemoryIngestionResult {
  const plannedInsert = results.filter((item) => item.status === "inserted").length;
  const plannedUpdate = results.filter((item) => item.status === "updated").length;
  const plannedSkip = results.filter((item) => item.status === "skipped").length;
  const failed = results.filter((item) => item.status === "failed").length;
  return {
    total,
    inserted: dryRun ? 0 : plannedInsert,
    updated: dryRun ? 0 : plannedUpdate,
    skipped: plannedSkip,
    failed,
    plannedInsert: dryRun ? plannedInsert : 0,
    plannedUpdate: dryRun ? plannedUpdate : 0,
    plannedSkip: dryRun ? plannedSkip : 0,
    dryRun,
    elapsedMs,
    results,
  };
}

function writeResult(
  document: NormalizedMemoryDocument,
  status: MemoryWriteResult["status"],
  extra: Partial<MemoryWriteResult> = {},
): MemoryWriteResult {
  return {
    status,
    sourceType: document.sourceType,
    sourceId: document.sourceId,
    ...extra,
  };
}

function stableSourceKey(document: NormalizedMemoryDocument): string | null {
  if (!hasStableSource(document) || !document.sourceType || !document.sourceId) return null;
  return `${document.memoryType}\0${document.sourceType}\0${document.sourceId}`;
}

function resolveEmbeddingDimension(env: NodeJS.ProcessEnv | Record<string, string | undefined>): number {
  const raw = env[EMBEDDING_DIMENSION_ENV]?.trim();
  if (!raw) return DEFAULT_EMBEDDING_DIMENSION;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new MemoryValidationError(`${EMBEDDING_DIMENSION_ENV} must be a positive integer`);
  }
  return value;
}

async function lookupExisting(writer: MemoryWriter, document: NormalizedMemoryDocument): Promise<ExistingMemoryRow | null> {
  if (hasStableSource(document) && document.sourceType && document.sourceId) {
    return writer.findBySource({
      memoryType: document.memoryType,
      sourceType: document.sourceType,
      sourceId: document.sourceId,
    });
  }
  return writer.findSourcelessDuplicate({
    memoryType: document.memoryType,
    content: document.content,
  });
}

async function embedManyWithRetry(provider: EmbeddingProvider, texts: string[]): Promise<number[][]> {
  try {
    return await provider.embedMany(texts);
  } catch (error) {
    if (error instanceof SemanticNotConfiguredError) throw error;
    try {
      return await provider.embedMany(texts);
    } catch {
      throw error;
    }
  }
}

function resolveStore(options: IngestMemoryDocumentsOptions): MemoryStore | null {
  if (options.store === null) return null;
  if (options.store) return options.store;
  const env = options.env ?? process.env;
  if (!isVectorMemoryRepositoryConfigured(env)) return null;
  return createSupabaseMemoryStore();
}

function recordSkipResults(planned: PlannedDocument[], results: MemoryWriteResult[]): void {
  for (const item of planned) {
    if (item.decision.action !== "skip") continue;
    results.push(
      writeResult(item.document, "skipped", {
        memoryId: item.decision.existingId,
        reason: item.decision.reason,
      }),
    );
  }
}

export async function ingestMemoryDocuments(
  options: IngestMemoryDocumentsOptions,
): Promise<MemoryIngestionResult> {
  const started = Date.now();
  const logger = options.logger ?? defaultLogger;
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const embedInDryRun = options.embedInDryRun === true;
  const needsEmbed = !dryRun || embedInDryRun;
  const batchSize = Math.min(Math.max(options.batchSize ?? MEMORY_INGEST_BATCH_SIZE, 1), MEMORY_EMBED_BATCH_SIZE);
  const env = options.env ?? process.env;
  const dimension = resolveEmbeddingDimension(env);

  if (options.documents.length > MEMORY_INGEST_MAX_DOCUMENTS) {
    throw new MemoryValidationError(`documents exceed MEMORY_INGEST_MAX_DOCUMENTS (${MEMORY_INGEST_MAX_DOCUMENTS})`);
  }

  const resolved = resolveStore(options);
  if (!resolved && !dryRun) {
    throw new MemoryIngestionError("Supabase memory store is not configured");
  }
  const store = dryRun && resolved ? createDryRunMemoryStore(resolved) : resolved;
  const writer = store ? new MemoryWriter(store) : null;
  const provider =
    options.provider !== undefined
      ? options.provider
      : needsEmbed
        ? createEmbeddingProvider(env)
        : null;
  if (needsEmbed && (!provider || provider.model === "none")) {
    throw new MemoryIngestionError("Embedding provider is not configured");
  }

  const results: MemoryWriteResult[] = [];
  let providerFailures = 0;
  let aborted = false;

  for (let offset = 0; offset < options.documents.length; offset += batchSize) {
    const slice = options.documents.slice(offset, offset + batchSize);
    if (aborted) {
      for (const document of slice) {
        results.push({
          status: "failed",
          sourceType: document.sourceType,
          sourceId: document.sourceId,
          reason: "aborted",
        });
      }
      continue;
    }

    const planned: PlannedDocument[] = [];
    const seenFingerprints = new Set<string>();
    const seenSourceKeys = new Set<string>();

    for (const raw of slice) {
      try {
        const normalized = normalizeMemoryDocument(raw, now);
        if ("skip" in normalized) {
          results.push({
            status: "skipped",
            sourceType: raw.sourceType,
            sourceId: raw.sourceId,
            reason: "expired",
          });
          continue;
        }
        if (seenFingerprints.has(normalized.fingerprint)) {
          results.push(writeResult(normalized, "skipped", { reason: "duplicate_in_batch" }));
          continue;
        }
        const sourceKey = stableSourceKey(normalized);
        if (sourceKey && seenSourceKeys.has(sourceKey)) {
          results.push(writeResult(normalized, "skipped", { reason: "duplicate_in_batch" }));
          continue;
        }
        seenFingerprints.add(normalized.fingerprint);
        if (sourceKey) seenSourceKeys.add(sourceKey);
        const existing = writer ? await lookupExisting(writer, normalized) : null;
        planned.push({ document: normalized, decision: decideMemoryWrite(normalized, existing) });
      } catch (error) {
        results.push({
          status: "failed",
          sourceType: raw.sourceType,
          sourceId: raw.sourceId,
          reason: error instanceof Error ? error.message : "normalize_failed",
        });
      }
    }

    const toEmbed = planned.filter((item) => item.decision.action === "insert" || item.decision.action === "update");
    const embeddings = new Map<NormalizedMemoryDocument, number[]>();
    const embedFailures = new Map<NormalizedMemoryDocument, string>();

    if (toEmbed.length > 0 && needsEmbed && provider) {
      try {
        const vectors = await embedManyWithRetry(
          provider,
          toEmbed.map((item) => item.document.embeddingText),
        );
        if (vectors.length !== toEmbed.length) {
          throw new MemoryIngestionError("embedMany result count mismatch");
        }
        toEmbed.forEach((item, index) => {
          try {
            embeddings.set(item.document, assertQueryEmbedding(vectors[index], dimension));
          } catch (error) {
            embedFailures.set(item.document, error instanceof Error ? error.message : "invalid_embedding");
          }
        });
        providerFailures = 0;
      } catch (error) {
        providerFailures += 1;
        const reason = error instanceof SemanticProviderError || error instanceof Error ? error.message : "embed_failed";
        recordSkipResults(planned, results);
        for (const item of toEmbed) {
          results.push(writeResult(item.document, "failed", { reason }));
        }
        if (providerFailures >= MEMORY_PROVIDER_ABORT_AFTER) aborted = true;
        continue;
      }
    }

    for (const item of planned) {
      if (item.decision.action === "skip") {
        results.push(
          writeResult(item.document, "skipped", {
            memoryId: item.decision.existingId,
            reason: item.decision.reason,
          }),
        );
        continue;
      }
      if (dryRun && !embedInDryRun) {
        results.push(
          writeResult(item.document, item.decision.action === "update" ? "updated" : "inserted", {
            memoryId: item.decision.action === "update" ? item.decision.existingId : undefined,
            reason: "dry_run",
          }),
        );
        continue;
      }
      const embedError = embedFailures.get(item.document);
      if (embedError) {
        results.push(writeResult(item.document, "failed", { reason: embedError }));
        continue;
      }
      const embedding = embeddings.get(item.document);
      if (!embedding) {
        results.push(writeResult(item.document, "failed", { reason: "embedding_missing" }));
        continue;
      }
      if (dryRun) {
        results.push(
          writeResult(item.document, item.decision.action === "update" ? "updated" : "inserted", {
            memoryId: item.decision.action === "update" ? item.decision.existingId : undefined,
            reason: "dry_run",
          }),
        );
        continue;
      }
      if (!writer || !provider) {
        results.push(writeResult(item.document, "failed", { reason: "store_missing" }));
        continue;
      }
      try {
        if (item.decision.action === "insert") {
          const inserted = await writer.insert({
            memory_type: item.document.memoryType,
            title: item.document.title,
            content: item.document.content,
            source_type: item.document.sourceType,
            source_id: item.document.sourceId,
            importance: item.document.importance,
            confidence: item.document.confidence,
            embedding_model: provider.model,
            embedding,
            expires_at: item.document.expiresAt,
          });
          results.push(writeResult(item.document, "inserted", { memoryId: inserted.id }));
        } else {
          await writer.update(item.decision.existingId, {
            title: item.document.title,
            content: item.document.content,
            importance: item.document.importance,
            confidence: item.document.confidence,
            embedding_model: provider.model,
            embedding,
            expires_at: item.document.expiresAt,
            updated_at: now.toISOString(),
          });
          results.push(writeResult(item.document, "updated", { memoryId: item.decision.existingId }));
        }
      } catch (error) {
        results.push(
          writeResult(item.document, "failed", {
            reason: error instanceof Error ? error.message : "write_failed",
          }),
        );
      }
    }
  }

  const result = tally(options.documents.length, Date.now() - started, results, dryRun);
  logger.info("memory_ingestion", {
    source: options.sourceName ?? "documents",
    total: result.total,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    failed: result.failed,
    plannedInsert: result.plannedInsert,
    plannedUpdate: result.plannedUpdate,
    plannedSkip: result.plannedSkip,
    elapsedMs: result.elapsedMs,
    dryRun: result.dryRun,
  });
  return result;
}

export async function ingestMemorySource<P>(
  source: MemoryIngestionSource<P>,
  params: P,
  options: Omit<IngestMemoryDocumentsOptions, "documents" | "sourceName"> & { sourceName?: string } = {},
): Promise<MemoryIngestionResult> {
  const documents = await source.load(params);
  return ingestMemoryDocuments({
    ...options,
    documents,
    sourceName: options.sourceName ?? source.name,
  });
}
