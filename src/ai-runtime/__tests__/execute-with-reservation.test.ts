import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import { RuntimeError } from "@/ai-runtime/domain/error";
import { AI_MODEL_IDS, AI_PROVIDER_IDS, createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry";
import {
  createInMemoryQuotaBroker,
  createInMemoryUsageLedger,
  executeWithReservation,
  resetDefaultQuotaBrokerForTests,
  resetDefaultUsageLedgerForTests,
} from "@/ai-runtime/quota";
import { createHeuristicTokenEstimator } from "@/ai-runtime/tokens";
import type { ProviderAdapter, ProviderExecutionContext } from "@/ai-runtime/adapters/types";

const NOW = "2026-08-27T03:00:00.000Z";

function sampleRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    id: "req-exec-1",
    createdAt: NOW,
    agentId: "marketing-manager",
    source: "desktop",
    workload: "classification",
    priority: "normal",
    messages: [{ role: "user", content: "Summarize this product." }],
    ...overrides,
  };
}

describe("executeWithReservation", () => {
  afterEach(() => {
    resetDefaultUsageLedgerForTests();
    resetDefaultQuotaBrokerForTests();
    vi.restoreAllMocks();
  });

  const registry = createDefaultAiRuntimeRegistry();
  const model = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)!;
  const estimator = createHeuristicTokenEstimator();

  it("runs estimate → reserve → execute → reconcile lifecycle", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    const generate = vi.fn(async (): Promise<RuntimeResponse> => ({
      requestId: "req-exec-1",
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: model.id,
      content: "done",
      usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
      latencyMs: 15,
      routing: {
        attempts: [
          {
            providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
            modelId: model.id,
            startedAt: NOW,
            result: "success",
          },
        ],
        fallbackUsed: false,
      },
      rawMetadata: { usageMissing: false },
    }));

    const adapter: ProviderAdapter = {
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      generate,
    };

    const context: ProviderExecutionContext = {
      credentialResolver: {
        resolve: async () => "test-key",
      },
    };

    const response = await executeWithReservation({
      request: sampleRequest(),
      model,
      adapter,
      context,
      estimator,
      quotaBroker: broker,
      ledger,
      correlationId: "corr-exec",
    });

    expect(response.content).toBe("done");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(broker.getReservationSnapshot().activeReservations).toBe(0);
    expect(ledger.snapshot().eventCount).toBe(1);
  });

  it("does not execute adapter when reservation is rejected", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({
      ledger,
      now: () => new Date(NOW),
      configuredLimitsOverride: () => ({ rpm: 0 }),
    });

    const generate = vi.fn();
    const adapter: ProviderAdapter = {
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      generate,
    };

    await expect(
      executeWithReservation({
        request: sampleRequest(),
        model,
        adapter,
        context: {
          credentialResolver: { resolve: async () => "test-key" },
        },
        estimator,
        quotaBroker: broker,
        ledger,
      }),
    ).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED",
    });

    expect(generate).not.toHaveBeenCalled();
  });

  it("releases reservation when execute fails", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    const adapter: ProviderAdapter = {
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      generate: vi.fn(async () => {
        throw new RuntimeError("PROVIDER_ERROR", "upstream failed", true);
      }),
    };

    await expect(
      executeWithReservation({
        request: sampleRequest({ id: "req-exec-fail" }),
        model,
        adapter,
        context: {
          credentialResolver: { resolve: async () => "test-key" },
        },
        estimator,
        quotaBroker: broker,
        ledger,
      }),
    ).rejects.toBeInstanceOf(RuntimeError);

    expect(broker.getReservationSnapshot().activeReservations).toBe(0);
    expect(ledger.snapshot().eventCount).toBe(1);
  });
});
