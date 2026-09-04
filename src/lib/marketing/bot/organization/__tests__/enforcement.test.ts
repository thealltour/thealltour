vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { handleMarketingMcpJsonRpc } from "@/lib/marketing/bot/httpHandler";
import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import {
  MARKETING_MCP_SIDE_EFFECT_CLASS,
  containsFakeAsyncCompletionPromise,
  containsUnsupportedProductFactClaims,
  departmentOrchestrationRequired,
  genericDelegateSatisfiesSpecialistInvocation,
  governanceClaimAllowed,
  mcpReadOnlyHint,
  textClaimsGovernanceResult,
} from "@/lib/marketing/bot/organization/enforcement";
import { orchestrateDepartmentTask } from "@/lib/marketing/bot/organization/orchestrate";
import { routeDepartmentRequest } from "@/lib/marketing/bot/organization/routing";
import { PUBLICATION_FLOW_INACTIVE } from "@/lib/marketing/social/publication/governanceBoundary";
import type { DailyPerformanceBriefArtifact } from "@/lib/marketing/cron/performanceBriefArtifact";
import type { HermesAgentRuntimeResult } from "@/lib/marketing/bot/organization/hermesRuntime";
import { MARKETING_BOT_TOOL_NAMES } from "@/lib/marketing/bot/types";

const TOKEN = "test-marketing-bot-token";
const ENV = { [MARKETING_BOT_INTERNAL_TOKEN_ENV]: TOKEN };

function sampleBrief(overrides: Partial<DailyPerformanceBriefArtifact> = {}): DailyPerformanceBriefArtifact {
  return {
    version: 1,
    generatedAt: "2026-08-26T00:00:00.000Z",
    timezone: "Asia/Seoul",
    period: { start: "2026-08-25T00:00:00.000+09:00", end: "2026-08-25T23:59:59.999+09:00" },
    productId: null,
    channel: null,
    sourcesChecked: ["ai_publications", "analytics_events", "ai_memory"],
    availableChannels: [],
    confirmedMetrics: [{ metricType: "analytics_events", value: 3, source: "analytics_events" }],
    missingItems: ["Instagram impressions (no SNS collector)"],
    notableChanges: [],
    managerEvidence: ["analytics_events=3"],
    dataAvailability: "partial",
    snsDirectCollection: false,
    ...overrides,
  };
}

function okInvoke(profile: HermesAgentRuntimeResult["profile"], stdout: string): HermesAgentRuntimeResult {
  return {
    executionId: `exec-${profile}`,
    profile,
    actuallyInvoked: true,
    exitCode: 0,
    timedOut: false,
    stdout,
    stderr: "",
    promptSha256: "abc",
    argv: ["hermes", "-p", profile, "--yolo", "--ignore-rules", "-z"],
    startedAt: "2026-08-26T00:00:00.000Z",
    endedAt: "2026-08-26T00:00:01.000Z",
  };
}

function failInvoke(profile: HermesAgentRuntimeResult["profile"]): HermesAgentRuntimeResult {
  return {
    ...okInvoke(profile, ""),
    actuallyInvoked: false,
    executionId: "exec-failed",
    exitCode: 1,
    timedOut: true,
    error: "specialist timeout",
  };
}

