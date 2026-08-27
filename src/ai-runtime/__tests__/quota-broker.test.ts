import { afterEach, describe, expect, it } from "vitest";

import { RuntimeError } from "@/ai-runtime/domain/error";
import { AI_MODEL_IDS, AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import { buildRuntimeStatus } from "@/ai-runtime/observability";
import {
  createInMemoryQuotaBroker,
  createInMemoryUsageLedger,
  evaluateReservationCapacity,
  resetDefaultQuotaBrokerForTests,
  resetDefaultUsageLedgerForTests,
  usageEventFromResponse,
} from "@/ai-runtime/quota";
import type { CapacityUsageSnapshot } from "@/ai-runtime/quota/reservation-policy";
import type { RuntimeQuotaState } from "@/ai-runtime/quota/types";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";

const NOW = "2026-08-27T03:00:00.000Z";

function reservationRequest(
  id: string,
  tokens: { input: number; output: number },
  overrides: Partial<{
    providerId: string;
    modelId: string;
  }> = {},
) {
  return {
    requestId: id,
    providerId: overrides.providerId ?? AI_PROVIDER_IDS.GEMINI_MAIN,
    modelId: overrides.modelId ?? AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    estimatedInputTokens: tokens.input,
    estimatedOutputTokens: tokens.output,
  };
}

function sampleResponse(requestId: string, tokens: number): RuntimeResponse {
  return {
    requestId,
    providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
    modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
    content: "ok",
    usage: { inputTokens: tokens, outputTokens: tokens, totalTokens: tokens * 2 },
    latencyMs: 10,
    routing: {
      attempts: [
        {
          providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
          modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
          startedAt: NOW,
          result: "success",
        },
      ],
      fallbackUsed: false,
    },
    rawMetadata: { usageMissing: false },
  };
}

describe("quota broker", () => {
  afterEach(() => {
    resetDefaultUsageLedgerForTests();
    resetDefaultQuotaBrokerForTests();
  });

  it("accepts reservation under unknown quota and tracks active counts", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    const result = await broker.reserve(reservationRequest("req-1", { input: 100, output: 200 }), {
      correlationId: "corr-1",
    });

    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const reservation = broker.getReservation(result.reservationId);
    expect(reservation?.status).toBe("active");
    expect(reservation?.correlationId).toBe("corr-1");
    expect(broker.getReservationSnapshot().activeReservations).toBe(1);
    expect(broker.getReservationSnapshot().reservedTotalTokens).toBe(300);
  });

  it("rejects rpm when actual usage plus active reservations exceed configured limit", async () => {
    const now = new Date(NOW);
    const ledger = createInMemoryUsageLedger({ now: () => now });
    const broker = createInMemoryQuotaBroker({
      ledger,
      now: () => now,
      configuredLimitsOverride: () => ({ rpm: 30 }),
    });

    for (let i = 0; i < 20; i += 1) {
      ledger.record(
        usageEventFromResponse(sampleResponse(`usage-${i}`, 10), {
          completedAt: NOW,
        }),
      );
    }

    const accepted: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const result = await broker.reserve(
        reservationRequest(`req-rpm-${i}`, { input: 10, output: 10 }),
      );
      if (result.accepted) accepted.push(result.reservationId);
    }

    expect(accepted.length).toBe(10);
    const rejected = await broker.reserve(
      reservationRequest("req-rpm-overflow", { input: 10, output: 10 }),
    );
    expect(rejected.accepted).toBe(false);
    if (rejected.accepted) return;
    expect(rejected.reason).toBe("rpm");
  });

  it("rejects tpm when actual tokens plus reservations exceed configured tpm", async () => {
    const now = new Date(NOW);
    const ledger = createInMemoryUsageLedger({ now: () => now });
    const broker = createInMemoryQuotaBroker({
      ledger,
      now: () => now,
      configuredLimitsOverride: () => ({ tpm: 50_000 }),
    });

    ledger.record(
      usageEventFromResponse(
        {
          ...sampleResponse("usage-tpm", 0),
          usage: { inputTokens: 5000, outputTokens: 5000, totalTokens: 10_000 },
        },
        { completedAt: NOW },
      ),
    );

    const first = await broker.reserve(
      reservationRequest("req-tpm-1", { input: 20_000, output: 5_000 }),
    );
    expect(first.accepted).toBe(true);

    const second = await broker.reserve(
      reservationRequest("req-tpm-2", { input: 10_000, output: 10_000 }),
    );
    expect(second.accepted).toBe(false);
    if (second.accepted) return;
    expect(second.reason).toBe("tpm");
  });

  it("rejects disabled groq provider with provider_blocked", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    const result = await broker.reserve(
      reservationRequest("req-groq", { input: 100, output: 100 }, {
        providerId: AI_PROVIDER_IDS.GROQ_MAIN,
        modelId: "missing-model",
      }),
    );

    expect(result.accepted).toBe(false);
    if (result.accepted) return;
    expect(result.reason).toBe("provider_blocked");
  });

  it("expires reservations after ttl and frees provisional capacity", async () => {
    const start = new Date(NOW);
    let now = start.getTime();
    const ledger = createInMemoryUsageLedger({ now: () => new Date(now) });
    const broker = createInMemoryQuotaBroker({
      ledger,
      now: () => new Date(now),
      configuredLimitsOverride: () => ({ rpm: 1 }),
      reservationTtlMs: 1_000,
    });

    const first = await broker.reserve(reservationRequest("req-expire-1", { input: 1, output: 1 }));
    expect(first.accepted).toBe(true);

    const blocked = await broker.reserve(reservationRequest("req-expire-2", { input: 1, output: 1 }));
    expect(blocked.accepted).toBe(false);

    now = start.getTime() + 2_000;
    const afterExpiry = await broker.reserve(
      reservationRequest("req-expire-3", { input: 1, output: 1 }),
    );
    expect(afterExpiry.accepted).toBe(true);
  });

  it("reconciles and releases reservations", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    const reserved = await broker.reserve(reservationRequest("req-rec", { input: 1000, output: 2000 }));
    expect(reserved.accepted).toBe(true);
    if (!reserved.accepted) return;

    await broker.reconcile(reserved.reservationId, {
      inputTokens: 500,
      outputTokens: 700,
      totalTokens: 1200,
      usageMissing: false,
    });

    expect(broker.getReservation(reserved.reservationId)?.status).toBe("reconciled");
    expect(broker.getReservationSnapshot().activeReservations).toBe(0);

    const reserved2 = await broker.reserve(reservationRequest("req-rel", { input: 100, output: 100 }));
    expect(reserved2.accepted).toBe(true);
    if (!reserved2.accepted) return;
    await broker.release(reserved2.reservationId, "cancelled");
    expect(broker.getReservation(reserved2.reservationId)?.status).toBe("released");
  });

  it("reconciles when actual exceeds reservation without failing", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    const reserved = await broker.reserve(reservationRequest("req-over", { input: 1000, output: 1000 }));
    expect(reserved.accepted).toBe(true);
    if (!reserved.accepted) return;

    await broker.reconcile(reserved.reservationId, {
      inputTokens: 7000,
      outputTokens: 7000,
      totalTokens: 14_000,
      usageMissing: false,
    });

    expect(broker.getReservation(reserved.reservationId)?.tokenOverage).toBe(12_000);
  });

  it("returns existing active reservation for duplicate requestId (idempotent)", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });
    const request = reservationRequest("req-dup", { input: 50, output: 50 });

    const first = await broker.reserve(request);
    const second = await broker.reserve(request);

    expect(first.accepted && second.accepted).toBe(true);
    if (!first.accepted || !second.accepted) return;
    expect(second.reservationId).toBe(first.reservationId);
    expect(broker.getReservationSnapshot().activeReservations).toBe(1);
  });

  it("rejects duplicate requestId when parameters differ", async () => {
    const ledger = createInMemoryUsageLedger({ now: () => new Date(NOW) });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => new Date(NOW) });

    await broker.reserve(reservationRequest("req-dup-2", { input: 50, output: 50 }));
    await expect(
      broker.reserve(reservationRequest("req-dup-2", { input: 60, output: 50 })),
    ).rejects.toBeInstanceOf(RuntimeError);
  });

  it("enforces concurrent tpm capacity without over-accepting", async () => {
    const now = new Date(NOW);
    const ledger = createInMemoryUsageLedger({ now: () => now });
    const broker = createInMemoryQuotaBroker({
      ledger,
      now: () => now,
      configuredLimitsOverride: () => ({ tpm: 50_000 }),
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        broker.reserve(
          reservationRequest(`req-concurrent-${index}`, { input: 5000, output: 5000 }),
        ),
      ),
    );

    const acceptedCount = results.filter((result) => result.accepted).length;
    expect(acceptedCount).toBe(5);
  });

  it("blocks reservation when provider blockedUntil is active", async () => {
    const quotaState: RuntimeQuotaState = {
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      health: "blocked",
      minute: { requests: 0, tokensKnown: false },
      day: { requests: 0, tokensKnown: false },
      blockedUntil: "2026-08-27T03:00:30.000Z",
    };

    const snapshot: CapacityUsageSnapshot = {
      minute: {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        rateLimitedCount: 0,
        quotaExhaustedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        knownTokenEventCount: 0,
        usageMissingCount: 0,
      },
      day: {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        rateLimitedCount: 0,
        quotaExhaustedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        knownTokenEventCount: 0,
        usageMissingCount: 0,
      },
      active: {
        activeReservations: 0,
        reservedRequests: 0,
        reservedInputTokens: 0,
        reservedOutputTokens: 0,
        reservedTotalTokens: 0,
      },
      quotaState,
    };

    const decision = evaluateReservationCapacity(
      reservationRequest("req-blocked", { input: 10, output: 10 }),
      snapshot,
      new Date(NOW),
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("provider_blocked");
    expect(decision.retryAfterMs).toBe(30_000);
  });

  it("includes reservation aggregates in runtime status without raw reservation objects", async () => {
    const now = new Date(NOW);
    const ledger = createInMemoryUsageLedger({ now: () => now });
    const broker = createInMemoryQuotaBroker({ ledger, now: () => now });

    await broker.reserve(reservationRequest("req-status", { input: 100, output: 200 }));

    const status = buildRuntimeStatus({ ledger, quotaBroker: broker, now: () => now, env: {} });
    expect(status.summary.activeReservations).toBe(1);

    const gemini = status.providers.find((provider) => provider.id === AI_PROVIDER_IDS.GEMINI_MAIN);
    expect(gemini?.reservation?.reservedTotalTokens).toBe(300);

    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain("req-status");
    expect(serialized).not.toContain("super-secret");
  });
});

