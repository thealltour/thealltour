import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import type { MarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/repository";
import type { MarketingSemanticEntityType } from "@/lib/marketing/semantic/entityEmbeddings/types";
import {
  MarketingSemanticValidationError,
  assertFiniteEmbeddingVector,
} from "@/lib/marketing/semantic/entityEmbeddings/validation";
import { hydrateSemanticEntityForIndexing } from "@/lib/marketing/semantic/indexing/hydrateSemanticEntity";
import type { MarketingSemanticIndexingConfig } from "@/lib/marketing/semantic/indexing/indexingConfig";
import type { EmbeddingProvider, EmbeddingVector } from "@/lib/marketing/semantic/types";

export type SemanticIndexStatus =
  | "indexed"
  | "skipped_unchanged"
  | "unavailable"
  | "failed"
  | "dry_run";

export type SemanticIndexResult = {
  status: SemanticIndexStatus;
  entityType: MarketingSemanticEntityType;
  entityId: string;
  model: string;
  revision: string;
  sourceTextVersion: string;
  contentHashPrefix: string;
  providerCalled: boolean;
  durationMs: number;
  reason?: string;
  message?: string;
};

export type IndexSemanticEntityInput = {
  entityType: MarketingSemanticEntityType;
  entityId: string;
  dryRun?: boolean;
};

export type IndexSemanticEntityDeps = {
  researchRepo: Pick<ResearchRepository, "findBriefById" | "findAgendaCandidateById">;
  runRepo: Pick<DailyMarketingRunRepository, "findCandidateByCandidateId">;
  embeddingRepo: MarketingSemanticEmbeddingRepository;
  provider: EmbeddingProvider;
  config: MarketingSemanticIndexingConfig;
  now?: () => Date;
};

function contentHashPrefix(hash: string): string {
  return hash.slice(0, 12);
}

export function isMarketingSemanticSchemaMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /marketing_semantic_embeddings|match_marketing_semantic_embeddings|relation .* does not exist|Could not find the table/i.test(
    message,
  );
}

async function loadExistingOrSchemaError(
  deps: IndexSemanticEntityDeps,
  input: {
    entityType: MarketingSemanticEntityType;
    entityId: string;
    contentHash: string;
  },
): Promise<
  | { kind: "match" }
  | { kind: "mismatch_or_missing" }
  | { kind: "schema_missing"; message: string }
  | { kind: "repo_error"; message: string }
> {
  try {
    const existing = await deps.embeddingRepo.get({
      entityType: input.entityType,
      entityId: input.entityId,
      model: deps.config.model,
      revision: deps.config.embeddingRevision,
      sourceTextVersion: deps.config.sourceTextVersion,
    });
    if (existing && existing.contentHash === input.contentHash) {
      return { kind: "match" };
    }
    return { kind: "mismatch_or_missing" };
  } catch (error) {
    if (isMarketingSemanticSchemaMissingError(error)) {
      return {
        kind: "schema_missing",
        message:
          "marketing_semantic_embeddings schema/RPC is missing — apply E-1 migration before indexing",
      };
    }
    return {
      kind: "repo_error",
      message: error instanceof Error ? error.message : "embedding repository lookup failed",
    };
  }
}

function validateProviderVector(
  embedding: EmbeddingVector,
  config: MarketingSemanticIndexingConfig,
  providerModel: string,
): EmbeddingVector {
  if (providerModel.trim() && providerModel.trim() !== config.model) {
    throw new MarketingSemanticValidationError(
      `provider model ${providerModel} does not match indexing model ${config.model}`,
    );
  }
  return assertFiniteEmbeddingVector(embedding, config.dimension, "provider embedding");
}

/**
 * Index exactly one marketing semantic entity.
 * Idempotent: unchanged contentHash => skipped_unchanged (no provider call).
 */
