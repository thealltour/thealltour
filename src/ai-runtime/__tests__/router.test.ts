import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  AI_MODEL_IDS,
  AI_PROVIDER_IDS,
  createDefaultAiRuntimeRegistry,
} from "@/ai-runtime/registry";
import {
  createInMemoryQuotaBroker,
  createInMemoryUsageLedger,
  resetDefaultQuotaBrokerForTests,
  resetDefaultUsageLedgerForTests,
} from "@/ai-runtime/quota";
import { createHeuristicTokenEstimator } from "@/ai-runtime/tokens";
import type { ProviderAdapter, ProviderExecutionContext } from "@/ai-runtime/adapters/types";
import {
  buildRoutingCandidates,
  createFallbackRuntimeRouter,
  createInMemoryRoutingLedger,
  resetDefaultRoutingLedgerForTests,
} from "@/ai-runtime/router";
import { buildRuntimeStatus } from "@/ai-runtime/observability";
import { resetProviderAdapterCacheForTests } from "@/ai-runtime/adapters";

const NOW = "2026-08-27T03:00:00.000Z";

function sampleRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    id: "req-route-1",
    createdAt: NOW,
    agentId: "marketing-manager",
    source: "desktop",
    workload: "classification",
    priority: "normal",
    messages: [{ role: "user", content: "Classify this product listing." }],
    ...overrides,
  };
}

function successResponse(
  request: RuntimeRequest,
  modelId: string,
  providerId: string,
): RuntimeResponse {
  return {
    requestId: request.id,
    providerId,
    modelId,
    content: "ok",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    latencyMs: 12,
    routing: {
      attempts: [
        {
          providerId,
          modelId,
          startedAt: NOW,
          result: "success",
        },
      ],
      fallbackUsed: false,
    },
    rawMetadata: { usageMissing: false },
  };
}

