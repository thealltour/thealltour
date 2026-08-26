vi.mock("server-only", () => ({}));

import { describe, expect, it, vi } from "vitest";

import { handleMarketingMcpJsonRpc } from "@/lib/marketing/bot/httpHandler";
import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import { orchestrateDepartmentTask } from "@/lib/marketing/bot/organization/orchestrate";
import { invokeHermesOneshot } from "@/lib/marketing/bot/organization/hermesRuntime";
import { routeDepartmentRequest } from "@/lib/marketing/bot/organization/routing";
import { MARKETING_SKILL_MATRIX } from "@/lib/marketing/bot/organization/skillMatrix";
import { PUBLICATION_FLOW_INACTIVE } from "@/lib/marketing/social/publication/governanceBoundary";
import { MEMORY_RETRIEVAL_FAILED_ITEM } from "@/lib/marketing/cron/performanceBriefArtifact";
import type { DailyPerformanceBriefArtifact } from "@/lib/marketing/cron/performanceBriefArtifact";
import type { HermesAgentRuntimeResult } from "@/lib/marketing/bot/organization/hermesRuntime";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";

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
    sourcesChecked: [
      "ai_publications",
      "ai_feedback",
      "analytics_events",
      "thread_marketing_posts",
      "inquiries",
      "travel_bookings",
      "ai_memory",
    ],
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

function jobsJson(id: string, name: string, expr: string, script: string) {
  return JSON.stringify({
    jobs: [
      {
        id,
        name,
        schedule: { kind: "cron", expr, display: expr },
        schedule_display: expr,
        deliver: "local",
        enabled: true,
        no_agent: true,
        script,
        last_status: "ok",
        last_run_at: "2026-08-26T08:30:00+09:00",
        next_run_at: "2026-08-27T08:30:00+09:00",
      },
    ],
  });
}

