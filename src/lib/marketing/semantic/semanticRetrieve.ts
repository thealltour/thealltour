import "server-only";

import {
  createEmbeddingProvider,
  parseEmbeddingConfig,
  readEmbeddingProviderKind,
} from "@/lib/marketing/semantic/embeddingProvider";
import {
  SemanticFilterUnsupportedError,
  SemanticNotConfiguredError,
  SemanticRepositoryError,
  SemanticTimeoutError,
  SemanticUnsupportedError,
} from "@/lib/marketing/semantic/errors";
import { parseSemanticRetrievalRequest } from "@/lib/marketing/semantic/validateSemanticRequest";
import {
  createVectorMemoryRepository,
  isVectorMemoryRepositoryConfigured,
} from "@/lib/marketing/semantic/vectorMemoryRepository";
import type {
  EmbeddingProvider,
  SemanticContextStatus,
  SemanticRetrievalRequest,
  SemanticRetrievalResult,
  VectorMemoryRepository,
} from "@/lib/marketing/semantic/types";

export type SemanticRetrieveDeps = {
  provider?: EmbeddingProvider | null;
  repository?: VectorMemoryRepository | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

function skipped(reason: NonNullable<SemanticRetrievalResult["reason"]>): SemanticRetrievalResult {
  return { status: "skipped", reason, matches: [] };
}

function failed(reason: NonNullable<SemanticRetrievalResult["reason"]>): SemanticRetrievalResult {
  return { status: "failed", reason, matches: [] };
}

function toSemanticFailure(error: unknown): SemanticRetrievalResult {
  if (error instanceof SemanticNotConfiguredError) {
    return skipped("provider_not_configured");
  }
  if (error instanceof SemanticFilterUnsupportedError) {
    return skipped("filter_unsupported");
  }
  if (error instanceof SemanticUnsupportedError) {
    return skipped("provider_unsupported");
  }
  if (error instanceof SemanticTimeoutError) {
    return failed("provider_error");
  }
  if (error instanceof SemanticRepositoryError) {
    return failed("repository_error");
  }
  return failed("provider_error");
}

function assertSupportedFilters(request: {
  memoryTypes?: string[];
  sourceTypes?: string[];
  productId?: string;
  campaignId?: string;
}): void {
  if (request.productId || request.campaignId) {
    throw new SemanticFilterUnsupportedError(
      "productId/campaignId semantic filters are unsupported until ai_memory source conventions exist",
    );
  }
  if ((request.memoryTypes?.length ?? 0) > 1) {
    throw new SemanticFilterUnsupportedError("memoryTypes does not support multiple values in v1");
  }
  if ((request.sourceTypes?.length ?? 0) > 1) {
    throw new SemanticFilterUnsupportedError("sourceTypes does not support multiple values in v1");
  }
}

export async function semanticRetrieve(
  request: SemanticRetrievalRequest,
  deps: SemanticRetrieveDeps = {},
): Promise<SemanticRetrievalResult> {
  const parsed = parseSemanticRetrievalRequest(request);
  const env = deps.env ?? process.env;
  const kind = readEmbeddingProviderKind(env);

  if (kind === "none") {
    return skipped("provider_not_configured");
  }
  if (kind === "unsupported") {
    return skipped("provider_unsupported");
  }

  try {
    assertSupportedFilters(parsed);
  } catch (error) {
    return toSemanticFailure(error);
  }

  let provider: EmbeddingProvider | null;
  try {
    provider = deps.provider === undefined ? createEmbeddingProvider(env) : deps.provider;
  } catch (error) {
    return toSemanticFailure(error);
  }

  if (!provider) {
    return skipped("provider_not_configured");
  }

  let repository: VectorMemoryRepository | null;
  try {
    repository =
      deps.repository === undefined ? createVectorMemoryRepository({ env }) : deps.repository;
  } catch (error) {
    return toSemanticFailure(error);
  }

  if (!repository) {
    return skipped("repository_not_configured");
  }

  try {
    const embedding = await provider.embed(parsed.query);
    const matches = await repository.searchSimilar({
      embedding,
      limit: parsed.limit,
      minScore: parsed.minScore,
      memoryTypes: parsed.memoryTypes,
      sourceTypes: parsed.sourceTypes,
      embeddingModel: provider.model,
    });
    return {
      status: "ok",
      matches,
      model: provider.model,
    };
  } catch (error) {
    return toSemanticFailure(error);
  }
}

export function semanticStatusFromResult(
  result: SemanticRetrievalResult,
): { status: SemanticRetrievalResult["status"]; reason?: SemanticRetrievalResult["reason"] } {
  return { status: result.status, reason: result.reason };
}

export function resolveSemanticContextStatus(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): SemanticContextStatus {
  try {
    const parsed = parseEmbeddingConfig(env);
    if (parsed.kind === "none") {
      return { status: "skipped", reason: "provider_not_configured" };
    }
    if (parsed.kind === "unsupported") {
      return { status: "skipped", reason: "provider_unsupported" };
    }
    if (!isVectorMemoryRepositoryConfigured(env)) {
      return { status: "skipped", reason: "repository_not_configured" };
    }
    return { status: "skipped", reason: "repository_not_configured" };
  } catch (error) {
    if (error instanceof SemanticNotConfiguredError) {
      return { status: "skipped", reason: "provider_not_configured" };
    }
    if (error instanceof SemanticUnsupportedError) {
      return { status: "skipped", reason: "provider_unsupported" };
    }
    return { status: "failed", reason: "provider_error" };
  }
}
