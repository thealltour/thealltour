import { describe, expect, it } from "vitest";

import {
  aggregateLastHourSummary,
  aggregateProviderUsage,
  aggregateRecentJobs,
  aggregateRecentRoutes,
  createMemoryRuntimeObservabilityRepository,
  type RuntimeObservabilityEvent,
} from "@/ai-runtime/observability/persistence";
import { AI_PROVIDER_IDS } from "@/ai-runtime/registry";

function event(
  partial: Partial<RuntimeObservabilityEvent> & Pick<RuntimeObservabilityEvent, "eventType">,
): RuntimeObservabilityEvent {
  return {
    occurredAt: new Date().toISOString(),
    ...partial,
  };
}

describe("ai-runtime observability repository", () => {
  const now = new Date("2026-08-27T06:00:00.000Z");

  const events: RuntimeObservabilityEvent[] = [
    event({
      eventType: "job_completed",
      occurredAt: "2026-08-27T05:30:00.000Z",
      jobId: "job:1",
      requestId: "req-cs",
      correlationId: "marketing-cron:2026-08-27T05:29:43.507Z:73b729ad",
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      status: "completed",
      attemptCount: 1,
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: "gemini-flash-lite-primary",
      fallbackUsed: false,
      totalTokens: 200,
      metadata: { cronJobId: "daily-marketing-plan" },
    }),
    event({
      eventType: "job_failed",
      occurredAt: "2026-08-27T05:40:00.000Z",
      jobId: "job:2",
      requestId: "req-fail",
      agentId: "content-strategist",
      source: "cron",
      status: "failed",
      errorCode: "QUOTA_EXHAUSTED",
    }),
    event({
      eventType: "route_completed",
      occurredAt: "2026-08-27T05:30:01.000Z",
      requestId: "req-cs",
      workload: "content_draft",
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: "gemini-flash-lite-primary",
      attemptCount: 1,
      fallbackUsed: false,
      status: "success",
    }),
    event({
      eventType: "route_failed",
      occurredAt: "2026-08-27T05:41:00.000Z",
      requestId: "req-fail",
      attemptCount: 3,
      fallbackUsed: true,
      status: "failed",
      errorCode: "QUOTA_EXHAUSTED",
    }),
    event({
      eventType: "provider_success",
      occurredAt: "2026-08-27T05:30:00.500Z",
      providerId: AI_PROVIDER_IDS.GEMINI_MAIN,
      modelId: "gemini-flash-lite-primary",
      totalTokens: 200,
      usageMissing: false,
    }),
    event({
      eventType: "provider_success",
      occurredAt: "2026-08-27T05:31:00.000Z",
      providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
      usageMissing: true,
      totalTokens: 9999,
    }),
    event({
      eventType: "provider_error",
      occurredAt: "2026-08-27T05:32:00.000Z",
      providerId: AI_PROVIDER_IDS.NVIDIA_MAIN,
      errorCode: "PROVIDER_ERROR",
    }),
  ];

  it("computes last hour summary", () => {
    const summary = aggregateLastHourSummary(events, now);
    expect(summary.requests).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.fallbacks).toBe(1);
    expect(summary.providerCalls).toBe(3);
  });

  it("aggregates provider usage and excludes usageMissing tokens", () => {
    const usage = aggregateProviderUsage(events, now);
    const gemini = usage.find((row) => row.providerId === AI_PROVIDER_IDS.GEMINI_MAIN);
    const openrouter = usage.find((row) => row.providerId === AI_PROVIDER_IDS.OPENROUTER_MAIN);
    const nvidia = usage.find((row) => row.providerId === AI_PROVIDER_IDS.NVIDIA_MAIN);

    expect(gemini?.requests).toBe(1);
    expect(gemini?.tokens).toBe(200);
    expect(gemini?.tokensKnown).toBe(true);

    expect(openrouter?.usageMissingCount).toBe(1);
    expect(openrouter?.tokensKnown).toBe(false);
    expect(openrouter?.tokens).toBeUndefined();

    expect(nvidia?.errors).toBe(1);
  });

  it("returns recent jobs and routes", () => {
    const jobs = aggregateRecentJobs(events, 10);
    const routes = aggregateRecentRoutes(events, 10);
    expect(jobs[0]?.status).toBe("failed");
    expect(jobs.some((job) => job.cronJobId === "daily-marketing-plan")).toBe(true);
    expect(jobs.some((job) => job.correlationShort?.includes("…"))).toBe(true);
    expect(routes.some((route) => route.fallbackUsed)).toBe(true);
  });

  it("memory repository loadSharedTelemetry", async () => {
    const repo = createMemoryRuntimeObservabilityRepository(events);
    const shared = await repo.loadSharedTelemetry(now);
    expect(shared.available).toBe(true);
    expect(shared.lastHour.completed).toBe(1);
    expect(shared.providerUsage.length).toBeGreaterThan(0);
    expect(shared.recentJobs.length).toBeGreaterThan(0);
    expect(shared.recentRoutes.length).toBeGreaterThan(0);
  });
});