describe("reservation policy configured limits", () => {
  it("rejects rpd and input/output tpm independently", () => {
    const baseState: RuntimeQuotaState = {
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      health: "unknown",
      minute: { requests: 0, tokensKnown: false },
      day: { requests: 0, tokensKnown: false },
    };

    const baseSnapshot = (
      configured: CapacityUsageSnapshot["configured"],
      minuteOverrides: Partial<CapacityUsageSnapshot["minute"]> = {},
      dayOverrides: Partial<CapacityUsageSnapshot["day"]> = {},
    ): CapacityUsageSnapshot => ({
      minute: {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        rateLimitedCount: 0,
        quotaExhaustedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        knownTokenEventCount: 0,
        usageMissingCount: 0,
        ...minuteOverrides,
      },
      day: {
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        rateLimitedCount: 0,
        quotaExhaustedCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        knownTokenEventCount: 0,
        usageMissingCount: 0,
        ...dayOverrides,
      },
      active: {
        activeReservations: 0,
        reservedRequests: 0,
        reservedInputTokens: 0,
        reservedOutputTokens: 0,
        reservedTotalTokens: 0,
      },
      quotaState: baseState,
      configured,
    });

    const rpdReject = evaluateReservationCapacity(
      reservationRequest("rpd", { input: 1, output: 1 }),
      baseSnapshot({ rpd: 5 }, {}, { requestCount: 5 }),
      new Date(NOW),
    );
    expect(rpdReject.allowed).toBe(false);
    expect(rpdReject.reason).toBe("rpd");

    const inputTpmReject = evaluateReservationCapacity(
      reservationRequest("input-tpm", { input: 100, output: 1 }),
      baseSnapshot({ inputTpm: 100 }, { inputTokens: 50 }),
      new Date(NOW),
    );
    expect(inputTpmReject.allowed).toBe(false);
    expect(inputTpmReject.reason).toBe("tpm");
  });
});