export async function indexSemanticEntity(
  input: IndexSemanticEntityInput,
  deps: IndexSemanticEntityDeps,
): Promise<SemanticIndexResult> {
  const started = Date.now();
  const base = {
    entityType: input.entityType,
    entityId: input.entityId.trim(),
    model: deps.config.model,
    revision: deps.config.embeddingRevision,
    sourceTextVersion: deps.config.sourceTextVersion,
  };

  const hydrated = await hydrateSemanticEntityForIndexing(
    { entityType: input.entityType, entityId: base.entityId },
    {
      researchRepo: deps.researchRepo,
      runRepo: deps.runRepo,
      sourceTextVersion: deps.config.sourceTextVersion,
    },
  );

  if (hydrated.status !== "ok") {
    return {
      ...base,
      status: "unavailable",
      contentHashPrefix: "",
      providerCalled: false,
      durationMs: Date.now() - started,
      reason: hydrated.reason,
      message: hydrated.message,
    };
  }

  const { entity } = hydrated;
  const existing = await loadExistingOrSchemaError(deps, {
    entityType: entity.entityType,
    entityId: entity.entityId,
    contentHash: entity.contentHash,
  });

  if (existing.kind === "schema_missing" || existing.kind === "repo_error") {
    return {
      ...base,
      status: "failed",
      contentHashPrefix: contentHashPrefix(entity.contentHash),
      providerCalled: false,
      durationMs: Date.now() - started,
      reason: existing.kind,
      message: existing.message,
    };
  }

  if (existing.kind === "match") {
    return {
      ...base,
      status: "skipped_unchanged",
      contentHashPrefix: contentHashPrefix(entity.contentHash),
      providerCalled: false,
      durationMs: Date.now() - started,
      message: "contentHash unchanged",
    };
  }

  if (input.dryRun) {
    return {
      ...base,
      status: "dry_run",
      contentHashPrefix: contentHashPrefix(entity.contentHash),
      providerCalled: false,
      durationMs: Date.now() - started,
      message: "dry-run: would embed and upsert",
    };
  }

  let embedding: EmbeddingVector;
  try {
    embedding = validateProviderVector(
      await deps.provider.embed(entity.canonicalText),
      deps.config,
      deps.provider.model,
    );
  } catch (error) {
    return {
      ...base,
      status: "failed",
      contentHashPrefix: contentHashPrefix(entity.contentHash),
      providerCalled: true,
      durationMs: Date.now() - started,
      reason: "provider_error",
      message: error instanceof Error ? error.message : "embedding provider failed",
    };
  }

  try {
    const now = (deps.now ?? (() => new Date()))().toISOString();
    await deps.embeddingRepo.upsert({
      entityType: entity.entityType,
      entityId: entity.entityId,
      model: deps.config.model,
      dimension: deps.config.dimension,
      revision: deps.config.embeddingRevision,
      contentHash: entity.contentHash,
      sourceTextVersion: deps.config.sourceTextVersion,
      embedding,
      metadata: {
        indexedBy: "indexSemanticEntity",
      },
      embeddedAt: now,
    });
  } catch (error) {
    if (isMarketingSemanticSchemaMissingError(error)) {
      return {
        ...base,
        status: "failed",
        contentHashPrefix: contentHashPrefix(entity.contentHash),
        providerCalled: true,
        durationMs: Date.now() - started,
        reason: "schema_missing",
        message:
          "marketing_semantic_embeddings schema/RPC is missing — apply E-1 migration before indexing",
      };
    }
    return {
      ...base,
      status: "failed",
      contentHashPrefix: contentHashPrefix(entity.contentHash),
      providerCalled: true,
      durationMs: Date.now() - started,
      reason: "upsert_error",
      message: error instanceof Error ? error.message : "embedding upsert failed",
    };
  }

  return {
    ...base,
    status: "indexed",
    contentHashPrefix: contentHashPrefix(entity.contentHash),
    providerCalled: true,
    durationMs: Date.now() - started,
  };
}

export type IndexSemanticEntitiesBatchInput = {
  entities: Array<{ entityType: MarketingSemanticEntityType; entityId: string }>;
  dryRun?: boolean;
};

/**
 * Controlled small-batch indexing.
 * Unchanged entities are skipped before embedMany.
 */
