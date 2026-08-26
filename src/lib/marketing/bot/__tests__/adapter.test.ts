import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleMarketingMcpJsonRpc, handleMarketingToolHttp } from "@/lib/marketing/bot/httpHandler";
import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";
import type { MarketingContextPackage } from "@/lib/marketing/context/types";

const TOKEN = "test-marketing-bot-token";
const ENV = { [MARKETING_BOT_INTERNAL_TOKEN_ENV]: TOKEN };
const PRODUCT_ID = "98a889e9-fbc4-41e3-8302-0d2b042fbe0a";

function deps(): MarketingBotDeps {
  const pkg: MarketingContextPackage = {
    request: { purpose: "create_content", productId: PRODUCT_ID },
    context: { product: null },
    governance: {},
    sources: [],
    generatedAt: "2026-08-25T00:00:00.000Z",
  };
  return {
    composeContext: async () => pkg,
    semanticRetrieve: async () => ({ status: "ok", matches: [] }),
    evaluateWorkflow: async (candidate) => {
      const { applyGovernancePolicy } = await import("@/lib/marketing/governance/applyGovernancePolicy");
      const { emptyAgendaStats } = await import("@/lib/marketing/governance/evaluators");
      const governance = {
        decision: "ALLOW" as const,
        riskScore: 0,
        reasons: [{ code: "NO_RISK_SIGNAL" as const, severity: "info" as const }],
        checkedAt: "2026-08-25T00:00:00.000Z",
        semanticAvailable: true,
        matchedMemories: [],
        agendaStats: emptyAgendaStats(),
        channelStats: {
          channel: candidate.channel,
          dailyCount: 0,
          dailyMax: 3,
          cooldownDays: 7,
          sameAgendaRecentCount: 0,
        },
      };
      const policy = applyGovernancePolicy(governance, { now: new Date("2026-08-25T00:00:00.000Z") });
      return { ...policy, candidate, approvalRequest: null, revisionRequest: null };
    },
  };
}

describe("internal marketing HTTP adapter", () => {
  it("rejects missing auth", async () => {
    const result = await handleMarketingToolHttp({
      tool: "get_marketing_context",
      body: { purpose: "create_content" },
      authorization: null,
      env: ENV,
      deps: deps(),
    });
    expect(result.status).toBe(401);
  });

  it("rejects when the internal token is not configured", async () => {
    const result = await handleMarketingToolHttp({
      tool: "get_marketing_context",
      body: { purpose: "create_content" },
      authorization: "Bearer x",
      env: {},
      deps: deps(),
    });
    expect(result.status).toBe(401);
  });

  it("rejects malformed input", async () => {
    const result = await handleMarketingToolHttp({
      tool: "get_marketing_context",
      body: { purpose: "" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    expect(result.status).toBe(400);
  });

  it("returns compact context for a valid request", async () => {
    const result = await handleMarketingToolHttp({
      tool: "get_marketing_context",
      body: { purpose: "create_content", productId: PRODUCT_ID },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    expect(result.status).toBe(200);
    expect(jsonContainsForbiddenBotLeak(result.body)).toBe(false);
  });
});

describe("MCP JSON-RPC adapter", () => {
  it("lists read-only tools and has no publish tool", async () => {
    const listed = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    expect(listed.status).toBe(200);
    const tools = (listed.body as { result: { tools: Array<{ name: string; annotations?: { readOnlyHint?: boolean } }> } })
      .result.tools;
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("prepare_marketing_task");
    expect(names).toContain("review_generated_content");
    expect(names).toContain("get_performance_evidence");
    expect(names).toContain("run_department_orchestration");
    expect(names.some((name) => /publish|send|post/i.test(name))).toBe(false);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
  });

  it("calls review_generated_content through JSON-RPC", async () => {
    const called = await handleMarketingMcpJsonRpc({
      payload: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "review_generated_content",
          arguments: { title: "효도", body: "본문", channel: "threads" },
        },
      },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    expect(called.status).toBe(200);
    const rpc = called.body as { result: { structuredContent: { status: string; publishActionIncluded: boolean } } };
    expect(rpc.result.structuredContent.status).toBe("publish_ready");
    expect(rpc.result.structuredContent.publishActionIncluded).toBe(false);
  });

  it("rejects MCP calls without auth", async () => {
    const result = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 1, method: "initialize" },
      authorization: null,
      env: ENV,
    });
    expect(result.status).toBe(401);
  });
});
