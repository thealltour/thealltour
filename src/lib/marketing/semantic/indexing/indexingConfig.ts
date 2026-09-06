import {
  MARKETING_SEMANTIC_DEFAULT_DIMENSION,
  MARKETING_SEMANTIC_DEFAULT_MODEL,
} from "@/lib/marketing/semantic/entityEmbeddings/constants";
import {
  DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION,
  MARKETING_SEMANTIC_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/semantic/entityEmbeddings/types";

/**
 * Explicit indexing identity — never infer "latest" from DB.
 * embeddingRevision: pipeline/model-config identity
 * sourceTextVersion: canonical text schema identity
 */
export type MarketingSemanticIndexingConfig = {
  model: string;
  dimension: number;
  embeddingRevision: string;
  sourceTextVersion: string;
  maxBatchSize: number;
};

export const DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH = 8;

export function resolveMarketingSemanticIndexingConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): MarketingSemanticIndexingConfig {
  const model = env.EMBEDDING_MODEL?.trim() || MARKETING_SEMANTIC_DEFAULT_MODEL;
  const dimensionRaw = Number(env.EMBEDDING_DIMENSION?.trim() || "");
  const dimension =
    Number.isFinite(dimensionRaw) && dimensionRaw > 0
      ? Math.trunc(dimensionRaw)
      : MARKETING_SEMANTIC_DEFAULT_DIMENSION;

  const embeddingRevision =
    env.MARKETING_SEMANTIC_EMBEDDING_REVISION?.trim() ||
    DEFAULT_MARKETING_SEMANTIC_EMBEDDING_REVISION;
  const sourceTextVersion =
    env.MARKETING_SEMANTIC_SOURCE_TEXT_VERSION?.trim() ||
    MARKETING_SEMANTIC_SOURCE_TEXT_VERSION;

  // Unset/blank must keep the default — Number("") === 0 is finite and must not collapse to 1.
  const maxBatchEnv = env.MARKETING_SEMANTIC_INDEX_MAX_BATCH?.trim();
  const maxBatchRaw = maxBatchEnv ? Number(maxBatchEnv) : Number.NaN;
  const maxBatchSize =
    Number.isFinite(maxBatchRaw) && maxBatchRaw > 0
      ? Math.min(Math.max(1, Math.trunc(maxBatchRaw)), DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH)
      : DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH;

  return {
    model,
    dimension,
    embeddingRevision,
    sourceTextVersion,
    maxBatchSize,
  };
}