describe("STEP 2-4.8C-1 enforcement", () => {
  it("CASE A — department cron classification is mandatory orchestration", () => {
    const route = routeDepartmentRequest(
      "더올투어 마케팅, 오늘 예정된 크론 작업을 팀 전체 기준으로 정리해줘.",
    );
    expect(route.intent).toBe("department_status");
    expect(route.orchestrationRequired).toBe(true);
    expect(departmentOrchestrationRequired(route)).toBe(true);
  });

  it("CASE B — explicit PA requires actual named profile", async () => {
    const route = routeDepartmentRequest("Performance Analyst에게 현재 성과 상태를 분석시켜줘.");
    expect(route.requestedAgents).toEqual(["performance-analyst"]);
    expect(route.orchestrationRequired).toBe(true);

    const result = await orchestrateDepartmentTask(
      { userRequest: "Performance Analyst에게 현재 성과 상태를 분석시켜줘." },
      {
        buildPerformanceEvidence: async () => sampleBrief(),
        hermesRuntime: {
          invoke: async ({ profile }) => okInvoke(profile, JSON.stringify({ dataAvailability: "partial" })),
        },
      },
    );
    expect(result.orchestrationRequired).toBe(true);
    const analyst = result.agents.find((agent) => agent.agent === "performance-analyst");
    expect(analyst?.actuallyInvoked).toBe(true);
    expect(analyst?.executionId).toBeTruthy();
  });

  it("CASE C — generic delegate_task cannot satisfy specialist invocation", () => {
    expect(genericDelegateSatisfiesSpecialistInvocation()).toBe(false);
    const route = routeDepartmentRequest("Performance Analyst에게 분석시켜줘");
    expect(route.orchestrationRequired).toBe(true);
    // Simulated generic delegate outcome is never an actual specialist result.
    const fakeDelegate = { tool: "delegate_task", actuallyInvoked: false as const };
    expect(fakeDelegate.actuallyInvoked).toBe(false);
  });

  it("CASE D — governance evidence invariant", async () => {
    expect(governanceClaimAllowed({ governanceInvoked: false, validatedReviewExists: false })).toBe(false);
    expect(textClaimsGovernanceResult("거버넌스 통과했습니다")).toBe(true);
    expect(textClaimsGovernanceResult("publish_ready")).toBe(true);
    expect(governanceClaimAllowed({ governanceInvoked: true, validatedReviewExists: false })).toBe(true);

    const noGov = await orchestrateDepartmentTask(
      { userRequest: "더올투어 마케팅 오늘 크론 정리해줘" },
      {
        readJobsFile: () => JSON.stringify({ jobs: [] }),
        fetchGatewayStatus: async () => ({ overall: "ok", gateway_mode: "multiplex", gateway_running: true }),
      },
    );
    const proseWithoutEvidence = "ALLOW — publish_ready";
    expect(governanceClaimAllowed({ governanceInvoked: false, validatedReviewExists: false })).toBe(false);
    expect(textClaimsGovernanceResult(proseWithoutEvidence)).toBe(true);
    expect(noGov.synthesis.recommendedActions).toContain(
      "do_not_claim_ALLOW_REVIEW_BLOCK_or_publish_ready_without_evidence",
    );

    const withGov = await orchestrateDepartmentTask(
      { userRequest: "콘텐츠 초안 만들고 정책 검수까지 해줘" },
      {
        hermesRuntime: {
          invoke: async ({ profile }) => {
            if (profile === "content-strategist") {
              return okInvoke(
                profile,
                JSON.stringify({
                  title: "t",
                  body: "concept",
                  channel: "threads",
                  agenda: null,
                  sourceReferences: [],
                }),
              );
            }
            return okInvoke(
              profile,
              JSON.stringify({
                decision: "ALLOW",
                riskScore: 0,
                reasons: [],
                revisionHints: [],
                humanApprovalRequired: false,
                semanticAvailable: true,
              }),
            );
          },
        },
      },
    );
    expect(withGov.pipeline?.governance?.decision).toBe("ALLOW");
    expect(withGov.synthesis.keyFindings.some((item) => /governance=ALLOW/.test(item))).toBe(true);
  });

  it("CASE E — unsupported product facts rejected without evidence", () => {
    expect(containsUnsupportedProductFactClaims("더올투어 상품에는 숨겨진 옵션 비용이 없습니다.")).toBe(true);
    expect(containsUnsupportedProductFactClaims("노옵션 노쇼핑 출발 확정")).toBe(true);
    expect(
      containsUnsupportedProductFactClaims(
        "여행 상품을 선택할 때 일정과 포함/불포함 조건을 확인하기 쉽게 전달하는 콘텐츠 방향",
      ),
    ).toBe(false);
  });

  it("CASE F — performance partial when internal evidence exists", async () => {
    const result = await orchestrateDepartmentTask(
      { userRequest: "Performance Analyst에게 성과 분석시켜줘" },
      {
        buildPerformanceEvidence: async () => sampleBrief(),
        hermesRuntime: {
          invoke: async () => okInvoke("performance-analyst", "{}"),
        },
      },
    );
    expect(result.performanceEvidence?.dataAvailability).toBe("partial");
  });

  it("CASE G — specialist failure reports in same lifecycle; no fake async promise", async () => {
    const result = await orchestrateDepartmentTask(
      { userRequest: "Performance Analyst에게 성과 분석시켜줘" },
      {
        buildPerformanceEvidence: async () => sampleBrief(),
        hermesRuntime: {
          invoke: async ({ profile }) => failInvoke(profile),
        },
      },
    );
    const analyst = result.agents[0];
    expect(analyst?.actuallyInvoked).toBe(false);
    expect(analyst?.errors.some((error) => /timeout/i.test(error))).toBe(true);
    expect(result.synthesis.conflictsOrLimitations.some((item) => /timeout|not actually invoked/i.test(item))).toBe(
      true,
    );
    expect(result.synthesis.recommendedActions).toContain("complete_in_same_turn_no_fake_async_promise");
    expect(containsFakeAsyncCompletionPromise("분석 중이며 결과가 취합되는 대로 보고드리겠습니다.")).toBe(true);
    expect(containsFakeAsyncCompletionPromise("Performance Analyst 호출이 timeout으로 완료되지 않았습니다.")).toBe(
      false,
    );
  });

  it("CASE H — publication boundary remains inactive", async () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    const result = await orchestrateDepartmentTask(
      { userRequest: "인스타그램에 게시할 콘텐츠를 준비하고 바로 게시해줘" },
      {
        hermesRuntime: {
          invoke: async ({ profile }) => {
            if (profile === "content-strategist") {
              return okInvoke(
                profile,
                JSON.stringify({
                  title: "t",
                  body: "generic concept draft",
                  channel: "instagram",
                  agenda: null,
                  sourceReferences: [],
                }),
              );
            }
            return okInvoke(
              profile,
              JSON.stringify({
                decision: "ALLOW",
                riskScore: 0,
                reasons: [],
                revisionHints: [],
                humanApprovalRequired: false,
                semanticAvailable: true,
              }),
            );
          },
        },
      },
    );
    expect(result.snsSideEffects).toBe(0);
    expect(result.publicationFlowInactive).toBe(true);
  });

  it("CASE I — readonly metadata only on true read-only tools", async () => {
    expect(mcpReadOnlyHint("get_marketing_context")).toBe(true);
    expect(mcpReadOnlyHint("search_marketing_memory")).toBe(true);
    expect(mcpReadOnlyHint("get_performance_evidence")).toBe(true);
    expect(mcpReadOnlyHint("run_department_orchestration")).toBe(false);
    expect(mcpReadOnlyHint("prepare_marketing_task")).toBe(false);
    expect(mcpReadOnlyHint("review_generated_content")).toBe(false);
    expect(MARKETING_MCP_SIDE_EFFECT_CLASS.run_department_orchestration).toBe("internal_execution");

    const listed = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
    });
    const tools = (
      listed.body as {
        result: { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> };
      }
    ).result.tools;
    for (const name of MARKETING_BOT_TOOL_NAMES) {
      const tool = tools.find((row) => row.name === name);
      expect(tool?.annotations?.readOnlyHint).toBe(mcpReadOnlyHint(name));
    }
  });
});
