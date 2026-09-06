import { randomUUID } from "node:crypto";

import { MARKETING_SEMANTIC_DEFAULT_DIMENSION } from "@/lib/marketing/semantic/entityEmbeddings/constants";
import type {
  GetMarketingSemanticEmbeddingParams,
  ListMarketingSemanticEmbeddingsByEntityIdsParams,
  MarketingSemanticEmbeddingRepository,
} from "@/lib/marketing/semantic/entityEmbeddings/repository";
import type {
  MarketingSemanticEmbeddingRecord,
  MarketingSemanticSimilarityMatch,
  MarketingSemanticSimilaritySearchParams,
  UpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/types";
import {
  assertCosineSimilarityBound,
  validateUpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/validation";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";

/**
 * True cosine similarity in [-1, 1] (matches pgvector `1 - (a <=> b)`).
 * Does not force negatives to 0.
 */
export function marketingSemanticCosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  const raw = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  if (!Number.isFinite(raw)) return 0;
  // Bound only for floating-point noise; preserve negative similarities.
  return Math.max(-1, Math.min(1, raw));
}

function rowKey(
  entityType: string,
  entityId: string,
  model: string,
  revision: string,
  sourceTextVersion: string,
): string {
  return `${entityType}\0${entityId}\0${model}\0${revision}\0${sourceTextVersion}`;
}

export class InMemoryMarketingSemanticEmbeddingRepository
  implements MarketingSemanticEmbeddingRepository
{
  readonly #rows = new Map<string, MarketingSemanticEmbeddingRecord>();

  async upsert(input: UpsertMarketingSemanticEmbeddingInput): Promise<MarketingSemanticEmbeddingRecord> {
    const validated = validateUpsertMarketingSemanticEmbeddingInput(input, {
      expectedDimension: input.dimension || MARKETING_SEMANTIC_DEFAULT_DIMENSION,
    });
    const key = rowKey(
      validated.entityType,
      validated.entityId,
      validated.model,
      validated.revision,
      validated.sourceTextVersion,
    );
    const now = new Date().toISOString();
    const existing = this.#rows.get(key);
    const record: MarketingSemanticEmbeddingRecord = {
      id: existing?.id ?? randomUUID(),
      entityType: validated.entityType,
      entityId: validated.entityId,
      model: validated.model,
      dimension: validated.dimension,
      revision: validated.revision,
      contentHash: validated.contentHash,
      sourceTextVersion: validated.sourceTextVersion,
      embedding: [...validated.embedding],
      metadata: { ...(validated.metadata ?? {}) },
      embeddedAt: validated.embeddedAt ?? now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.#rows.set(key, record);
    return { ...record, embedding: [...record.embedding], metadata: { ...record.metadata } };
  }

  async get(
    params: GetMarketingSemanticEmbeddingParams,
  ): Promise<MarketingSemanticEmbeddingRecord | null> {
    const row = this.#rows.get(
      rowKey(
        params.entityType,
        params.entityId,
        params.model,
        params.revision,
        params.sourceTextVersion,
      ),
    );
    return row
      ? { ...row, embedding: [...row.embedding], metadata: { ...row.metadata } }
      : null;
  }

  async listByEntityIds(
    params: ListMarketingSemanticEmbeddingsByEntityIdsParams,
  ): Promise<MarketingSemanticEmbeddingRecord[]> {
    const wanted = new Set(params.entityIds);
    const out: MarketingSemanticEmbeddingRecord[] = [];
    for (const row of this.#rows.values()) {
      if (row.entityType !== params.entityType) continue;
      if (row.model !== params.model) continue;
      if (row.revision !== params.revision) continue;
      if (row.sourceTextVersion !== params.sourceTextVersion) continue;
      if (!wanted.has(row.entityId)) continue;
      out.push({ ...row, embedding: [...row.embedding], metadata: { ...row.metadata } });
    }
    return out;
  }

  async searchSimilar(
    params: MarketingSemanticSimilaritySearchParams,
  ): Promise<MarketingSemanticSimilarityMatch[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
    const minSimilarity = assertCosineSimilarityBound(params.minSimilarity ?? -1, "minSimilarity");
    const exclude = new Set(params.excludeEntityIds ?? []);
    const matches: MarketingSemanticSimilarityMatch[] = [];

    for (const row of this.#rows.values()) {
      if (params.entityType && row.entityType !== params.entityType) continue;
      if (params.model && row.model !== params.model) continue;
      if (params.revision != null && row.revision !== params.revision) continue;
      if (params.sourceTextVersion != null && row.sourceTextVersion !== params.sourceTextVersion) {
        continue;
      }
      if (exclude.has(row.entityId)) continue;
      const similarity = marketingSemanticCosineSimilarity(params.embedding, row.embedding);
      if (similarity < minSimilarity) continue;
      matches.push({
        record: { ...row, embedding: [...row.embedding], metadata: { ...row.metadata } },
        similarity,
      });
    }

    matches.sort((a, b) => {
      if (b.similarity !== a.similarity) return b.similarity - a.similarity;
      return a.record.entityId.localeCompare(b.record.entityId);
    });
    return matches.slice(0, limit);
  }

  /** Test helper */
  clear(): void {
    this.#rows.clear();
  }
}

export function createInMemoryMarketingSemanticEmbeddingRepository(): InMemoryMarketingSemanticEmbeddingRepository {
  return new InMemoryMarketingSemanticEmbeddingRepository();
}