export async function indexSemanticEntitiesBatch(
  input: IndexSemanticEntitiesBatchInput,
  deps: IndexSemanticEntityDeps,
): Promise<SemanticIndexResult[]> {
  const max = deps.config.maxBatchSize;
  if (input.entities.length > max) {
    throw new Error(`batch size ${input.entities.length} exceeds maxBatchSize ${max}`);
  }

  const ordered = [...input.entities]
    .map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId.trim(),
    }))
    .sort((a, b) => {
      const typeCmp = a.entityType.localeCompare(b.entityType);
      if (typeCmp !== 0) return typeCmp;
      return a.entityId.localeCompare(b.entityId);
    });

  const results: SemanticIndexResult[] = new Array(ordered.length);
  const pending: Array<{
    index: number;
    entityType: MarketingSemanticEntityType;
    entityId: string;
    contentHash: string;
    canonicalText: string;
    started: number;
  }> = [];

  for (let i = 0; i < ordered.length; i += 1) {
    const row = ordered[i]!;
    const started = Date.now();
    const base = {
      entityType: row.entityType,
      entityId: row.entityId,
      model: deps.config.model,
      revision: deps.config.embeddingRevision,
      sourceTextVersion: deps.config.sourceTextVersion,
    };

    const hydrated = await hydrateSemanticEntityForIndexing(row, {
      researchRepo: deps.researchRepo,
      runRepo: deps.runRepo,
      sourceTextVersion: deps.config.sourceTextVersion,
    });
    if (hydrated.status !== "ok") {
      results[i] = {
        ...base,
        status: "unavailable",
        contentHashPrefix: "",
        providerCalled: false,
        durationMs: Date.now() - started,
        reason: hydrated.reason,
        message: hydrated.message,
      };
      continue;
    }

    const existing = await loadExistingOrSchemaError(deps, {
      entityType: hydrated.entity.entityType,
      entityId: hydrated.entity.entityId,
      contentHash: hydrated.entity.contentHash,
    });
    if (existing.kind === "schema_missing" || existing.kind === "repo_error") {
      results[i] = {
        ...base,
        status: "failed",
        contentHashPrefix: contentHashPrefix(hydrated.entity.contentHash),
        providerCalled: false,
        durationMs: Date.now() - started,
        reason: existing.kind,
        message: existing.message,
      };
      continue;
    }
    if (existing.kind === "match") {
      results[i] = {
        ...base,
        status: "skipped_unchanged",
        contentHashPrefix: contentHashPrefix(hydrated.entity.contentHash),
        providerCalled: false,
        durationMs: Date.now() - started,
        message: "contentHash unchanged",
      };
      continue;
    }

    if (input.dryRun) {
      results[i] = {
        ...base,
        status: "dry_run",
        contentHashPrefix: contentHashPrefix(hydrated.entity.contentHash),
        providerCalled: false,
        durationMs: Date.now() - started,
        message: "dry-run: would embed and upsert",
      };
      continue;
    }

    pending.push({
      index: i,
      entityType: hydrated.entity.entityType,
      entityId: hydrated.entity.entityId,
      contentHash: hydrated.entity.contentHash,
      canonicalText: hydrated.entity.canonicalText,
      started,
    });
  }

  if (pending.length === 0) return results;

  let vectors: EmbeddingVector[];
  try {
    vectors = await deps.provider.embedMany(pending.map((row) => row.canonicalText));
    if (vectors.length !== pending.length) {
      throw new Error(
        `embedMany returned ${vectors.length} vectors for ${pending.length} texts`,
      );
    }
    for (let i = 0; i < vectors.length; i += 1) {
      vectors[i] = validateProviderVector(vectors[i]!, deps.config, deps.provider.model);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "embedding provider batch failed";
    for (const row of pending) {
      results[row.index] = {
        entityType: row.entityType,
        entityId: row.entityId,
        model: deps.config.model,
        revision: deps.config.embeddingRevision,
        sourceTextVersion: deps.config.sourceTextVersion,
        status: "failed",
        contentHashPrefix: contentHashPrefix(row.contentHash),
        providerCalled: true,
        durationMs: Date.now() - row.started,
        reason: "provider_error",
        message,
      };
    }
    return results;
  }

  const now = (deps.now ?? (() => new Date()))().toISOString();
  for (let i = 0; i < pending.length; i += 1) {
    const row = pending[i]!;
    const embedding = vectors[i]!;
    try {
      await deps.embeddingRepo.upsert({
        entityType: row.entityType,
        entityId: row.entityId,
        model: deps.config.model,
        dimension: deps.config.dimension,
        revision: deps.config.embeddingRevision,
        contentHash: row.contentHash,
        sourceTextVersion: deps.config.sourceTextVersion,
        embedding,
        metadata: { indexedBy: "indexSemanticEntitiesBatch" },
        embeddedAt: now,
      });
      results[row.index] = {
        entityType: row.entityType,
        entityId: row.entityId,
        model: deps.config.model,
        revision: deps.config.embeddingRevision,
        sourceTextVersion: deps.config.sourceTextVersion,
        status: "indexed",
        contentHashPrefix: contentHashPrefix(row.contentHash),
        providerCalled: true,
        durationMs: Date.now() - row.started,
      };
    } catch (error) {
      results[row.index] = {
        entityType: row.entityType,
        entityId: row.entityId,
        model: deps.config.model,
        revision: deps.config.embeddingRevision,
        sourceTextVersion: deps.config.sourceTextVersion,
        status: "failed",
        contentHashPrefix: contentHashPrefix(row.contentHash),
        providerCalled: true,
        durationMs: Date.now() - row.started,
        reason: isMarketingSemanticSchemaMissingError(error) ? "schema_missing" : "upsert_error",
        message: error instanceof Error ? error.message : "embedding upsert failed",
      };
    }
  }

  return results;
}
