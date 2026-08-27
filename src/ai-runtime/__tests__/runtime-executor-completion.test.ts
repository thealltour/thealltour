import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  createRuntimeExecutor,
  createRuntimeRequest,
  DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS,
} from "@/ai-runtime/integration";
import { createRuntimeScheduler } from "@/ai-runtime/scheduler";
import type { RuntimeRouter } from "@/ai-runtime/router";

const NOW = "2026-08-27T03:00:00.000Z";
let nowMs = Date.parse(NOW);

function tick(ms: number): void {
  nowMs += ms;
}

function sampleRequest(id: string): RuntimeRequest {
  return createRuntimeRequest(
    {
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      priority: "background",
      messages: [{ role: "user", content: "Draft content." }],
    },
    { now: () => new Date(nowMs), createRequestId: () => id },
  );
}

describe("RuntimeExecutor completion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nowMs = Date.parse(NOW);
  });

  it("executeAndWait returns completed response after scheduler pump", async () => {
    const route = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => ({
      requestId: request.id,
      providerId: "gemini-main",
      modelId: "gemini-flash-lite-primary",
      content: '{"body":"ok"}',
      usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
      latencyMs: 12,
      routing: { attempts: [], fallbackUsed: false },
    }));

    const scheduler = createRuntimeScheduler({
      router: { route } as RuntimeRouter,
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(nowMs),
    });
    const executor = createRuntimeExecutor({
      scheduler,
      sleep: async () => {
        tick(10);
      },
    });

    const result = await executor.executeAndWait(sampleRequest("req-complete-1"), {
      now: () => new Date(nowMs),
      pollIntervalMs: 1,
    });

    expect(result.status).toBe("completed");
    expect(result.response?.content).toBe('{"body":"ok"}');
    expect(route).toHaveBeenCalledTimes(1);
  });

  it("awaitCompletion returns failed result for non-retryable errors", async () => {
    const route = vi.fn(async () => {
      throw new RuntimeError("INVALID_REQUEST", "bad", false);
    });

    const scheduler = createRuntimeScheduler({
      router: { route } as RuntimeRouter,
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(nowMs),
    });
    const executor = createRuntimeExecutor({
      scheduler,
      sleep: async () => {
        tick(5);
      },
    });

    const submission = await executor.submit(sampleRequest("req-fail-1"));
    const result = await executor.awaitCompletion(submission, {
      now: () => new Date(nowMs),
      pollIntervalMs: 1,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("INVALID_REQUEST");
    expect(result.error?.retryable).toBe(false);
  });

  it("awaitCompletion eventually completes after scheduler defer", async () => {
    let calls = 0;
    const route = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => {
      calls += 1;
      if (calls === 1) {
        throw new RuntimeError("QUOTA_EXHAUSTED", "quota", true, 30);
      }
      return {
        requestId: request.id,
        providerId: "openrouter-main",
        modelId: "openrouter-free",
        content: "done",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        latencyMs: 5,
        routing: { attempts: [], fallbackUsed: false },
      };
    });

    const scheduler = createRuntimeScheduler({
      router: { route } as RuntimeRouter,
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(nowMs),
      maxAttempts: 5,
    });
    const executor = createRuntimeExecutor({
      scheduler,
      sleep: async (ms) => {
        tick(ms);
      },
    });

    const result = await executor.executeAndWait(sampleRequest("req-defer-complete"), {
      now: () => new Date(nowMs),
      pollIntervalMs: 5,
      timeoutMs: 120_000,
    });

    expect(result.status).toBe("completed");
    expect(result.response?.content).toBe("done");
    expect(route).toHaveBeenCalledTimes(2);
  });

  it("times out when job never reaches terminal state", async () => {
    const route = vi.fn(async () => {
      throw new RuntimeError("QUOTA_EXHAUSTED", "quota", true, 600_000);
    });

    const scheduler = createRuntimeScheduler({
      router: { route } as RuntimeRouter,
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(nowMs),
      maxAttempts: 5,
    });
    const executor = createRuntimeExecutor({
      scheduler,
      sleep: async (ms) => {
        tick(ms);
      },
    });

    const result = await executor.executeAndWait(sampleRequest("req-timeout"), {
      now: () => new Date(nowMs),
      pollIntervalMs: 10,
      timeoutMs: 50,
    });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("TIMEOUT");
    expect(result.error?.retryable).toBe(true);
  });

  it("does not duplicate router execution for a single executeAndWait", async () => {
    const route = vi.fn(async (request: RuntimeRequest): Promise<RuntimeResponse> => ({
      requestId: request.id,
      providerId: "nvidia-main",
      modelId: "nvidia-nemotron-3-ultra",
      content: "once",
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      latencyMs: 1,
      routing: { attempts: [], fallbackUsed: false },
    }));

    const scheduler = createRuntimeScheduler({
      router: { route } as RuntimeRouter,
      context: { credentialResolver: { resolve: async () => "k" } },
      now: () => new Date(nowMs),
    });
    const executor = createRuntimeExecutor({
      scheduler,
      sleep: async () => {
        tick(1);
      },
    });

    await executor.executeAndWait(sampleRequest("req-once"), {
      now: () => new Date(nowMs),
      pollIntervalMs: 1,
    });

    expect(route).toHaveBeenCalledTimes(1);
  });

  it("uses default completion timeout aligned with marketing cron", () => {
    expect(DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS).toBe(180_000);
  });
});
