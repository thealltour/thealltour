import "server-only";

import {
  createEmbeddingProvider,
  parseEmbeddingConfig,
  readEmbeddingProviderKind,
} from "@/lib/marketing/semantic/embeddingProvider";
import {
  SemanticNotConfiguredError,
  SemanticTimeoutError,
  SemanticUnsupportedError,
} from "@/lib/marketing/semantic/errors";
import { createVectorMemoryRepository } from "@/lib/marketing/semantic/vectorMemoryRepository";
import type {
  EmbeddingProvider,
  SemanticContextStatus,
  SemanticRetrievalRequest,
  SemanticRetrievalResult,
  VectorMemoryRepository,
} from "@/lib/marketing/semantic/types";
import { parseSemanticRetrievalRequest } from "@/lib/marketing/semantic/validateSemanticRequest";

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
  if (error instanceof SemanticUnsupportedError) {
    return skipped("provider_unsupported");
  }
  if (error instanceof SemanticTimeoutError) {
    return failed("provider_error");
  }
  return failed("provider_error");
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

  let provider: EmbeddingProvider | null;
  try {
    provider = deps.provider === undefined ? createEmbeddingProvider(env) : deps.provider;
  } catch (error) {
    return toSemanticFailure(error);
  }

  if (!provider) {
    return skipped("provider_not_configured");
  }

  const repository = deps.repository === undefined ? createVectorMemoryRepository() : deps.repository;
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
      productId: parsed.productId,
      campaignId: parsed.campaignId,
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