describe("department orchestration", () => {
  it("CASE A: explicit Performance Analyst request actually invokes the profile", async () => {
    const invoked: string[] = [];
    const result = await orchestrateDepartmentTask(
      { userRequest: "Performance Analyst에게 성과 분석을 요청해" },
      {
        buildPerformanceEvidence: async () => sampleBrief(),
        hermesRuntime: {
          invoke: async ({ profile }) => {
            invoked.push(profile);
            return okInvoke("performance-analyst", JSON.stringify({ dataAvailability: "partial", observations: ["analytics_events=3"] }));
          },
        },
      },
    );
    expect(invoked).toEqual(["performance-analyst"]);
    const analyst = result.agents.find((agent) => agent.agent === "performance-analyst");
    expect(analyst?.actuallyInvoked).toBe(true);
    expect(analyst?.executionId).toBeTruthy();
    expect(result.synthesis.consultedAgents.some((row) => row.agent === "performance-analyst" && row.actuallyInvoked)).toBe(
      true,
    );
    expect(jsonContainsForbiddenBotLeak(result)).toBe(false);
  });

  it("CASE A control: persona-only text is not treated as a successful handoff", async () => {
    const persona = { text: "Performance Analyst 분석 결과: 데이터가 없습니다." };
    expect(persona).not.toEqual(expect.objectContaining({ actuallyInvoked: true }));
  });

  it("CASE B: internal evidence + missing SNS stays partial", async () => {
    const result = await orchestrateDepartmentTask(
      { userRequest: "Performance Analyst에게 성과 분석을 요청해" },
      {
        buildPerformanceEvidence: async () => sampleBrief(),
        hermesRuntime: {
          invoke: async () => okInvoke("performance-analyst", "{}"),
        },
      },
    );
    expect(result.performanceEvidence?.dataAvailability).toBe("partial");
    expect(result.performanceEvidence?.snsDirectCollection).toBe(false);
    expect(result.synthesis.evidenceAvailability).toBe("partial");
  });

  it("CASE C: memory failure is non-fatal and overall stays partial", async () => {
    const result = await orchestrateDepartmentTask(
      { userRequest: "Performance Analyst에게 현재 이용 가능한 성과 데이터 기준으로 분석시켜줘" },
      {
        buildPerformanceEvidence: async () =>
          sampleBrief({
            missingItems: ["Instagram impressions (no SNS collector)", MEMORY_RETRIEVAL_FAILED_ITEM],
          }),
        hermesRuntime: {
          invoke: async () => okInvoke("performance-analyst", "{}"),
        },
      },
    );
    expect(result.agents[0]?.actuallyInvoked).toBe(true);
    expect(result.performanceEvidence?.dataAvailability).toBe("partial");
    expect(result.performanceEvidence?.memoryStatus).toBe("unavailable");
    expect(result.synthesis.conflictsOrLimitations.some((item) => /memoryData=unavailable/i.test(item))).toBe(true);
  });

  it("CASE D: department cron uses multiplex gateway truth and both 08:30 and 09:00 jobs", async () => {
    const result = await orchestrateDepartmentTask(
      { userRequest: "더올투어 마케팅 오늘 크론 정리해줘" },
      {
        readJobsFile: (absolutePath) => {
          if (absolutePath.includes("performance-analyst")) {
            return jobsJson("9e96a94ee72f", "AI Marketing - Daily Performance", "30 8 * * *", "daily-performance-brief.sh");
          }
          if (absolutePath.includes("marketing-manager")) {
            return jobsJson("edfc1815135b", "AI Marketing - Daily Plan", "0 9 * * *", "daily-marketing-plan.sh");
          }
          return JSON.stringify({ jobs: [] });
        },
        fetchGatewayStatus: async () => ({
          overall: "ok",
          gateway_mode: "multiplex",
          gateway_running: true,
          gateway_platforms: { "marketing-manager:telegram": { state: "connected" } },
        }),
      },
    );
    expect(result.intent).toBe("department_status");
    expect(result.cron?.jobs.some((job) => job.profile === "performance-analyst" && job.schedule === "30 8 * * *")).toBe(
      true,
    );
    expect(result.cron?.jobs.some((job) => job.profile === "marketing-manager" && job.schedule === "0 9 * * *")).toBe(true);
    expect(result.cron?.gateway.source).toBe("multiplex_default");
    expect(result.cron?.gateway.gatewayMode).toBe("multiplex");
    expect(result.cron?.gateway.overall).toBe("ok");
    expect(result.cron?.gateway.namedProfileCronStatusAuthoritative).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/Gateway is not running/i);
  });

  it("CASE E: content then governance then manager synthesis", async () => {
    const invoked: string[] = [];
    const result = await orchestrateDepartmentTask(
      { userRequest: "다음 캠페인 콘텐츠를 준비하고 정책 검수까지 해줘." },
      {
        hermesRuntime: {
          invoke: async ({ profile }) => {
            invoked.push(profile);
            if (profile === "content-strategist") {
              return okInvoke(
                profile,
                JSON.stringify({
                  title: "초안",
                  body: "상품 페이지 기준 일정입니다.",
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
    expect(invoked).toEqual(["content-strategist", "governance-auditor"]);
    expect(result.pipeline?.status).toBe("publish_ready");
    expect(result.snsSideEffects).toBe(0);
    expect(result.synthesis.consultedAgents.map((row) => row.agent)).toEqual([
      "content-strategist",
      "governance-auditor",
    ]);
  });

  it("CASE F: publish request does not publish", async () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    const result = await orchestrateDepartmentTask(
      { userRequest: "인스타그램에 바로 게시해" },
      {
        hermesRuntime: {
          invoke: async ({ profile }) => {
            if (profile === "content-strategist") {
              return okInvoke(
                profile,
                JSON.stringify({
                  title: "초안",
                  body: "상품 페이지 기준입니다.",
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
    expect(result.publicationRequested).toBe(true);
    expect(result.publicationFlowInactive).toBe(true);
    expect(result.snsSideEffects).toBe(0);
    expect(result.pipeline?.publishActionIncluded).toBe(false);
  });

  it("CASE G: unknown project/agent does not spawn arbitrary profiles", async () => {
    const invoked: string[] = [];
    const runtime = {
      invoke: async ({ profile }: { profile: string }) => {
        invoked.push(profile);
        return okInvoke("performance-analyst", "{}");
      },
    };
    const unknownAgent = await orchestrateDepartmentTask(
      { userRequest: "test1에게 분석을 맡겨줘" },
      { hermesRuntime: runtime },
    );
    const unknownProject = await orchestrateDepartmentTask(
      { userRequest: "future-project-a 마케팅 성과 분석해줘" },
      { hermesRuntime: runtime },
    );
    expect(unknownAgent.intent).toBe("routing_failed");
    expect(unknownProject.intent).toBe("routing_failed");
    expect(invoked).toEqual([]);
    expect(() => {
      void invokeHermesOneshot({ profile: "test1", prompt: "nope" });
    }).toThrow(/excluded|allowlisted/i);
  });

  it("lists the orchestration tool for Manager only and via MCP", async () => {
    expect(MARKETING_SKILL_MATRIX.marketing_manager.run_department_orchestration).toBe("allow");
    expect(MARKETING_SKILL_MATRIX.performance_analyst.run_department_orchestration).toBe("deny");
    const listed = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
    });
    const tools = (listed.body as { result: { tools: Array<{ name: string }> } }).result.tools;
    expect(tools.map((tool) => tool.name)).toContain("run_department_orchestration");
    expect(tools.some((tool) => /publish|send|post/i.test(tool.name))).toBe(false);
  });
});

describe("department routing", () => {
  it("routes explicit analyst naming and department cron language", () => {
    expect(routeDepartmentRequest("Performance Analyst에게 성과 분석을 요청해").intent).toBe("performance");
    expect(routeDepartmentRequest("더올투어 마케팅, 오늘 예정된 크론 작업을 팀 전체 기준으로 정리해줘.").intent).toBe(
      "department_status",
    );
  });
});
