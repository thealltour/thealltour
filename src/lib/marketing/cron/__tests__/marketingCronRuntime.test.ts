vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import { MAX_AUTO_REVISION_ROUNDS } from "@/lib/marketing/bot/organization/envelope";
import { runDepartmentPipeline } from "@/lib/marketing/bot/organization/pipeline";
import type { ContentStrategistOutput, GovernanceReviewResult } from "@/lib/marketing/bot/organization/handoffs";
import {
  MARKETING_CRON_JOB_ID,
  MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS,
  buildContentDraftPrompt,
  buildGovernanceReviewPrompt,
} from "@/lib/marketing/cron/marketingPlanSpecialists";
import {
  createMarketingPlanPipelineDispatch,
  isAiRuntimeMarketingCronEnabled,
} from "@/lib/marketing/cron/marketingCronRuntime";

const PRODUCT = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";
const CORRELATION = "marketing-cron:test-run";

const draftJson = JSON.stringify({
  title: "제목",
  body: "본문",
  channel: "threads",
  agenda: null,
  sourceReferences: [],
});

const governanceAllowJson = JSON.stringify({
  decision: "ALLOW",
  riskScore: 0,
  reasons: [],
  revisionHints: [],
  humanApprovalRequired: false,
  semanticAvailable: true,
});

describe("marketing cron runtime feature flag", () => {
  it("defaults to disabled", () => {
    expect(isAiRuntimeMarketingCronEnabled({})).toBe(false);
    expect(isAiRuntimeMarketingCronEnabled({ AI_RUNTIME_MARKETING_CRON_ENABLED: "false" })).toBe(false);
    expect(isAiRuntimeMarketingCronEnabled({ AI_RUNTIME_MARKETING_CRON_ENABLED: "true" })).toBe(true);
  });
});

