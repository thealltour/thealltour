import { MARKETING_SEMANTIC_DEFAULT_DIMENSION } from "@/lib/marketing/semantic/entityEmbeddings/constants";
import {
  MARKETING_SEMANTIC_ENTITY_TYPES,
  type MarketingSemanticEmbeddingRecord,
  type MarketingSemanticEntityType,
  type UpsertMarketingSemanticEmbeddingInput,
} from "@/lib/marketing/semantic/entityEmbeddings/types";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";

export class MarketingSemanticValidationError extends Error {
  readonly code = "MARKETING_SEMANTIC_VALIDATION" as const;

  constructor(message: string) {
    super(message);
    this.name = "MarketingSemanticValidationError";
  }
}

const CONTENT_HASH_RE = /^[a-f0-9]{64}$/;

export function isMarketingSemanticEntityType(value: unknown): value is MarketingSemanticEntityType {
  return (
    typeof value === "string" &&
    (MARKETING_SEMANTIC_ENTITY_TYPES as readonly string[]).includes(value)
  );
}

export function assertFiniteEmbeddingVector(
  embedding: unknown,
  expectedDimension: number,
  label = "embedding",
): EmbeddingVector {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new MarketingSemanticValidationError(`${label} must be a non-empty number array`);
  }
  if (embedding.length !== expectedDimension) {
    throw new MarketingSemanticValidationError(
      `${label} length ${embedding.length} does not match dimension ${expectedDimension}`,
    );
  }
  for (const value of embedding) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new MarketingSemanticValidationError(`${label} contains a non-finite number`);
    }
  }
  return embedding;
}

export function assertContentHash(value: unknown): string {
  if (typeof value !== "string" || !CONTENT_HASH_RE.test(value)) {
    throw new MarketingSemanticValidationError("contentHash must be a 64-char lowercase sha256 hex");
  }
  return value;
}

export function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MarketingSemanticValidationError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

export function assertPositiveInt(value: unknown, label: string, minimum = 1): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new MarketingSemanticValidationError(`${label} must be an integer >= ${minimum}`);
  }
  return value;
}

/** Cosine similarity must be within the mathematical [-1, 1] range when provided. */
export function assertCosineSimilarityBound(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new MarketingSemanticValidationError(`${label} must be a finite number`);
  }
  if (value < -1 || value > 1) {
    throw new MarketingSemanticValidationError(`${label} must be within [-1, 1]`);
  }
  return value;
}

export function validateUpsertMarketingSemanticEmbeddingInput(
  input: UpsertMarketingSemanticEmbeddingInput,
  options?: { expectedDimension?: number },
): UpsertMarketingSemanticEmbeddingInput {
  if (!isMarketingSemanticEntityType(input.entityType)) {
    throw new MarketingSemanticValidationError("entityType is not supported");
  }
  const expectedDimension =
    options?.expectedDimension ?? input.dimension ?? MARKETING_SEMANTIC_DEFAULT_DIMENSION;
  const dimension = assertPositiveInt(input.dimension, "dimension");
  if (dimension !== expectedDimension) {
    throw new MarketingSemanticValidationError(
      `dimension ${dimension} does not match expected ${expectedDimension}`,
    );
  }
  const embedding = assertFiniteEmbeddingVector(input.embedding, dimension);
  if (embedding.length !== dimension) {
    throw new MarketingSemanticValidationError("dimension must equal embedding vector length");
  }

  return {
    entityType: input.entityType,
    entityId: assertNonEmptyString(input.entityId, "entityId"),
    model: assertNonEmptyString(input.model, "model"),
    dimension,
    revision: assertNonEmptyString(input.revision, "revision"),
    contentHash: assertContentHash(input.contentHash),
    sourceTextVersion: assertNonEmptyString(input.sourceTextVersion, "sourceTextVersion"),
    embedding,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : {},
    embeddedAt: input.embeddedAt,
  };
}

export function validateMarketingSemanticEmbeddingRecord(
  record: MarketingSemanticEmbeddingRecord,
  options?: { expectedDimension?: number },
): MarketingSemanticEmbeddingRecord {
  const validated = validateUpsertMarketingSemanticEmbeddingInput(record, options);
  return {
    id: assertNonEmptyString(record.id, "id"),
    entityType: validated.entityType,
    entityId: validated.entityId,
    model: validated.model,
    dimension: validated.dimension,
    revision: validated.revision,
    contentHash: validated.contentHash,
    sourceTextVersion: validated.sourceTextVersion,
    embedding: validated.embedding,
    metadata: validated.metadata ?? {},
    embeddedAt: assertNonEmptyString(record.embeddedAt, "embeddedAt"),
    createdAt: assertNonEmptyString(record.createdAt, "createdAt"),
    updatedAt: assertNonEmptyString(record.updatedAt, "updatedAt"),
  };
}
