import { afterEach, describe, expect, it } from "vitest";

import {
  createCronRuntimeRequest,
  createDepartmentRuntimeRequest,
  createHandoffRuntimeRequest,
  createInteractiveRuntimeRequest,
  createRuntimeRequest,
} from "@/ai-runtime/integration";

const FIXED_NOW = "2026-08-27T03:00:00.000Z";
const FIXED_ID = "req-factory-test-1";

describe("RuntimeRequestFactory", () => {
  it("creates a normalized RuntimeRequest with required fields", () => {
    const request = createRuntimeRequest(
      {
        agentId: "content-strategist",
        source: "cron",
        workload: "content_draft",
        priority: "background",
        messages: [
          { role: "system", content: "You are Content Strategist." },
          { role: "user", content: "Draft a Threads post." },
        ],
      },
      {
        now: () => new Date(FIXED_NOW),
        createRequestId: () => FIXED_ID,
      },
    );

    expect(request).toEqual({
      id: FIXED_ID,
      createdAt: FIXED_NOW,
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      priority: "background",
      messages: [
        { role: "system", content: "You are Content Strategist." },
        { role: "user", content: "Draft a Threads post." },
      ],
      metadata: undefined,
      expectedOutputTokens: undefined,
      deadlineAt: undefined,
      routing: undefined,
    });
    expect(request).not.toHaveProperty("providerId");
    expect(request).not.toHaveProperty("modelId");
  });

  it("maps correlation and orchestration metadata", () => {
    const request = createRuntimeRequest(
      {
        agentId: "marketing-manager",
        source: "department-orchestrator",
        workload: "manager_decision",
        priority: "high",
        messages: [{ role: "user", content: "Plan next week." }],
        correlationId: "corr-org-1",
        parentRequestId: "req-parent-1",
        departmentId: "marketing",
        handoffId: "handoff-1",
        cronJobId: "cron-9am",
        roomId: "room-desktop-1",
        conversationId: "conv-1",
      },
      { now: () => new Date(FIXED_NOW), createRequestId: () => FIXED_ID },
    );

    expect(request.metadata).toEqual({
      correlationId: "corr-org-1",
      parentRequestId: "req-parent-1",
      departmentId: "marketing",
      handoffId: "handoff-1",
      cronJobId: "cron-9am",
      roomId: "room-desktop-1",
      conversationId: "conv-1",
    });
  });

  it("createCronRuntimeRequest defaults source=cron and priority=background", () => {
    const request = createCronRuntimeRequest(
      {
        agentId: "governance-auditor",
        workload: "governance",
        messages: [{ role: "user", content: "Review draft." }],
        cronJobId: "daily-plan-9am",
      },
      { createRequestId: () => FIXED_ID },
    );

    expect(request.source).toBe("cron");
    expect(request.priority).toBe("background");
    expect(request.metadata?.cronJobId).toBe("daily-plan-9am");
  });

  it("createHandoffRuntimeRequest defaults source=agent-handoff", () => {
    const request = createHandoffRuntimeRequest(
      {
        agentId: "content-strategist",
        workload: "content_draft",
        priority: "normal",
        messages: [{ role: "user", content: "Draft from handoff." }],
        handoffId: "h-123",
        correlationId: "corr-handoff",
      },
      { createRequestId: () => FIXED_ID },
    );

    expect(request.source).toBe("agent-handoff");
    expect(request.metadata?.handoffId).toBe("h-123");
  });

  it("createDepartmentRuntimeRequest defaults source=department-orchestrator", () => {
    const request = createDepartmentRuntimeRequest(
      {
        agentId: "performance-analyst",
        workload: "analysis",
        priority: "normal",
        messages: [{ role: "user", content: "Analyze metrics." }],
        departmentId: "marketing",
      },
      { createRequestId: () => FIXED_ID },
    );

    expect(request.source).toBe("department-orchestrator");
    expect(request.metadata?.departmentId).toBe("marketing");
  });

  it("createInteractiveRuntimeRequest preserves caller priority", () => {
    const request = createInteractiveRuntimeRequest(
      {
        agentId: "marketing-manager",
        source: "desktop",
        workload: "reasoning",
        priority: "high",
        messages: [{ role: "user", content: "Desktop question." }],
        roomId: "room-1",
      },
      { createRequestId: () => FIXED_ID },
    );

    expect(request.source).toBe("desktop");
    expect(request.priority).toBe("high");
    expect(request.metadata?.roomId).toBe("room-1");
  });

  it("rejects empty messages", () => {
    expect(() =>
      createRuntimeRequest({
        agentId: "marketing-manager",
        source: "cron",
        workload: "classification",
        priority: "normal",
        messages: [],
      }),
    ).toThrow(/at least one message/i);
  });

  it("does not accept credentials or provider fields", () => {
    const request = createRuntimeRequest(
      {
        agentId: "marketing-manager",
        source: "cron",
        workload: "classification",
        priority: "normal",
        messages: [{ role: "user", content: "test" }],
      },
      { createRequestId: () => FIXED_ID },
    );

    const serialized = JSON.stringify(request);
    expect(serialized).not.toMatch(/api[_-]?key/i);
    expect(serialized).not.toContain("OPENROUTER_API_KEY");
    expect(serialized).not.toContain("GEMINI_API_KEY");
  });
});

describe("RuntimeRequestFactory id policy", () => {
  afterEach(() => {
    // no global state
  });

  it("generates a new request id on each call by default", () => {
    const a = createRuntimeRequest({
      agentId: "marketing-manager",
      source: "cron",
      workload: "classification",
      priority: "normal",
      messages: [{ role: "user", content: "a" }],
    });
    const b = createRuntimeRequest({
      agentId: "marketing-manager",
      source: "cron",
      workload: "classification",
      priority: "normal",
      messages: [{ role: "user", content: "b" }],
    });

    expect(a.id).not.toBe(b.id);
  });
});
