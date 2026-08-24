import "server-only";

import {
  parseEmbeddingConfig,
  parseEmbeddingHttpConfig,
  readEmbeddingProviderKind,
  type EmbeddingHttpConfig,
} from "@/lib/marketing/semantic/embeddingConfig";
import {
  SemanticNotConfiguredError,
  SemanticProviderError,
  SemanticTimeoutError,
  SemanticUnsupportedError,
} from "@/lib/marketing/semantic/errors";
import type { EmbeddingProvider, EmbeddingVector } from "@/lib/marketing/semantic/types";

export {
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_TIMEOUT_MS,
  EMBEDDING_API_TOKEN_ENV,
  EMBEDDING_BASE_URL_ENV,
  EMBEDDING_DIMENSION_ENV,
  EMBEDDING_HTTP_URL_ENV,
  EMBEDDING_MODEL_ENV,
  EMBEDDING_PROVIDER_ENV,
  EMBEDDING_TIMEOUT_MS_ENV,
  parseEmbeddingConfig,
  parseEmbeddingHttpConfig,
  readEmbeddingProviderKind,
} from "@/lib/marketing/semantic/embeddingConfig";
export type {
  EmbeddingHttpConfig,
  EmbeddingProviderKind,
  ParsedEmbeddingConfig,
} from "@/lib/marketing/semantic/embeddingConfig";

export type EmbeddingFetch = typeof fetch;

export type HttpEmbeddingProviderOptions = EmbeddingHttpConfig & {
  fetch?: EmbeddingFetch;
};

export type EmbeddingHealth = {
  ok: true;
  model: string;
  dimension: number;
};

function joinUrl(baseUrl: string, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/+$/, "")}${suffix}`;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function redact(message: string, token: string | null): string {
  if (!token) return message;
  return message.includes(token) ? message.split(token).join("[redacted]") : message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertFiniteVector(values: unknown, expectedLength: number, label: string): EmbeddingVector {
  if (!Array.isArray(values) || values.length === 0) {
    throw new SemanticProviderError(`${label} must be a non-empty number array`);
  }
  if (values.length !== expectedLength) {
    throw new SemanticProviderError(`${label} length ${values.length} does not match dimension ${expectedLength}`);
  }
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new SemanticProviderError(`${label} contains a non-finite number`);
    }
  }
  return values;
}

function assertMatchingModel(actual: unknown, expected: string): string {
  if (typeof actual !== "string" || actual.trim() !== expected) {
    throw new SemanticProviderError("Embedding model does not match the configured model");
  }
  return actual.trim();
}

function assertMatchingDimension(actual: unknown, expected: number): number {
  if (typeof actual !== "number" || !Number.isInteger(actual) || actual !== expected) {
    throw new SemanticProviderError("Embedding dimension does not match the configured dimension");
  }
  return actual;
}

export class NoneEmbeddingProvider implements EmbeddingProvider {
  readonly model = "none";

  async embed(text: string): Promise<EmbeddingVector> {
    void text;
    throw new SemanticNotConfiguredError("EMBEDDING_PROVIDER is none");
  }

  async embedMany(texts: string[]): Promise<EmbeddingVector[]> {
    void texts;
    throw new SemanticNotConfiguredError("EMBEDDING_PROVIDER is none");
  }
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly baseUrl: string;
  readonly dimension: number;
  readonly timeoutMs: number;
  readonly kind: "mini_pc" | "http";
  readonly #apiToken: string | null;
  readonly #fetchImpl: EmbeddingFetch;

  constructor(input: HttpEmbeddingProviderOptions) {
    this.kind = input.kind;
    this.model = input.model.trim();
    this.baseUrl = input.baseUrl.replace(/\/+$/, "");
    this.dimension = input.dimension;
    this.timeoutMs = input.timeoutMs;
    this.#apiToken = input.apiToken?.trim() || null;
    this.#fetchImpl = input.fetch ?? fetch;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    const payload = await this.requestJson("/embed", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    if (!isRecord(payload)) {
      throw new SemanticProviderError("Embedding response is malformed");
    }
    assertMatchingModel(payload.model, this.model);
    assertMatchingDimension(payload.dimension, this.dimension);
    return assertFiniteVector(payload.embedding, this.dimension, "embedding");
  }

  async embedMany(texts: string[]): Promise<EmbeddingVector[]> {
    if (texts.length === 0) return [];
    const payload = await this.requestJson("/embed/batch", {
      method: "POST",
      body: JSON.stringify({ texts }),
    });
    if (!isRecord(payload)) {
      throw new SemanticProviderError("Embedding batch response is malformed");
    }
    assertMatchingModel(payload.model, this.model);
    assertMatchingDimension(payload.dimension, this.dimension);
    if (!Array.isArray(payload.embeddings)) {
      throw new SemanticProviderError("embeddings must be an array");
    }
    if (payload.embeddings.length !== texts.length) {
      throw new SemanticProviderError(
        `embeddings count ${payload.embeddings.length} does not match texts count ${texts.length}`,
      );
    }
    return payload.embeddings.map((embedding, index) =>
      assertFiniteVector(embedding, this.dimension, `embeddings[${index}]`),
    );
  }

  async checkHealth(): Promise<EmbeddingHealth> {
    const payload = await this.requestJson("/health", { method: "GET" });
    if (!isRecord(payload) || payload.ok !== true) {
      throw new SemanticProviderError("Embedding health check failed");
    }
    return {
      ok: true,
      model: assertMatchingModel(payload.model, this.model),
      dimension: assertMatchingDimension(payload.dimension, this.dimension),
    };
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(init.headers);
    if (init.method !== "GET") {
      headers.set("Content-Type", "application/json");
    }
    if (this.#apiToken) {
      headers.set("Authorization", `Bearer ${this.#apiToken}`);
    }

    try {
      const response = await this.#fetchImpl(joinUrl(this.baseUrl, path), {
        ...init,
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      if (response.status !== 200) {
        throw new SemanticProviderError(`Embedding HTTP ${response.status} from ${path}`);
      }
      try {
        return await response.json();
      } catch {
        throw new SemanticProviderError(`Embedding response is not JSON from ${path}`);
      }
    } catch (error) {
      if (error instanceof SemanticTimeoutError || error instanceof SemanticProviderError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new SemanticTimeoutError(`Embedding request timed out after ${this.timeoutMs}ms`);
      }
      const message = error instanceof Error ? error.message : "Embedding request failed";
      throw new SemanticProviderError(redact(message, this.#apiToken));
    } finally {
      clearTimeout(timeout);
    }
  }
}

export type CreateEmbeddingProviderOptions = {
  fetch?: EmbeddingFetch;
};

export function createEmbeddingProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: CreateEmbeddingProviderOptions = {},
): EmbeddingProvider | null {
  const parsed = parseEmbeddingConfig(env);
  if (parsed.kind === "none") return new NoneEmbeddingProvider();
  if (parsed.kind === "unsupported") return null;
  return new HttpEmbeddingProvider({
    ...parsed,
    fetch: options.fetch,
  });
}

export async function checkEmbeddingHealth(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: CreateEmbeddingProviderOptions = {},
): Promise<EmbeddingHealth> {
  const kind = readEmbeddingProviderKind(env);
  if (kind === "none") {
    throw new SemanticNotConfiguredError("EMBEDDING_PROVIDER is none");
  }
  if (kind === "unsupported") {
    throw new SemanticUnsupportedError("EMBEDDING_PROVIDER is not supported");
  }
  const provider = new HttpEmbeddingProvider({
    ...parseEmbeddingHttpConfig(env),
    fetch: options.fetch,
  });
  return provider.checkHealth();
}
