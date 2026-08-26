import { afterEach, describe, expect, it, vi } from "vitest";

import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  AI_MODEL_IDS,
  AI_PROVIDER_IDS,
  createDefaultAiRuntimeRegistry,
} from "@/ai-runtime/registry";
import {
  createEnvCredentialResolver,
  createGeminiAdapter,
  createNvidiaAdapter,
  createOpenRouterAdapter,
  getProviderAdapter,
  mapHttpStatusToRuntimeError,
  resetProviderAdapterCacheForTests,
  safeErrorMessage,
} from "@/ai-runtime/adapters";
import { CREDENTIAL_REF_ENV_CANDIDATES } from "@/ai-runtime/adapters/credential-resolver";

function sampleRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    id: "req-adapter-1",
    createdAt: new Date().toISOString(),
    agentId: "marketing-manager",
    source: "desktop",
    workload: "content_draft",
    priority: "normal",
    messages: [
      { role: "system", content: "Be concise." },
      { role: "user", content: "Hello" },
    ],
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("ai-runtime adapters", () => {
  afterEach(() => {
    resetProviderAdapterCacheForTests();
    vi.unstubAllGlobals();
  });

  const registry = createDefaultAiRuntimeRegistry();
  const geminiModel = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
  const openRouterModel = registry.getModelById(AI_MODEL_IDS.OPENROUTER_FREE)!;
  const nvidiaModel = registry.getModelById(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B)!;

  describe("credential resolver", () => {
    it("maps known credentialRef to env candidates", async () => {
      expect(CREDENTIAL_REF_ENV_CANDIDATES["ai-provider/gemini/main"]).toContain("GOOGLE_API_KEY");
      expect(CREDENTIAL_REF_ENV_CANDIDATES["ai-provider/openrouter/main"]).toEqual([
        "OPENROUTER_API_KEY",
      ]);
      expect(CREDENTIAL_REF_ENV_CANDIDATES["ai-provider/nvidia/main"]).toEqual(["NVIDIA_API_KEY"]);

      const resolver = createEnvCredentialResolver({
        env: { GOOGLE_API_KEY: "test-gemini-secret-value-xx" },
      });
      await expect(resolver.resolve("ai-provider/gemini/main")).resolves.toBe(
        "test-gemini-secret-value-xx",
      );
    });

    it("throws AUTH_ERROR without leaking secrets when missing", async () => {
      const secret = "super-secret-key-should-not-leak";
      const resolver = createEnvCredentialResolver({ env: {} });
      try {
        await resolver.resolve("ai-provider/openrouter/main");
        throw new Error("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(RuntimeError);
        expect((error as RuntimeError).code).toBe("AUTH_ERROR");
        expect((error as RuntimeError).message).not.toContain(secret);
        expect((error as RuntimeError).message).toContain("OPENROUTER_API_KEY");
      }
    });
  });

  describe("adapter resolver", () => {
    it("returns adapters for enabled providers and rejects unknown/groq", () => {
      expect(getProviderAdapter(AI_PROVIDER_IDS.GEMINI_MAIN).providerId).toBe(
        AI_PROVIDER_IDS.GEMINI_MAIN,
      );
      expect(getProviderAdapter(AI_PROVIDER_IDS.OPENROUTER_MAIN).providerId).toBe(
        AI_PROVIDER_IDS.OPENROUTER_MAIN,
      );
      expect(getProviderAdapter(AI_PROVIDER_IDS.NVIDIA_MAIN).providerId).toBe(
        AI_PROVIDER_IDS.NVIDIA_MAIN,
      );
      expect(() => getProviderAdapter("unknown-provider")).toThrow(RuntimeError);
      expect(() => getProviderAdapter(AI_PROVIDER_IDS.GROQ_MAIN)).toThrow(/Groq adapter/i);
    });
  });

  describe("GeminiAdapter", () => {
    it("maps request, uses modelId, normalizes response/usage", async () => {
      const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
        expect(String(url)).toContain(`/models/${geminiModel.modelId}:generateContent`);
        const body = JSON.parse(String(init?.body));
        expect(body.contents[0].role).toBe("user");
        expect(body.systemInstruction.parts[0].text).toContain("Be concise");
        return jsonResponse(200, {
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "gemini-ok" }] },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 4,
            totalTokenCount: 14,
          },
        });
      });

      const adapter = createGeminiAdapter();
      const result = await adapter.generate(sampleRequest(), geminiModel, {
        credentialResolver: createEnvCredentialResolver({
          env: { GOOGLE_API_KEY: "gemini-test-key-aaaaaaaa" },
        }),
        fetch: fetchMock as unknown as typeof fetch,
      });

      expect(result.content).toBe("gemini-ok");
      expect(result.providerId).toBe(AI_PROVIDER_IDS.GEMINI_MAIN);
      expect(result.modelId).toBe(geminiModel.id);
      expect(result.rawMetadata?.providerModelSlug).toBe(geminiModel.modelId);
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14,
        cachedInputTokens: undefined,
      });
      expect(result.routing.fallbackUsed).toBe(false);
      expect(result.finishReason).toBe("stop");
      expect(result.cost).toBeUndefined();
    });

    it("normalizes 429 / 401 / 5xx", async () => {
      const adapter = createGeminiAdapter();
      const ctx = {
        credentialResolver: createEnvCredentialResolver({
          env: { GOOGLE_API_KEY: "gemini-test-key-bbbbbbbb" },
        }),
      };

      const cases: Array<{ status: number; code: string }> = [
        { status: 429, code: "RATE_LIMIT" },
        { status: 401, code: "AUTH_ERROR" },
        { status: 503, code: "PROVIDER_ERROR" },
      ];

      for (const row of cases) {
        const fetchMock = vi.fn(async () => jsonResponse(row.status, { error: { message: "fail" } }));
        await expect(
          adapter.generate(sampleRequest(), geminiModel, {
            ...ctx,
            fetch: fetchMock as unknown as typeof fetch,
          }),
        ).rejects.toMatchObject({ code: row.code });
      }
    });

    it("rejects models from other providers", async () => {
      const adapter = createGeminiAdapter();
      await expect(
        adapter.generate(sampleRequest(), openRouterModel, {
          credentialResolver: createEnvCredentialResolver({
            env: { GOOGLE_API_KEY: "gemini-test-key-cccccccc" },
          }),
        }),
      ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    });
  });

  describe("OpenRouterAdapter", () => {
    it("passes Registry modelId including openrouter/free and preserves backend model", async () => {
      const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe("openrouter/free");
        return jsonResponse(200, {
          id: "gen-1",
          model: "some-upstream/free-backend",
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: "or-ok" } }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        });
      });

      const adapter = createOpenRouterAdapter();
      const result = await adapter.generate(sampleRequest(), openRouterModel, {
        credentialResolver: createEnvCredentialResolver({
          env: { OPENROUTER_API_KEY: "or-test-key-dddddddd" },
        }),
        fetch: fetchMock as unknown as typeof fetch,
      });

      expect(result.content).toBe("or-ok");
      expect(result.rawMetadata?.requestedModel).toBe("openrouter/free");
      expect(result.rawMetadata?.actualBackendModel).toBe("some-upstream/free-backend");
      expect(result.usage.totalTokens).toBe(5);
    });

    it("supports arbitrary :free model ids from ModelDefinition", async () => {
      const custom: ModelDefinition = {
        ...openRouterModel,
        id: "openrouter-custom-free",
        modelId: "meta-llama/llama-3.3-70b-instruct:free",
      };
      const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe("meta-llama/llama-3.3-70b-instruct:free");
        return jsonResponse(200, {
          choices: [{ finish_reason: "stop", message: { content: "ok" } }],
        });
      });

      const adapter = createOpenRouterAdapter();
      const result = await adapter.generate(sampleRequest(), custom, {
        credentialResolver: createEnvCredentialResolver({
          env: { OPENROUTER_API_KEY: "or-test-key-eeeeeeee" },
        }),
        fetch: fetchMock as unknown as typeof fetch,
      });
      expect(result.content).toBe("ok");
      expect(result.rawMetadata?.usageMissing).toBe(true);
    });

    it("normalizes 429 with retry-after", async () => {
      const adapter = createOpenRouterAdapter();
      const fetchMock = vi.fn(async () =>
        jsonResponse(
          429,
          { error: { message: "Provider returned error" } },
          { "retry-after": "2" },
        ),
      );
      try {
        await adapter.generate(sampleRequest(), openRouterModel, {
          credentialResolver: createEnvCredentialResolver({
            env: { OPENROUTER_API_KEY: "or-test-key-ffffffff" },
          }),
          fetch: fetchMock as unknown as typeof fetch,
        });
        throw new Error("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(RuntimeError);
        expect((error as RuntimeError).code).toBe("RATE_LIMIT");
        expect((error as RuntimeError).retryable).toBe(true);
        expect((error as RuntimeError).retryAfterMs).toBe(2000);
      }
    });
  });

  describe("NvidiaAdapter", () => {
    it("uses Registry slug and normalizes chat completion", async () => {
      const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
        expect(String(url)).toContain("/chat/completions");
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe("meta/llama-3.3-70b-instruct");
        expect(body.messages.some((m: { role: string }) => m.role === "system")).toBe(true);
        return jsonResponse(
          200,
          {
            choices: [{ finish_reason: "stop", message: { content: "nvidia-ok" } }],
            usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
          },
          {
            "x-ratelimit-remaining-requests": "40",
            "x-ratelimit-limit-requests": "100",
          },
        );
      });

      const adapter = createNvidiaAdapter();
      const result = await adapter.generate(sampleRequest({ expectedOutputTokens: 128 }), nvidiaModel, {
        credentialResolver: createEnvCredentialResolver({
          env: { NVIDIA_API_KEY: "nvidia-test-key-gggggggg" },
        }),
        fetch: fetchMock as unknown as typeof fetch,
      });

      const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
      expect(body.max_tokens).toBe(128);
      expect(result.content).toBe("nvidia-ok");
      expect(result.modelId).toBe(nvidiaModel.id);
      expect(result.rawMetadata?.providerModelSlug).toBe(nvidiaModel.modelId);
      expect((result.rawMetadata?.rateLimit as { remainingRequests?: number })?.remainingRequests).toBe(
        40,
      );
    });

    it("normalizes auth and server errors", async () => {
      const adapter = createNvidiaAdapter();
      const ctxBase = {
        credentialResolver: createEnvCredentialResolver({
          env: { NVIDIA_API_KEY: "nvidia-test-key-hhhhhhhh" },
        }),
      };

      await expect(
        adapter.generate(sampleRequest(), nvidiaModel, {
          ...ctxBase,
          fetch: (async () => jsonResponse(403, { detail: "forbidden" })) as unknown as typeof fetch,
        }),
      ).rejects.toMatchObject({ code: "AUTH_ERROR", retryable: false });

      await expect(
        adapter.generate(sampleRequest(), nvidiaModel, {
          ...ctxBase,
          fetch: (async () => jsonResponse(500, { detail: "boom" })) as unknown as typeof fetch,
        }),
      ).rejects.toMatchObject({ code: "PROVIDER_ERROR", retryable: true });
    });
  });

  describe("http error mapping + redaction", () => {
    it("maps quota-ish 403 to QUOTA_EXHAUSTED", () => {
      const error = mapHttpStatusToRuntimeError({
        status: 403,
        bodyText: "Key limit exceeded (total limit)",
      });
      expect(error.code).toBe("QUOTA_EXHAUSTED");
    });

    it("redacts bearer tokens from messages", () => {
      expect(safeErrorMessage("Authorization Bearer sk-abcdefghi1234567890 failed")).not.toMatch(
        /sk-abcdefghi1234567890/,
      );
    });
  });
});