describe("FallbackRuntimeRouter", () => {
  afterEach(() => {
    resetDefaultUsageLedgerForTests();
    resetDefaultQuotaBrokerForTests();
    resetDefaultRoutingLedgerForTests();
    resetProviderAdapterCacheForTests();
    vi.restoreAllMocks();
  });

  const registry = createDefaultAiRuntimeRegistry();
  const estimator = createHeuristicTokenEstimator();
  const context: ProviderExecutionContext = {
    credentialResolver: { resolve: async () => "test-key" },
  };

  function createRouter(input: {
    adapters: Record<string, ProviderAdapter>;
    configuredLimitsOverride?: Parameters<typeof createInMemoryQuotaBroker>[0]["configuredLimitsOverride"];
    routingLedger?: ReturnType<typeof createInMemoryRoutingLedger>;
  }) {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const quotaBroker = createInMemoryQuotaBroker({
      ledger,
      now: () => new Date(NOW),
      configuredLimitsOverride: input.configuredLimitsOverride,
    });
    const routingLedger = input.routingLedger ?? createInMemoryRoutingLedger(() => new Date(NOW));

    return {
      ledger,
      quotaBroker,
      routingLedger,
      router: createFallbackRuntimeRouter({
        registry,
        tokenEstimator: estimator,
        quotaBroker,
        usageLedger: ledger,
        routingLedger,
        now: () => new Date(NOW),
        getAdapter: (providerId) => {
          const adapter = input.adapters[providerId];
          if (!adapter) {
            throw new RuntimeError("PROVIDER_ERROR", `No adapter for ${providerId}`, true);
          }
          return adapter;
        },
      }),
    };
  }

  it("falls back when first candidate quota reservation is rejected", async () => {
    const geminiModel = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
    const openrouterModel = registry.getModelById(AI_MODEL_IDS.OPENROUTER_FREE)!;

    const geminiGenerate = vi.fn();
    const openrouterGenerate = vi.fn(async () =>
      successResponse(
        sampleRequest({ workload: "content_draft" }),
        openrouterModel.id,
        openrouterModel.providerId,
      ),
    );

    const { router } = createRouter({
      configuredLimitsOverride: (model) =>
        model.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY ? { rpm: 0 } : undefined,
      adapters: {
        [AI_PROVIDER_IDS.GEMINI_MAIN]: {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          generate: geminiGenerate,
        },
        [AI_PROVIDER_IDS.OPENROUTER_MAIN]: {
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          generate: openrouterGenerate,
        },
        [AI_PROVIDER_IDS.NVIDIA_MAIN]: {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          generate: vi.fn(),
        },
      },
    });

    const response = await router.route(
      sampleRequest({
        workload: "content_draft",
        routing: {
          excludedModelIds: [
            AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
            AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
          ],
        },
      }),
      context,
    );

    expect(response.modelId).toBe(openrouterModel.id);
    expect(response.routing.fallbackUsed).toBe(true);
    expect(response.routing.attempts.length).toBeGreaterThanOrEqual(2);
    expect(geminiGenerate).not.toHaveBeenCalled();
    expect(openrouterGenerate).toHaveBeenCalledTimes(1);
    expect(response.routing.attempts[0]).toMatchObject({
      modelId: geminiModel.id,
      result: "quota_exhausted",
    });
  });

  it("falls back on retryable provider errors", async () => {
    const nvidiaModel = registry.getModelById(AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA)!;
    const openrouterModel = registry.getModelById(AI_MODEL_IDS.OPENROUTER_FREE)!;

    const nvidiaGenerate = vi.fn(async () => {
      throw new RuntimeError("TIMEOUT", "upstream timeout", true, 5_000);
    });
    const openrouterGenerate = vi.fn(async () =>
      successResponse(
        sampleRequest({
          workload: "classification",
          routing: {
            excludedModelIds: [
              AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
              AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
            ],
          },
        }),
        openrouterModel.id,
        openrouterModel.providerId,
      ),
    );

    const { router } = createRouter({
      adapters: {
        [AI_PROVIDER_IDS.NVIDIA_MAIN]: {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          generate: nvidiaGenerate,
        },
        [AI_PROVIDER_IDS.OPENROUTER_MAIN]: {
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          generate: openrouterGenerate,
        },
        [AI_PROVIDER_IDS.GEMINI_MAIN]: {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          generate: vi.fn(),
        },
      },
    });

    const response = await router.route(
      sampleRequest({
        workload: "classification",
        routing: {
          excludedModelIds: [
            AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
            AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
          ],
        },
      }),
      context,
    );

    expect(nvidiaGenerate).toHaveBeenCalledTimes(1);
    expect(openrouterGenerate).toHaveBeenCalledTimes(1);
    expect(response.modelId).toBe(openrouterModel.id);
    expect(response.routing.attempts.some((attempt) => attempt.modelId === nvidiaModel.id)).toBe(true);
  });

  it("skips entire provider on AUTH_ERROR", async () => {
    const primaryGenerate = vi.fn(async () => {
      throw new RuntimeError("AUTH_ERROR", "invalid key", false);
    });
    const secondaryGenerate = vi.fn();
    const openrouterGenerate = vi.fn(async () =>
      successResponse(
        sampleRequest(),
        AI_MODEL_IDS.OPENROUTER_FREE,
        AI_PROVIDER_IDS.OPENROUTER_MAIN,
      ),
    );

    const { router } = createRouter({
      adapters: {
        [AI_PROVIDER_IDS.GEMINI_MAIN]: {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          generate: vi.fn(async (request, model) => {
            if (model.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY) {
              return primaryGenerate(request, model);
            }
            return secondaryGenerate(request, model);
          }),
        },
        [AI_PROVIDER_IDS.OPENROUTER_MAIN]: {
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          generate: openrouterGenerate,
        },
        [AI_PROVIDER_IDS.NVIDIA_MAIN]: {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          generate: vi.fn(async () =>
            successResponse(sampleRequest(), AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA, AI_PROVIDER_IDS.NVIDIA_MAIN),
          ),
        },
      },
    });

    const response = await router.route(
      sampleRequest({
        workload: "content_draft",
        routing: {
          excludedModelIds: [
            AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
            AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
          ],
        },
      }),
      context,
    );

    expect(primaryGenerate).toHaveBeenCalledTimes(1);
    expect(secondaryGenerate).not.toHaveBeenCalled();
    expect(openrouterGenerate).toHaveBeenCalledTimes(1);
    expect(response.routing.fallbackUsed).toBe(true);
  });

  it("fail-fast on INVALID_REQUEST without fallback", async () => {
    const generate = vi.fn(async () => {
      throw new RuntimeError("INVALID_REQUEST", "bad payload", false);
    });

    const { router } = createRouter({
      adapters: {
        [AI_PROVIDER_IDS.NVIDIA_MAIN]: {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          generate,
        },
        [AI_PROVIDER_IDS.OPENROUTER_MAIN]: {
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          generate: vi.fn(),
        },
        [AI_PROVIDER_IDS.GEMINI_MAIN]: {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          generate: vi.fn(),
        },
      },
    });

    await expect(router.route(sampleRequest(), context)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      retryable: false,
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("returns retryable QUOTA_EXHAUSTED when all candidates reject", async () => {
    const generate = vi.fn();

    const { router } = createRouter({
      configuredLimitsOverride: () => ({ rpm: 0 }),
      adapters: {
        [AI_PROVIDER_IDS.GEMINI_MAIN]: {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          generate,
        },
        [AI_PROVIDER_IDS.OPENROUTER_MAIN]: {
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          generate,
        },
        [AI_PROVIDER_IDS.NVIDIA_MAIN]: {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          generate,
        },
      },
    });

    await expect(router.route(sampleRequest(), context)).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED",
      retryable: true,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("throws MODEL_UNAVAILABLE when no eligible models exist", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const { router } = createRouter({
      adapters: {},
    });

    await expect(
      router.route(
        sampleRequest({
          workload: "classification",
          routing: {
            excludedProviderIds: [
              AI_PROVIDER_IDS.GEMINI_MAIN,
              AI_PROVIDER_IDS.OPENROUTER_MAIN,
              AI_PROVIDER_IDS.NVIDIA_MAIN,
              AI_PROVIDER_IDS.GROQ_MAIN,
            ],
          },
        }),
        context,
      ),
    ).rejects.toMatchObject({
      code: "MODEL_UNAVAILABLE",
      retryable: false,
    });

    expect(ledger.snapshot().eventCount).toBe(0);
  });

  it("records routing trace without prompt content", async () => {
    const routingLedger = createInMemoryRoutingLedger(() => new Date(NOW));
    const { router } = createRouter({
      routingLedger,
      adapters: {
        [AI_PROVIDER_IDS.NVIDIA_MAIN]: {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          generate: vi.fn(async () =>
            successResponse(sampleRequest(), AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA, AI_PROVIDER_IDS.NVIDIA_MAIN),
          ),
        },
        [AI_PROVIDER_IDS.OPENROUTER_MAIN]: {
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          generate: vi.fn(),
        },
        [AI_PROVIDER_IDS.GEMINI_MAIN]: {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          generate: vi.fn(),
        },
      },
    });

    const response = await router.route(sampleRequest(), context);
    expect(response.routing.attempts.length).toBeGreaterThan(0);
    expect(response.providerId).toBe(AI_PROVIDER_IDS.NVIDIA_MAIN);

    const serialized = JSON.stringify(response.routing);
    expect(serialized).not.toContain("Classify this product listing");
    expect(serialized).not.toContain("test-key");

    const snapshot = routingLedger.snapshot(new Date(NOW));
    expect(snapshot.lastHourRequests).toBe(1);
    expect(snapshot.recent[0]).toMatchObject({
      workload: "classification",
      fallbackUsed: false,
      finalStatus: "success",
    });
  });

  it("does not attempt the same model twice", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const candidates = buildRoutingCandidates({
      request: sampleRequest(),
      registry,
      ledger,
      now: () => new Date(NOW),
    });
    const uniqueModelIds = new Set(candidates.map((candidate) => candidate.model.id));
    expect(uniqueModelIds.size).toBe(candidates.length);
  });

  it("exposes routing aggregates in runtime status", async () => {
    const routingLedger = createInMemoryRoutingLedger(() => new Date(NOW));
    routingLedger.record({
      id: "route-1",
      timestamp: NOW,
      requestId: "req-1",
      workload: "analysis",
      priority: "normal",
      candidateCount: 3,
      attemptCount: 2,
      selectedProviderId: AI_PROVIDER_IDS.NVIDIA_MAIN,
      selectedModelId: AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
      fallbackUsed: true,
      finalStatus: "success",
    });

    const status = buildRuntimeStatus({
      env: {},
      now: () => new Date(NOW),
      routingLedger,
    });

    expect(status.routing).toMatchObject({
      lastHourRequests: 1,
      fallbackCount: 1,
      fallbackRate: 1,
      providerSelections: { NVIDIA: 1 },
    });
    expect(status.routingPolicies?.length).toBeGreaterThan(0);
    expect(status.routingPolicies?.[0]).toMatchObject({
      workload: expect.any(String),
      orderLabels: expect.any(Array),
    });

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("Classify");
    expect(serialized).not.toContain("super-secret");
  });
});
