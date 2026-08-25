import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleMarketingMcpJsonRpc } from "@/lib/marketing/bot/httpHandler";
import { getPerformanceEvidenceTool } from "@/lib/marketing/bot/getPerformanceEvidenceTool";
import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import { MARKETING_SKILL_MATRIX } from "@/lib/marketing/bot/organization/skillMatrix";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { DailyPerformanceBriefArtifact } from "@/lib/marketing/cron/performanceBriefArtifact";
import { MEMORY_RETRIEVAL_FAILED_ITEM } from "@/lib/marketing/cron/performanceBriefArtifact";

const TOKEN = "test-marketing-bot-token";
const ENV = { [MARKETING_BOT_INTERNAL_TOKEN_ENV]: TOKEN };

function sampleBrief(
  overrides: Partial<DailyPerformanceBriefArtifact> = {},
): DailyPerformanceBriefArtifact {
  return {
    version: 1,
    generatedAt: "2026-08-25T00:00:00.000Z",
    timezone: "Asia/Seoul",
    period: { start: "2026-08-24T00:00:00.000+09:00", end: "2026-08-24T23:59:59.999+09:00" },
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

describe("get_performance_evidence", () => {
  it("returns the same Daily Performance Brief contract as cron", async () => {
    const brief = sampleBrief();
    const result = await getPerformanceEvidenceTool(
      {},
      { buildPerformanceEvidence: async () => brief },
    );
    expect(result.contract).toBe("daily-performance-brief-v1");
    expect(result.dataAvailability).toBe("partial");
    expect(result.snsDirectCollection).toBe(false);
    expect(result.confirmedMetrics).toEqual(brief.confirmedMetrics);
    expect(result.sourcesChecked).toEqual(brief.sourcesChecked);
    expect(result.memoryStatus).toBe("ok");
    expect(jsonContainsForbiddenBotLeak(result)).toBe(false);
  });

  it("marks memory unavailable without changing partial availability", async () => {
    const result = await getPerformanceEvidenceTool(
      {},
      {
        buildPerformanceEvidence: async () =>
          sampleBrief({
            missingItems: ["Instagram impressions (no SNS collector)", MEMORY_RETRIEVAL_FAILED_ITEM],
          }),
      },
    );
    expect(result.memoryStatus).toBe("unavailable");
    expect(result.dataAvailability).toBe("partial");
  });

  it("is listed as a read-only MCP tool and allowed for manager/analyst", async () => {
    const listed = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
    });
    expect(listed.status).toBe(200);
    const tools = (listed.body as { result: { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> } })
      .result.tools;
    const evidence = tools.find((tool) => tool.name === "get_performance_evidence");
    expect(evidence).toBeTruthy();
    expect(evidence?.annotations?.readOnlyHint).toBe(true);
    expect(tools.some((tool) => /publish|send|post/i.test(tool.name))).toBe(false);
    expect(MARKETING_SKILL_MATRIX.performance_analyst.get_performance_evidence).toBe("allow");
    expect(MARKETING_SKILL_MATRIX.marketing_manager.get_performance_evidence).toBe("allow");
    expect(MARKETING_SKILL_MATRIX.content_strategist.get_performance_evidence).toBe("deny");
    expect(MARKETING_SKILL_MATRIX.governance_auditor.get_performance_evidence).toBe("deny");
  });

  it("calls the cron builder through JSON-RPC", async () => {
    const brief = sampleBrief();
    const called = await handleMarketingMcpJsonRpc({
      payload: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_performance_evidence", arguments: {} },
      },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: { buildPerformanceEvidence: async () => brief },
    });
    expect(called.status).toBe(200);
    const rpc = called.body as { result: { structuredContent: { contract: string; dataAvailability: string } } };
    expect(rpc.result.structuredContent.contract).toBe("daily-performance-brief-v1");
    expect(rpc.result.structuredContent.dataAvailability).toBe("partial");
  });
});
