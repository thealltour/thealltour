import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import { RuntimeError } from "@/ai-runtime/domain/error";
import { AI_MODEL_IDS, AI_PROVIDER_IDS } from "@/ai-runtime/registry";
import {
  createRuntimeScheduler,
  MAX_CONCURRENT_RUNTIME_JOBS,
  resetDefaultRuntimeSchedulerForTests,
} from "@/ai-runtime/scheduler";
import { buildRuntimeStatus } from "@/ai-runtime/observability";
import type { RuntimeRouter } from "@/ai-runtime/router";
import type { ProviderExecutionContext } from "@/ai-runtime/adapters/types";

const NOW = "2026-08-27T03:00:00.000Z";
let nowMs = Date.parse(NOW);

function tick(ms: number): void {
  nowMs += ms;
}

function sampleRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    id: `req-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date(nowMs).toISOString(),
    agentId: "performance-analyst",
    source: "cron",
    workload: "analysis",
    priority: "background",
    messages: [{ role: "user", content: "Analyze weekly metrics." }],
    ...overrides,
  };
}

function successResponse(request: RuntimeRequest): RuntimeResponse {
  return {
    requestId: request.id,
    providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
    modelId: AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
    content: "analysis complete",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    latencyMs: 20,
    routing: {
      attempts: [
        {
          providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
          modelId: AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B,
          startedAt: new Date(nowMs).toISOString(),
          result: "success",
        },
      ],
      fallbackUsed: false,
    },
    rawMetadata: { usageMissing: false },
  };
}

describe("RuntimeScheduler", () => {
  afterEach(() => {
    resetDefaultRuntimeSchedulerForTests();
    vi.restoreAllMocks();
    nowMs = Date.parse(NOW);
  });

  const context: ProviderExecutionContext = {
    credentialResolver: { resolve: async () => "test-key" },
  };

  function createScheduler(router: RuntimeRouter) {
    return createRuntimeScheduler({
      router,
      context,
      now: () => new Date(nowMs),
      maxConcurrentJobs: MAX_CONCURRENT_RUNTIME_JOBS,
      maxAttempts: 5,
    });
  }

  it("enqueue → runNext completes job and calls router once", async () => {
    const route = vi.fn(async (request: RuntimeRequest) => successResponse(request));
    const scheduler = createScheduler({ route });

    const request = sampleRequest({ id: "req-success-1", priority: "normal" });
    const enqueued = await scheduler.enqueue(request);
    expect(enqueued.status).toBe("queued");

    const result = await scheduler.runNext();
    expect(result?.status).toBe("completed");
    expect(result?.attempts).toBe(1);
    expect(route).toHaveBeenCalledTimes(1);
    expect(route).toHaveBeenCalledWith(request, context);
  });

  it("defers retryable QUOTA_EXHAUSTED with retryAfterMs", async () => {
    const route = vi.fn(async () => {
      throw new RuntimeError("QUOTA_EXHAUSTED", "all exhausted", true, 30_000);
    });
    const scheduler = createScheduler({ route });

    const request = sampleRequest({ id: "req-defer-1" });
    await scheduler.enqueue(request);

    const first = await scheduler.runNext();
    expect(first?.status).toBe("queued");
    expect(first?.attempts).toBe(1);
    expect(first?.availableAt).toBe("2026-08-27T03:00:30.000Z");
    expect(first?.deferReason).toBe("quota");

    const blocked = await scheduler.runNext();
    expect(blocked).toBeUndefined();

    tick(30_000);
    const second = await scheduler.runNext();
    expect(second?.attempts).toBe(2);
    expect(route).toHaveBeenCalledTimes(2);
  });

  it("fails non-retryable AUTH_ERROR without re-queueing", async () => {
    const route = vi.fn(async () => {
      throw new RuntimeError("AUTH_ERROR", "invalid", false);
    });
    const scheduler = createScheduler({ route });

    await scheduler.enqueue(sampleRequest({ id: "req-auth-fail" }));
    const result = await scheduler.runNext();

    expect(result?.status).toBe("failed");
    expect(result?.lastErrorCode).toBe("AUTH_ERROR");
    expect(await scheduler.runNext()).toBeUndefined();
    expect(route).toHaveBeenCalledTimes(1);
  });

  it("fails after max attempts", async () => {
    const route = vi.fn(async () => {
      throw new RuntimeError("TIMEOUT", "timeout", true);
    });
    const scheduler = createRuntimeScheduler({
      router: { route },
      context,
      now: () => new Date(nowMs),
      maxAttempts: 3,
    });

    await scheduler.enqueue(sampleRequest({ id: "req-max-attempts" }));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      tick(60_000);
      const job = await scheduler.runNext();
      expect(job?.status).toBe(attempt === 2 ? "failed" : "queued");
    }

    expect(route).toHaveBeenCalledTimes(3);
  });

  it("returns existing active job for duplicate requestId enqueue", async () => {
    const route = vi.fn(async (request: RuntimeRequest) => successResponse(request));
    const scheduler = createScheduler({ route });

    const request = sampleRequest({ id: "req-dup-1" });
    const first = await scheduler.enqueue(request);
    const second = await scheduler.enqueue(request);

    expect(second.id).toBe(first.id);
    expect(scheduler.listJobs().length).toBe(1);
  });

  it("cancels queued job without router invocation", async () => {
    const route = vi.fn(async (request: RuntimeRequest) => successResponse(request));
    const scheduler = createScheduler({ route });

    const request = sampleRequest({ id: "req-cancel-1" });
    const enqueued = await scheduler.enqueue(request);
    await scheduler.cancel(enqueued.id);

    expect(await scheduler.runNext()).toBeUndefined();
    expect(route).not.toHaveBeenCalled();
    expect(scheduler.getJob(enqueued.id)?.status).toBe("cancelled");
  });

  it("runs high-priority interactive job before background cron jobs", async () => {
    const order: string[] = [];
    const route = vi.fn(async (request: RuntimeRequest) => {
      order.push(request.id);
      return successResponse(request);
    });
    const scheduler = createScheduler({ route });

    await scheduler.enqueue(
      sampleRequest({ id: "req-bg-1", priority: "background", source: "cron" }),
    );
    await scheduler.enqueue(
      sampleRequest({ id: "req-bg-2", priority: "background", source: "cron" }),
    );
    await scheduler.enqueue(
      sampleRequest({
        id: "req-high-1",
        priority: "high",
        source: "desktop",
        workload: "reasoning",
      }),
    );

    await scheduler.runAvailable({ limit: 3 });

    expect(order[0]).toBe("req-high-1");
  });

  it("limits concurrent router executions", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const route = vi.fn(
      () =>
        new Promise<RuntimeResponse>((resolve) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          setTimeout(() => {
            inFlight -= 1;
            resolve(
              successResponse({
                id: "req-concurrency",
                createdAt: NOW,
                agentId: "performance-analyst",
                source: "cron",
                workload: "analysis",
                priority: "background",
                messages: [{ role: "user", content: "x" }],
              }),
            );
          }, 10);
        }),
    );

    const scheduler = createScheduler({ route });

    for (let index = 0; index < 20; index += 1) {
      await scheduler.enqueue(
        sampleRequest({ id: `req-concurrency-${index}`, priority: "background" }),
      );
    }

    await scheduler.runAvailable({ limit: 20 });

    expect(maxInFlight).toBeLessThanOrEqual(MAX_CONCURRENT_RUNTIME_JOBS);
    expect(route.mock.calls.length).toBe(20);
  });

  it("exposes scheduler snapshot without prompt content", async () => {
    const route = vi.fn(async (request: RuntimeRequest) => successResponse(request));
    const scheduler = createScheduler({ route });

    const request = sampleRequest({
      id: "req-obs-1",
      messages: [{ role: "user", content: "super-secret-prompt-content" }],
    });
    await scheduler.enqueue(request);
    await scheduler.runNext();

    const status = buildRuntimeStatus({
      env: {},
      now: () => new Date(nowMs),
      scheduler,
    });

    expect(status.scheduler).toMatchObject({
      queued: 0,
      running: 0,
      completedLastHour: 1,
    });
    expect(status.scheduler?.recent[0]).toMatchObject({
      jobId: expect.any(String),
      agentId: "performance-analyst",
      workload: "analysis",
      status: "completed",
    });

    const serialized = JSON.stringify(status.scheduler);
    expect(serialized).not.toContain("super-secret-prompt-content");
    expect(serialized).not.toContain("Analyze weekly metrics");
  });
});
