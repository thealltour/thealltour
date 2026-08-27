import { afterEach, describe, expect, it } from "vitest";

import { buildRuntimeStatusWithShared } from "@/ai-runtime/observability/runtime-status";
import {
  createInMemoryRuntimeObservabilitySink,
  createMemoryRuntimeObservabilityRepository,
  createRuntimeObservabilityRecorder,
  resetDefaultRuntimeObservabilityRecorderForTests,
  type RuntimeObservabilityEvent,
} from "@/ai-runtime/observability/persistence";
import { createInMemoryUsageLedger } from "@/ai-runtime/quota/usage-ledger";
import { createInMemoryQuotaBroker } from "@/ai-runtime/quota/quota-broker";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";

describe("ai-runtime observability cross-process simulation", () => {
  afterEach(() => {
    resetDefaultRuntimeObservabilityRecorderForTests();
  });

  it("writer events appear for fresh reader with empty in-memory ledger", async () => {
    const sharedEvents: RuntimeObservabilityEvent[] = [];

    // Writer process
    const writerSink = createInMemoryRuntimeObservabilitySink(sharedEvents);
    const writer = createRuntimeObservabilityRecorder(writerSink);
    writer.jobCompleted({
      requestId: "req-writer-1",
      jobId: "job:writer:1",
      correlationId: "marketing-cron:cross-process:abcd1234",
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      status: "completed",
      attemptCount: 1,
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: "gemini-flash-lite-primary",
      fallbackUsed: false,
      totalTokens: 312,
      metadata: { cronJobId: "daily-marketing-plan" },
    });
    writer.routeCompleted({
      requestId: "req-writer-1",
      correlationId: "marketing-cron:cross-process:abcd1234",
      workload: "content_draft",
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: "gemini-flash-lite-primary",
      attemptCount: 1,
      fallbackUsed: false,
      status: "success",
    });
    writer.providerSuccess({
      requestId: "req-writer-1",
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: "gemini-flash-lite-primary",
      totalTokens: 312,
      usageMissing: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sharedEvents.length).toBe(3);

    // Fresh reader process — empty in-memory execution state
    const freshLedger = createInMemoryUsageLedger();
    const freshBroker = createInMemoryQuotaBroker({ ledger: freshLedger });
    const repository = createMemoryRuntimeObservabilityRepository(sharedEvents);

    const status = await buildRuntimeStatusWithShared({
      ledger: freshLedger,
      quotaBroker: freshBroker,
      repository,
      env: {},
    });

    expect(status.summary.activeReservations).toBe(0);
    expect(status.scheduler).toBeUndefined();
    expect(status.shared?.available).toBe(true);
    expect(status.shared?.lastHour.completed).toBe(1);
    expect(status.shared?.recentJobs.some((job) => job.agentId === "content-strategist")).toBe(
      true,
    );
    expect(status.shared?.recentJobs.some((job) => job.cronJobId === "daily-marketing-plan")).toBe(
      true,
    );
    expect(status.shared?.providerUsage.some((row) => row.tokens === 312)).toBe(true);

    const json = JSON.stringify(status);
    expect(json).not.toMatch(/Bearer |sk-|nvapi-|prompt|messages/i);
  });
});
