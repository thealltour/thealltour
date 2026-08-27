import { describe, expect, it } from "vitest";

import { RuntimeError } from "@/ai-runtime/domain/error";
import { AI_MODEL_IDS, AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import { buildRuntimeStatus } from "@/ai-runtime/observability";
import {
  buildModelQuotaState,
  buildProviderQuotaState,
  createInMemoryUsageLedger,
  evaluateQuotaHealth,
  recordRuntimeError,
  recordRuntimeResponse,
  usageEventFromResponse,
} from "@/ai-runtime/quota";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";

function sampleResponse(overrides: Partial<RuntimeResponse> = {}): RuntimeResponse {
  return {
    requestId: "req-health-1",
    providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
    modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    content: "ok",
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    latencyMs: 50,
    routing: {
      attempts: [
        {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
          startedAt: "2026-08-27T03:00:00.000Z",
          result: "success",
        },
      ],
      fallbackUsed: false,
    },
    rawMetadata: { usageMissing: false, providerModelSlug: "gemini-3.5-flash-lite" },
    ...overrides,
  };
}

describe("quota state and health", () => {
  it("returns unknown when capacity is not configured or observed", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:30.000Z"),
    });

    ledger.record(
      usageEventFromResponse(sampleResponse(), {
        completedAt: "2026-08-27T03:00:30.000Z",
      }),
    );

    const state = buildProviderQuotaState(AI_PROVIDER_IDS.GEMINI_MAIN, {
      ledger,
      now: () => new Date("2026-08-27T03:00:30.000Z"),
    });
    expect(state.minute.requests).toBe(1);
    expect(state.health).toBe("unknown");
  });

  it("marks green/yellow/red from observed remaining ratio", () => {
    const now = new Date("2026-08-27T03:00:00.000Z");
    const ledger = createInMemoryUsageLedger({ now: () => now });

    const minute = ledger.aggregateMinute({}, now);
    const day = ledger.aggregateDay({}, now);

    expect(
      evaluateQuotaHealth({
        now,
        minute,
        day,
        observed: {
          limitRequests: 100,
          remainingRequests: 30,
          observedAt: now.toISOString(),
        },
        recentEvents: [],
      }).health,
    ).toBe("yellow");

    expect(
      evaluateQuotaHealth({
        now,
        minute,
        day,
        observed: {
          limitRequests: 100,
          remainingRequests: 10,
          observedAt: now.toISOString(),
        },
        recentEvents: [],
      }).health,
    ).toBe("red");

    expect(
      evaluateQuotaHealth({
        now,
        minute,
        day,
        observed: {
          limitRequests: 100,
          remainingRequests: 80,
          observedAt: now.toISOString(),
        },
        recentEvents: [],
      }).health,
    ).toBe("green");
  });

  it("marks green/yellow/red from configured rpm usage", () => {
    const now = new Date("2026-08-27T03:00:00.000Z");
    const minute = {
      requestCount: 70,
      successCount: 70,
      errorCount: 0,
      rateLimitedCount: 0,
      quotaExhaustedCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      knownTokenEventCount: 0,
      usageMissingCount: 0,
    };
    const day = { ...minute, requestCount: 0 };

    expect(
      evaluateQuotaHealth({
        now,
        minute,
        day,
        configured: { rpm: 100 },
        recentEvents: [],
      }).health,
    ).toBe("yellow");

    expect(
      evaluateQuotaHealth({
        now,
        minute: { ...minute, requestCount: 90 },
        day,
        configured: { rpm: 100 },
        recentEvents: [],
      }).health,
    ).toBe("red");

    expect(
      evaluateQuotaHealth({
        now,
        minute: { ...minute, requestCount: 20 },
        day,
        configured: { rpm: 100 },
        recentEvents: [],
      }).health,
    ).toBe("green");
  });

  it("marks blocked while retry-after window is active and recovers afterward", () => {
    const blockedAt = "2026-08-27T03:00:00.000Z";
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:02.000Z"),
    });

    recordRuntimeError(
      ledger,
      new RuntimeError("RATE_LIMIT", "Too many requests", true, 5_000),
      {
        requestId: "req-blocked",
        providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
        modelId: AI_MODEL_IDS.OPENROUTER_FREE,
        startedAt: blockedAt,
        completedAt: blockedAt,
      },
    );

    const blockedState = buildProviderQuotaState(AI_PROVIDER_IDS.OPENROUTER_MAIN, {
      ledger,
      now: () => new Date("2026-08-27T03:00:02.000Z"),
    });
    expect(blockedState.health).toBe("blocked");
    expect(blockedState.blockedUntil).toBe("2026-08-27T03:00:05.000Z");

    const recoveredState = buildProviderQuotaState(AI_PROVIDER_IDS.OPENROUTER_MAIN, {
      ledger,
      now: () => new Date("2026-08-27T03:00:06.000Z"),
    });
    expect(recoveredState.health).toBe("unknown");
    expect(recoveredState.blockedUntil).toBeUndefined();
  });

  it("recovers blocked state after a later success event", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:03.000Z"),
    });

    recordRuntimeError(
      ledger,
      new RuntimeError("RATE_LIMIT", "Too many requests", true, 10_000),
      {
        requestId: "req-blocked-2",
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
        startedAt: "2026-08-27T03:00:00.000Z",
        completedAt: "2026-08-27T03:00:00.000Z",
      },
    );

    recordRuntimeResponse(ledger, sampleResponse({ requestId: "req-recover" }), {
      completedAt: "2026-08-27T03:00:03.000Z",
    });

    const state = buildModelQuotaState(
      AI_PROVIDER_IDS.GEMINI_MAIN,
      AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      { ledger, now: () => new Date("2026-08-27T03:00:03.500Z") },
    );

    expect(state.health).not.toBe("blocked");
  });

  it("does not mark blocked when retry-after is missing", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:01.000Z"),
    });

    recordRuntimeError(
      ledger,
      new RuntimeError("RATE_LIMIT", "Too many requests", true),
      {
        requestId: "req-no-retry",
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
        startedAt: "2026-08-27T03:00:00.000Z",
        completedAt: "2026-08-27T03:00:00.000Z",
      },
    );

    const state = buildProviderQuotaState(AI_PROVIDER_IDS.GEMINI_MAIN, { ledger });
    expect(state.health).not.toBe("blocked");
  });

  it("includes quota snapshot in runtime status without raw events", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:30.000Z"),
    });

    ledger.record(
      usageEventFromResponse(sampleResponse(), {
        completedAt: "2026-08-27T03:00:30.000Z",
      }),
    );

    const status = buildRuntimeStatus({
      ledger,
      now: () => new Date("2026-08-27T03:00:30.000Z"),
      env: {},
    });

    const gemini = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GEMINI_MAIN);
    expect(gemini?.quota).toMatchObject({
      health: "unknown",
      minuteRequests: 1,
      dayRequests: 1,
      minuteTokensKnown: true,
      dayTokensKnown: true,
    });

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("req-health-1");
    expect(serialized).not.toContain("super-secret");
  });
});
