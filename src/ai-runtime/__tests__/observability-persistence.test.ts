import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildSafeMetadata,
  createInMemoryRuntimeObservabilitySink,
  createNoopRuntimeObservabilitySink,
  createPostgresRuntimeObservabilitySink,
  createRuntimeObservabilityRecorder,
  createRuntimeObservabilitySink,
  resetDefaultRuntimeObservabilityRecorderForTests,
} from "@/ai-runtime/observability/persistence";

describe("ai-runtime observability persistence", () => {
  afterEach(() => {
    resetDefaultRuntimeObservabilityRecorderForTests();
  });

  it("records events into memory sink", async () => {
    const sink = createInMemoryRuntimeObservabilitySink();
    const recorder = createRuntimeObservabilityRecorder(sink);
    recorder.jobCompleted({
      requestId: "req-1",
      jobId: "job-1",
      agentId: "content-strategist",
      source: "cron",
      status: "completed",
    });
    await vi.waitFor(() => expect(sink.events.length).toBe(1));
    expect(sink.events[0]?.eventType).toBe("job_completed");
    expect(sink.events[0]?.requestId).toBe("req-1");
  });

  it("strips unsafe metadata keys", () => {
    const safe = buildSafeMetadata({
      cronJobId: "daily-marketing-plan",
      prompt: "SECRET PROMPT",
      messages: [{ role: "user", content: "x" }],
      headers: { Authorization: "Bearer x" },
      response: "full text",
      deferReason: "quota",
    });
    expect(safe).toEqual({
      cronJobId: "daily-marketing-plan",
      deferReason: "quota",
    });
  });

  it("isolates persistence failures from callers", async () => {
    const sink = {
      record: vi.fn(async () => {
        throw new Error("db down");
      }),
    };
    const recorder = createRuntimeObservabilityRecorder(sink);
    expect(() =>
      recorder.providerSuccess({
        requestId: "req-2",
        providerId: "gemini-main",
        modelId: "gemini-flash-lite-primary",
      }),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sink.record).toHaveBeenCalled();
  });

  it("noop sink accepts records silently", async () => {
    const sink = createNoopRuntimeObservabilitySink();
    await expect(
      sink.record({ eventType: "job_enqueued", requestId: "r" }),
    ).resolves.toBeUndefined();
  });

  it("disabled flag returns noop sink", async () => {
    const sink = createRuntimeObservabilitySink({
      env: { AI_RUNTIME_SHARED_OBSERVABILITY_ENABLED: "false" },
    });
    await sink.record({ eventType: "route_completed", requestId: "r" });
    // noop — no throw
  });

  it("postgres sink swallows insert errors", async () => {
    const onError = vi.fn();
    const sink = createPostgresRuntimeObservabilitySink({
      client: {
        from: () => ({
          insert: async () => ({ error: { message: "insert failed" } }),
          select: () => ({
            gte: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      },
      onError,
    });
    await sink.record({ eventType: "provider_success", providerId: "nvidia-main" });
    expect(onError).toHaveBeenCalledWith("insert failed");
  });
});
