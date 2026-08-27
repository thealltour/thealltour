import { afterEach, describe, expect, it } from "vitest";

import { RuntimeError } from "@/ai-runtime/domain/error";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import { AI_MODEL_IDS, AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import {
  createInMemoryUsageLedger,
  recordRuntimeError,
  recordRuntimeResponse,
  resetDefaultUsageLedgerForTests,
  usageEventFromResponse,
} from "@/ai-runtime/quota";

function sampleResponse(overrides: Partial<RuntimeResponse> = {}): RuntimeResponse {
  return {
    requestId: "req-1",
    providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
    modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    content: "hello",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    latencyMs: 120,
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
    rawMetadata: {
      providerModelSlug: "gemini-3.5-flash-lite",
      usageMissing: false,
    },
    ...overrides,
  };
}

describe("usage ledger", () => {
  afterEach(() => {
    resetDefaultUsageLedgerForTests();
  });

  it("records success events and aggregates tokens", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:30.000Z"),
    });

    recordRuntimeResponse(ledger, sampleResponse(), {
      correlationId: "corr-abc",
      completedAt: "2026-08-27T03:00:30.000Z",
    });
    recordRuntimeResponse(
      ledger,
      sampleResponse({
        requestId: "req-2",
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
      }),
      { completedAt: "2026-08-27T03:00:45.000Z" },
    );

    const minute = ledger.aggregateMinute(
      {
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      },
      new Date("2026-08-27T03:00:50.000Z"),
    );

    expect(minute.requestCount).toBe(2);
    expect(minute.successCount).toBe(2);
    expect(minute.totalTokens).toBe(45);
    expect(minute.knownTokenEventCount).toBe(2);
    expect(ledger.getCorrelationSummary("corr-abc")?.llmCallCount).toBe(1);
  });

  it("does not pollute token totals when usageMissing is true", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:01:00.000Z"),
    });

    recordRuntimeResponse(
      ledger,
      sampleResponse({
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        rawMetadata: { usageMissing: true, providerModelSlug: "gemini-3.5-flash-lite" },
      }),
      { completedAt: "2026-08-27T03:01:00.000Z" },
    );

    const minute = ledger.aggregateMinute(
      { providerId: AI_PROVIDER_IDS.GEMINI_MAIN },
      new Date("2026-08-27T03:01:00.000Z"),
    );

    expect(minute.requestCount).toBe(1);
    expect(minute.usageMissingCount).toBe(1);
    expect(minute.knownTokenEventCount).toBe(0);
    expect(minute.totalTokens).toBe(0);
  });

  it("aggregates minute and Seoul calendar day windows", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T14:00:00.000+09:00"),
    });

    ledger.record(
      usageEventFromResponse(sampleResponse({ requestId: "req-old" }), {
        completedAt: "2026-08-26T23:59:00.000+09:00",
      }),
    );
    ledger.record(
      usageEventFromResponse(sampleResponse({ requestId: "req-today" }), {
        completedAt: "2026-08-27T00:05:00.000+09:00",
      }),
    );
    ledger.record(
      usageEventFromResponse(sampleResponse({ requestId: "req-minute" }), {
        completedAt: "2026-08-27T13:59:30.000+09:00",
      }),
    );

    const now = new Date("2026-08-27T14:00:00.000+09:00");
    const minute = ledger.aggregateMinute({ providerId: AI_PROVIDER_IDS.GEMINI_MAIN }, now);
    const day = ledger.aggregateDay({ providerId: AI_PROVIDER_IDS.GEMINI_MAIN }, now);

    expect(minute.requestCount).toBe(1);
    expect(day.requestCount).toBe(2);
  });

  it("filters by provider and model", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    ledger.record(
      usageEventFromResponse(
        sampleResponse({
          providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
          modelId: AI_MODEL_IDS.OPENROUTER_FREE,
          requestId: "req-or",
        }),
        { completedAt: "2026-08-27T03:00:00.000Z" },
      ),
    );
    ledger.record(
      usageEventFromResponse(sampleResponse(), { completedAt: "2026-08-27T03:00:00.000Z" }),
    );

    expect(
      ledger.aggregateMinute({ providerId: AI_PROVIDER_IDS.GEMINI_MAIN }).requestCount,
    ).toBe(1);
    expect(
      ledger.aggregateMinute({
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      }).requestCount,
    ).toBe(1);
  });

  it("records rate limit and quota errors with retry metadata", () => {
    const ledger = createInMemoryUsageLedger({
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    recordRuntimeError(
      ledger,
      new RuntimeError("RATE_LIMIT", "Too many requests", true, 5_000),
      {
        requestId: "req-rl",
        providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
        modelId: AI_MODEL_IDS.OPENROUTER_FREE,
        completedAt: "2026-08-27T03:00:00.000Z",
        startedAt: "2026-08-27T02:59:59.000Z",
        rateLimit: {
          limitRequests: 20,
          remainingRequests: 0,
          retryAfterMs: 5_000,
        },
      },
    );

    recordRuntimeError(
      ledger,
      new RuntimeError("QUOTA_EXHAUSTED", "Daily quota exceeded", true, 60_000),
      {
        requestId: "req-quota",
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
        completedAt: "2026-08-27T03:00:01.000Z",
        startedAt: "2026-08-27T03:00:00.000Z",
      },
    );

    recordRuntimeError(
      ledger,
      new RuntimeError("TIMEOUT", "Timed out", true),
      {
        requestId: "req-timeout",
        providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
        modelId: AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
        completedAt: "2026-08-27T03:00:02.000Z",
        startedAt: "2026-08-27T02:59:00.000Z",
      },
    );

    recordRuntimeError(
      ledger,
      new RuntimeError("AUTH_ERROR", "Bad key", false),
      {
        requestId: "req-auth",
        providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
        modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
        completedAt: "2026-08-27T03:00:03.000Z",
        startedAt: "2026-08-27T03:00:02.500Z",
      },
    );

    const minute = ledger.aggregateMinute({}, new Date("2026-08-27T03:00:10.000Z"));
    expect(minute.requestCount).toBe(4);
    expect(minute.rateLimitedCount).toBe(1);
    expect(minute.quotaExhaustedCount).toBe(1);
    expect(minute.errorCount).toBe(4);

    const observed = ledger.getLatestObservedRateLimit({
      providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
    });
    expect(observed?.limitRequests).toBe(20);
    expect(observed?.remainingRequests).toBe(0);
  });

  it("enforces bounded retention by max events", () => {
    const ledger = createInMemoryUsageLedger({
      maxEvents: 3,
      retentionMs: 48 * 60 * 60 * 1000,
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    for (let i = 0; i < 5; i += 1) {
      ledger.record(
        usageEventFromResponse(sampleResponse({ requestId: `req-${i}` }), {
          completedAt: new Date(Date.parse("2026-08-27T03:00:00.000Z") + i * 1000).toISOString(),
        }),
      );
    }

    expect(ledger.snapshot().eventCount).toBe(3);
    expect(ledger.list()[0]?.requestId).toBe("req-2");
  });
});
