export type { MarketingSemanticIndexingConfig } from "@/lib/marketing/semantic/indexing/indexingConfig";
export {
  DEFAULT_MARKETING_SEMANTIC_INDEXING_MAX_BATCH,
  resolveMarketingSemanticIndexingConfig,
} from "@/lib/marketing/semantic/indexing/indexingConfig";

export type {
  HydratedSemanticEntity,
  SemanticEntityHydrationDeps,
  SemanticEntityHydrationResult,
} from "@/lib/marketing/semantic/indexing/hydrateSemanticEntity";
export { hydrateSemanticEntityForIndexing } from "@/lib/marketing/semantic/indexing/hydrateSemanticEntity";

export type {
  IndexSemanticEntitiesBatchInput,
  IndexSemanticEntityDeps,
  IndexSemanticEntityInput,
  SemanticIndexResult,
  SemanticIndexStatus,
} from "@/lib/marketing/semantic/indexing/indexSemanticEntity";
export {
  indexSemanticEntitiesBatch,
  indexSemanticEntity,
  isMarketingSemanticSchemaMissingError,
} from "@/lib/marketing/semantic/indexing/indexSemanticEntity";

export type {
  CreateSemanticIndexingRuntimeOptions,
  SemanticIndexingRuntime,
} from "@/lib/marketing/semantic/indexing/createSemanticIndexingRuntime";
export {
  assertMarketingSemanticSchemaReady,
  createSemanticIndexingRuntime,
} from "@/lib/marketing/semantic/indexing/createSemanticIndexingRuntime";