describe("marketing cron runtime dispatch", () => {
  it("documents that cron specialists do not use Hermes tools", () => {
    expect(MARKETING_CRON_SPECIALIST_USES_HERMES_TOOLS).toBe(false);
    expect(buildContentDraftPrompt).toBeTypeOf("function");
    expect(buildGovernanceReviewPrompt).toBeTypeOf("function");
  });

  it("uses RuntimeExecutor for content and governance when enabled", async () => {
    const executeAndWait = vi
      .fn()
      .mockResolvedValueOnce({
        status: "completed",
        requestId: "req-draft",
        response: { content: draftJson },
      })
      .mockResolvedValueOnce({
        status: "completed",
        requestId: "req-gov",
        response: { content: governanceAllowJson },
      });

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: true,
      correlationId: CORRELATION,
      executor: { executeAndWait },
      now: () => new Date("2026-08-27T03:00:00.000Z"),
    });

    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      dispatch,
    );

    expect(result.status).toBe("publish_ready");
    expect(executeAndWait).toHaveBeenCalledTimes(2);
    expect(executeAndWait.mock.calls[0]?.[0]).toMatchObject({
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      priority: "background",
      metadata: {
        correlationId: CORRELATION,
        cronJobId: MARKETING_CRON_JOB_ID,
        departmentId: "marketing",
      },
      routing: { requiresStructuredOutput: true },
    });
    const draftRequestId = executeAndWait.mock.calls[0]?.[0]?.id;
    expect(executeAndWait.mock.calls[1]?.[0]).toMatchObject({
      agentId: "governance-auditor",
      workload: "governance",
      priority: "high",
      metadata: {
        correlationId: CORRELATION,
        cronJobId: MARKETING_CRON_JOB_ID,
        parentRequestId: draftRequestId,
      },
    });
  });

  it("shares correlationId and parentRequestId across revision round", async () => {
    const blockJson = JSON.stringify({
      decision: "BLOCK",
      riskScore: 0.8,
      reasons: ["EXACT_DUPLICATE"],
      revisionHints: ["hook 변경"],
      humanApprovalRequired: false,
      semanticAvailable: true,
    });

    const executeAndWait = vi
      .fn()
      .mockResolvedValueOnce({ status: "completed", requestId: "req-draft-1", response: { content: draftJson } })
      .mockResolvedValueOnce({ status: "completed", requestId: "req-gov-1", response: { content: blockJson } })
      .mockResolvedValueOnce({ status: "completed", requestId: "req-draft-2", response: { content: draftJson } })
      .mockResolvedValueOnce({ status: "completed", requestId: "req-gov-2", response: { content: governanceAllowJson } });

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: true,
      correlationId: CORRELATION,
      executor: { executeAndWait },
    });

    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      dispatch,
    );

    expect(result.revisionRounds).toBe(1);
    expect(executeAndWait).toHaveBeenCalledTimes(2 + MAX_AUTO_REVISION_ROUNDS * 2);
    for (const call of executeAndWait.mock.calls) {
      expect(call[0]?.metadata?.correlationId).toBe(CORRELATION);
    }
    const draft1Id = executeAndWait.mock.calls[0]?.[0]?.id;
    const gov1Id = executeAndWait.mock.calls[1]?.[0]?.id;
    expect(executeAndWait.mock.calls[1]?.[0]?.metadata?.parentRequestId).toBe(draft1Id);
    expect(executeAndWait.mock.calls[2]?.[0]?.metadata?.parentRequestId).toBe(gov1Id);
  });

  it("uses Hermes invoker when runtime flag is disabled", async () => {
    const invokeHermesProfile = vi
      .fn()
      .mockReturnValueOnce(draftJson)
      .mockReturnValueOnce(governanceAllowJson);

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: false,
      correlationId: CORRELATION,
      invokeHermesProfile,
    });

    await runDepartmentPipeline({ productId: PRODUCT, channel: "threads", goal: "홍보" }, dispatch);

    expect(invokeHermesProfile).toHaveBeenCalledTimes(2);
    expect(invokeHermesProfile.mock.calls[0]?.[0]).toBe("content-strategist");
    expect(invokeHermesProfile.mock.calls[1]?.[0]).toBe("governance-auditor");
  });

  it("does not call Hermes when runtime path is enabled", async () => {
    const executeAndWait = vi
      .fn()
      .mockResolvedValueOnce({ status: "completed", requestId: "d", response: { content: draftJson } })
      .mockResolvedValueOnce({ status: "completed", requestId: "g", response: { content: governanceAllowJson } });
    const invokeHermesProfile = vi.fn();

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: true,
      correlationId: CORRELATION,
      executor: { executeAndWait },
      invokeHermesProfile,
    });

    await runDepartmentPipeline({ productId: PRODUCT, channel: "threads", goal: "홍보" }, dispatch);

    expect(executeAndWait).toHaveBeenCalledTimes(2);
    expect(invokeHermesProfile).not.toHaveBeenCalled();
  });

  it("does not call Runtime when legacy path is enabled", async () => {
    const executeAndWait = vi.fn();
    const invokeHermesProfile = vi
      .fn()
      .mockReturnValueOnce(draftJson)
      .mockReturnValueOnce(governanceAllowJson);

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: false,
      correlationId: CORRELATION,
      executor: { executeAndWait },
      invokeHermesProfile,
    });

    await runDepartmentPipeline({ productId: PRODUCT, channel: "threads", goal: "홍보" }, dispatch);

    expect(invokeHermesProfile).toHaveBeenCalledTimes(2);
    expect(executeAndWait).not.toHaveBeenCalled();
  });

  it("fails pipeline when governance runtime execution fails", async () => {
    const executeAndWait = vi
      .fn()
      .mockResolvedValueOnce({ status: "completed", requestId: "d", response: { content: draftJson } })
      .mockResolvedValueOnce({
        status: "failed",
        requestId: "g",
        error: { code: "AUTH_ERROR", retryable: false },
      });

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: true,
      correlationId: CORRELATION,
      executor: { executeAndWait },
    });

    const result = await runDepartmentPipeline(
      { productId: PRODUCT, channel: "threads", goal: "홍보" },
      dispatch,
    );

    expect(result.status).toBe("handoff_failed");
    expect(result.failure?.code).toBe("governance_unavailable");
    expect(result.status).not.toBe("publish_ready");
  });

  it("does not expose secrets in runtime request payloads", async () => {
    const executeAndWait = vi
      .fn()
      .mockResolvedValueOnce({ status: "completed", requestId: "d", response: { content: draftJson } })
      .mockResolvedValueOnce({ status: "completed", requestId: "g", response: { content: governanceAllowJson } });

    const dispatch = createMarketingPlanPipelineDispatch({
      useRuntime: true,
      correlationId: CORRELATION,
      executor: { executeAndWait },
    });

    await runDepartmentPipeline({ productId: PRODUCT, channel: "threads", goal: "홍보" }, dispatch);

    const serialized = JSON.stringify(executeAndWait.mock.calls);
    expect(serialized).not.toMatch(/api[_-]?key/i);
    expect(serialized).not.toContain("OPENROUTER_API_KEY");
  });
});

describe("marketing cron specialist prompts", () => {
  it("builds JSON-only prompts from envelope payload", () => {
    const prompt = buildContentDraftPrompt({
      productId: PRODUCT,
      channel: "threads",
      goal: "홍보",
      agenda: null,
      brief: null,
      constraints: ["no invent"],
      memoryReferences: [],
    });
    expect(prompt).toContain("JSON only");
    expect(prompt).toContain(PRODUCT);
    expect(prompt).not.toContain("get_marketing_context");
  });
});
