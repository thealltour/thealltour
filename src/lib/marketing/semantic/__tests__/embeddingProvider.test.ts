import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  HttpEmbeddingProvider,
  NoneEmbeddingProvider,
  SemanticProviderError,
  SemanticTimeoutError,
  checkEmbeddingHealth,
  createEmbeddingProvider,
  parseEmbeddingConfig,
  readEmbeddingProviderKind,
} from "@/lib/marketing/semantic";
import type { HttpEmbeddingProviderOptions } from "@/lib/marketing/semantic/embeddingProvider";

const MODEL = "BAAI/bge-m3";
const DIMENSION = 4;

function vector(dimension = DIMENSION, fill = 0.1): number[] {
  return Array.from({ length: dimension }, () => fill);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function hangingFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener("abort", () => reject(abortError()));
  });
}

function createProvider(
  fetchImpl: typeof fetch,
  overrides: Partial<HttpEmbeddingProviderOptions> = {},
): HttpEmbeddingProvider {
  return new HttpEmbeddingProvider({
    kind: "mini_pc",
    baseUrl: "http://embedding.test",
    model: MODEL,
    dimension: DIMENSION,
    timeoutMs: 1_000,
    apiToken: null,
    fetch: fetchImpl,
    ...overrides,
  });
}

describe("embedding provider factory", () => {
  it("creates NoneEmbeddingProvider when provider is none", () => {
    expect(readEmbeddingProviderKind({ EMBEDDING_PROVIDER: "none" })).toBe("none");
    expect(createEmbeddingProvider({ EMBEDDING_PROVIDER: "none" })).toBeInstanceOf(NoneEmbeddingProvider);
    expect(parseEmbeddingConfig({}).kind).toBe("none");
  });

  it("creates HttpEmbeddingProvider for mini_pc from env", () => {
    const provider = createEmbeddingProvider({
      EMBEDDING_PROVIDER: "mini_pc",
      EMBEDDING_BASE_URL: "http://embedding.test/",
      EMBEDDING_MODEL: MODEL,
      EMBEDDING_DIMENSION: String(DIMENSION),
      EMBEDDING_TIMEOUT_MS: "15000",
    });
    expect(provider).toBeInstanceOf(HttpEmbeddingProvider);
    expect(provider?.model).toBe(MODEL);
    expect((provider as HttpEmbeddingProvider).baseUrl).toBe("http://embedding.test");
    expect((provider as HttpEmbeddingProvider).dimension).toBe(DIMENSION);
    expect((provider as HttpEmbeddingProvider).timeoutMs).toBe(15_000);
  });

  it("requires a base URL for mini_pc", () => {
    expect(() => createEmbeddingProvider({ EMBEDDING_PROVIDER: "mini_pc" })).toThrow(
      /EMBEDDING_BASE_URL is required/,
    );
  });
});

describe("HttpEmbeddingProvider", () => {
  it("embeds a single text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://embedding.test/embed");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ text: "다낭 효도여행" });
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBeNull();
      return jsonResponse({ model: MODEL, dimension: DIMENSION, embedding: vector() });
    });

    const embedding = await createProvider(fetchMock as unknown as typeof fetch).embed("다낭 효도여행");
    expect(embedding).toEqual(vector());
    expect(embedding).toHaveLength(DIMENSION);
  });

  it("embeds many texts via /embed/batch", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://embedding.test/embed/batch");
      expect(JSON.parse(String(init?.body))).toEqual({ texts: ["다낭", "나트랑"] });
      return jsonResponse({
        model: MODEL,
        dimension: DIMENSION,
        embeddings: [vector(DIMENSION, 0.1), vector(DIMENSION, 0.2)],
      });
    });

    const embeddings = await createProvider(fetchMock as unknown as typeof fetch).embedMany(["다낭", "나트랑"]);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(DIMENSION);
    expect(embeddings[1]).toEqual(vector(DIMENSION, 0.2));
  });

  it("sends a bearer token when configured", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer secret-token");
      return jsonResponse({ model: MODEL, dimension: DIMENSION, embedding: vector() });
    });

    const provider = createProvider(fetchMock as unknown as typeof fetch, { apiToken: "secret-token" });
    await provider.embed("다낭");
    expect(JSON.stringify(provider)).not.toContain("secret-token");
  });

  it("times out with a semantic timeout error", async () => {
    const provider = createProvider(hangingFetch as unknown as typeof fetch, { timeoutMs: 20 });
    await expect(provider.embed("다낭")).rejects.toBeInstanceOf(SemanticTimeoutError);
  });

  it("rejects HTTP 500", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "boom" }, 500));
    await expect(createProvider(fetchMock as unknown as typeof fetch).embed("다낭")).rejects.toBeInstanceOf(
      SemanticProviderError,
    );
  });

  it("rejects a malformed response", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ hello: "world" }));
    await expect(createProvider(fetchMock as unknown as typeof fetch).embed("다낭")).rejects.toBeInstanceOf(
      SemanticProviderError,
    );
  });

  it("rejects a dimension mismatch", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ model: MODEL, dimension: 8, embedding: vector(8) }),
    );
    await expect(createProvider(fetchMock as unknown as typeof fetch).embed("다낭")).rejects.toMatchObject({
      name: "SemanticProviderError",
    });
  });

  it("rejects a vector length mismatch", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ model: MODEL, dimension: DIMENSION, embedding: vector(2) }),
    );
    await expect(createProvider(fetchMock as unknown as typeof fetch).embed("다낭")).rejects.toBeInstanceOf(
      SemanticProviderError,
    );
  });

  it("rejects non-finite values and empty vectors", async () => {
    const nanFetch = vi.fn(async () =>
      jsonResponse({ model: MODEL, dimension: DIMENSION, embedding: [0.1, 0.2, Number.NaN, 0.4] }),
    );
    await expect(createProvider(nanFetch as unknown as typeof fetch).embed("다낭")).rejects.toBeInstanceOf(
      SemanticProviderError,
    );

    const emptyFetch = vi.fn(async () =>
      jsonResponse({ model: MODEL, dimension: DIMENSION, embedding: [] }),
    );
    await expect(createProvider(emptyFetch as unknown as typeof fetch).embed("다낭")).rejects.toBeInstanceOf(
      SemanticProviderError,
    );
  });

  it("rejects batch count mismatch", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ model: MODEL, dimension: DIMENSION, embeddings: [vector()] }),
    );
    await expect(
      createProvider(fetchMock as unknown as typeof fetch).embedMany(["다낭", "나트랑"]),
    ).rejects.toBeInstanceOf(SemanticProviderError);
  });

  it("checks health without calling it from embed", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("http://embedding.test/health");
      return jsonResponse({ ok: true, model: MODEL, dimension: DIMENSION });
    });
    const health = await checkEmbeddingHealth(
      {
        EMBEDDING_PROVIDER: "mini_pc",
        EMBEDDING_BASE_URL: "http://embedding.test",
        EMBEDDING_MODEL: MODEL,
        EMBEDDING_DIMENSION: String(DIMENSION),
      },
      { fetch: fetchMock as unknown as typeof fetch },
    );
    expect(health).toEqual({ ok: true, model: MODEL, dimension: DIMENSION });

    const embedFetch = vi.fn(async () =>
      jsonResponse({ model: MODEL, dimension: DIMENSION, embedding: vector() }),
    );
    await createProvider(embedFetch as unknown as typeof fetch).embed("다낭");
    expect(embedFetch).toHaveBeenCalledWith("http://embedding.test/embed", expect.any(Object));
  });
});
