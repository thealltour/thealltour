import "server-only";

import { SemanticRepositoryError } from "@/lib/marketing/semantic/errors";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";

export function assertQueryEmbedding(embedding: unknown, dimension: number): EmbeddingVector {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new SemanticRepositoryError("query embedding must be a non-empty number array");
  }
  if (embedding.length !== dimension) {
    throw new SemanticRepositoryError(`query embedding length does not match dimension ${dimension}`);
  }
  for (const value of embedding) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new SemanticRepositoryError("query embedding contains a non-finite number");
    }
  }
  return embedding;
}

/** pgvector text form. Used if a client requires a string RPC argument. */
export function serializePgVector(embedding: EmbeddingVector): string {
  return `[${embedding.join(",")}]`;
}
