import { createDailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { createResearchRepository } from "@/lib/marketing/research/repository/createResearchRepository";
import {
  createEmbeddingProvider,
  parseEmbeddingConfig,
  HttpEmbeddingProvider,
  NoneEmbeddingProvider,
} from "@/lib/marketing/semantic/embeddingProvider";
import { MARKETING_SEMANTIC_DEFAULT_DIMENSION } from "@/lib/marketing/semantic/entityEmbeddings/constants";
import {
  createMarketingSemanticEmbeddingRepository,
  isMarketingSemanticEmbeddingRepositoryConfigured,
} from "@/lib/marketing/semantic/entityEmbeddings/createSemanticEmbeddingRepository";
import type { MarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/repository";
import {
  isMarketingSemanticSchemaMissingError,
  type IndexSemanticEntityDeps,
} from "@/lib/marketing/semantic/indexing/indexSemanticEntity";
import {
  resolveMarketingSemanticIndexingConfig,
  type MarketingSemanticIndexingConfig,
} from "@/lib/marketing/semantic/indexing/indexingConfig";
import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";

export type CreateSemanticIndexingRuntimeOptions = {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /**
   * Production/CLI path: require durable Supabase store (never memory fallback).
   * Tests may pass false and inject repos/provider via overrides.
   */
  requireDurableStore?: boolean;
  config?: MarketingSemanticIndexingConfig;
  provider?: EmbeddingProvider;
  embeddingRepo?: MarketingSemanticEmbeddingRepository;
  researchRepo?: IndexSemanticEntityDeps["researchRepo"];
  runRepo?: IndexSemanticEntityDeps["runRepo"];
};

export type SemanticIndexingRuntime = IndexSemanticEntityDeps & {
  config: MarketingSemanticIndexingConfig;
};

function assertProductionDimension(config: MarketingSemanticIndexingConfig): void {
  if (config.dimension !== MARKETING_SEMANTIC_DEFAULT_DIMENSION) {
    throw new Error(
      `indexing dimension must be ${MARKETING_SEMANTIC_DEFAULT_DIMENSION} (got ${config.dimension})`,
    );
  }
}

/**
 * Probe that marketing_semantic_embeddings is available.
 * Does not auto-apply migrations. Throws a clear error when schema/RPC is missing.
 */
export async function assertMarketingSemanticSchemaReady(
  repo: MarketingSemanticEmbeddingRepository,
  config: MarketingSemanticIndexingConfig,
): Promise<void> {
  try {
    await repo.get({
      entityType: "research_brief",
      entityId: "__schema_probe__",
      model: config.model,
      revision: config.embeddingRevision,
      sourceTextVersion: config.sourceTextVersion,
    });
  } catch (error) {
    if (isMarketingSemanticSchemaMissingError(error)) {
      throw new Error(
        "E-1 marketing_semantic_embeddings migration is not applied — refuse indexing (no memory fallback)",
      );
    }
    throw error;
  }
}

/**
 * Wire controlled indexing deps from env.
 * When requireDurableStore=true (CLI default): never silent memory fallback.
 */
export async function createSemanticIndexingRuntime(
  options: CreateSemanticIndexingRuntimeOptions = {},
): Promise<SemanticIndexingRuntime> {
  const env = options.env ?? process.env;
  const requireDurableStore = options.requireDurableStore ?? true;
  const config = options.config ?? resolveMarketingSemanticIndexingConfig(env);

  if (requireDurableStore) {
    assertProductionDimension(config);
  }

  const researchRepo =
    options.researchRepo ??
    (await createResearchRepository({
      backend: requireDurableStore ? "supabase" : undefined,
      env,
    }));
  const runRepo =
    options.runRepo ??
    (await createDailyMarketingRunRepository({
      backend: requireDurableStore ? "supabase" : undefined,
      env,
    }));

  let embeddingRepo = options.embeddingRepo;
  if (!embeddingRepo) {
    if (requireDurableStore) {
      if (!isMarketingSemanticEmbeddingRepositoryConfigured(env)) {
        throw new Error(
          "Supabase is not configured — refuse silent memory fallback for semantic indexing",
        );
      }
      embeddingRepo = await createMarketingSemanticEmbeddingRepository({
        backend: "supabase",
        env,
      });
      await assertMarketingSemanticSchemaReady(embeddingRepo, config);
    } else {
      embeddingRepo = await createMarketingSemanticEmbeddingRepository({
        backend: "memory",
        env,
      });
    }
  } else if (requireDurableStore) {
    await assertMarketingSemanticSchemaReady(embeddingRepo, config);
  }

  let provider = options.provider;
  if (!provider) {
    const parsed = parseEmbeddingConfig(env);
    if (parsed.kind === "none") {
      throw new Error("EMBEDDING_PROVIDER is none — indexing requires HttpEmbeddingProvider");
    }
    if (parsed.kind === "unsupported") {
      throw new Error("EMBEDDING_PROVIDER is unsupported");
    }
    provider = createEmbeddingProvider(env) ?? undefined;
    if (!provider || provider instanceof NoneEmbeddingProvider) {
      throw new Error("embedding provider resolved to none");
    }
    if (!(provider instanceof HttpEmbeddingProvider) && requireDurableStore) {
      throw new Error("indexing requires HttpEmbeddingProvider");
    }
  }

  if (!provider) {
    throw new Error("embedding provider is required");
  }

  return {
    researchRepo,
    runRepo,
    embeddingRepo,
    provider,
    config,
  };
}
