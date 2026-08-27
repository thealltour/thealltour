import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import {
  createRuntimeExecutor,
  createRuntimeRequest,
  resetDefaultRuntimeExecutorForTests,
  initializeDefaultRuntimeExecutor,
  getDefaultRuntimeExecutor,
} from "@/ai-runtime/integration";
import { createRuntimeScheduler } from "@/ai-runtime/scheduler";
import type { RuntimeRouter } from "@/ai-runtime/router";

const NOW = "2026-08-27T03:00:00.000Z";

function sampleRequest(id: string): RuntimeRequest {
  return createRuntimeRequest(
    {
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      priority: "background",
      messages: [{ role: "user", content: "Draft content." }],
      correlationId: "corr-exec-1",
      cronJobId: "daily-plan",
    },
    { now: () => new Date(NOW), createRequestId: () => id },
  );
}

describe("RuntimeExecutor", () => {
  afterEach(() => {
    resetDefaultRuntimeExecutorForTests();
    vi.restoreAllMocks();
  });

  it("submits to scheduler exactly once", async () => {
    const enqueue = vi.fn(async (request: RuntimeRequest) => ({
      id: `job:${request.id}:1`,
      request,
      status: "queued" as const,
      queuedAt: NOW,
      attempts: 0,
    }));

    const scheduler = {
      enqueue,
      runNext: vi.fn(),
      runAvailable: vi.fn(),
      cancel: vi.fn(),
      getJob: vi.fn(),
      listJobs: vi.fn(),
      snapshot: vi.fn(),
      runningCount: vi.fn(),
    };

    const executor = createRuntimeExecutor({ scheduler });
    const request = sampleRequest("req-exec-1");
    const submission = await executor.submit(request);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(request);
    expect(submission).toEqual({
      jobId: "job:req-exec-1:1",
      requestId: "req-exec-1",
      status: "queued",
    });
  });

  it("returns existing submission for duplicate request id via scheduler idempotency", async () => {
    const route = vi.fn();
    const scheduler = createRuntimeScheduler({
      router: { route } as RuntimeRouter,
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(NOW),
    });
    const executor = createRuntimeExecutor({ scheduler });
    const request = sampleRequest("req-dup-exec");

    const first = await executor.submit(request);
    const second = await executor.submit(request);

    expect(first.jobId).toBe(second.jobId);
    expect(route).not.toHaveBeenCalled();
  });

  it("getSubmission reflects scheduler job status", async () => {
    const scheduler = createRuntimeScheduler({
      router: { route: vi.fn() },
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(NOW),
    });
    const executor = createRuntimeExecutor({ scheduler });
    const request = sampleRequest("req-get-sub");
    const submission = await executor.submit(request);

    expect(executor.getSubmission(submission.jobId)).toEqual(submission);
  });

  it("supports default executor singleton foundation", async () => {
    const scheduler = createRuntimeScheduler({
      router: { route: vi.fn() },
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(NOW),
    });
    initializeDefaultRuntimeExecutor({ scheduler });
    const executor = getDefaultRuntimeExecutor();
    const submission = await executor.submit(sampleRequest("req-default-exec"));
    expect(submission.requestId).toBe("req-default-exec");
  });

  it("does not expose provider or credential fields in submission", async () => {
    const scheduler = createRuntimeScheduler({
      router: { route: vi.fn() },
      context: { credentialResolver: { resolve: async () => "super-secret-key" } },
      now: () => new Date(NOW),
    });
    const executor = createRuntimeExecutor({ scheduler });
    const submission = await executor.submit(sampleRequest("req-safe-exec"));
    const serialized = JSON.stringify(submission);
    expect(serialized).not.toContain("super-secret-key");
    expect(serialized).not.toMatch(/provider/i);
  });
});

describe("integration layer import boundary", () => {
  it("integration index does not re-export adapter internals", async () => {
    const integration = await import("@/ai-runtime/integration");
    expect(integration).not.toHaveProperty("getProviderAdapter");
    expect(integration).not.toHaveProperty("createFallbackRuntimeRouter");
  });
});
