import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleMarketingMcpJsonRpc, handleMarketingToolHttp } from "@/lib/marketing/bot/httpHandler";
import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { mcpReadOnlyHint } from "@/lib/marketing/bot/organization/enforcement";
import { MARKETING_SKILL_MATRIX } from "@/lib/marketing/bot/organization/skillMatrix";
import { MARKETING_RESEARCH_CONTEXT_CONTRACT, type MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";

const TOKEN = "test-marketing-bot-token";
const ENV = { [MARKETING_BOT_INTERNAL_TOKEN_ENV]: TOKEN };
const NOW = new Date("2026-09-02T12:00:00.000Z");

function mockContext(overrides: Partial<MarketingResearchContext> = {}): MarketingResearchContext {
  return {
    contract: MARKETING_RESEARCH_CONTEXT_CONTRACT,
    status: "ok",
    generatedAt: NOW.toISOString(),
    window: {
      lookbackHours: 168,
      since: "2026-08-26T12:00:00.000Z",
      until: NOW.toISOString(),
    },
    agendaCandidates: [
      {
        agendaCandidateId: "11111111-1111-4111-8111-111111111901",
        researchBriefId: "22222222-2222-4222-8222-222222222902",
        title: "Indonesia advisory",
        summary: "Official advisory.",
        destinations: ["indonesia"],
        topics: ["safety"],
        entities: [],
        signalTypes: ["safety"],
        publishedAt: NOW.toISOString(),
        observedAt: NOW.toISOString(),
        freshnessScore: 0.9,
        credibilityScore: 1,
        travelRelevanceScore: 0.95,
        publicInterestScore: 0.7,
        commercialRelevanceScore: 0.25,
        seasonalityScore: 0.4,
        corroborationScore: 0.35,
        noveltyScore: 1,
        totalResearchScore: 0.82,
        researchScoreComponents: {
          freshness: 0.9,
          credibility: 1,
          travelRelevance: 0.95,
          publicInterest: 0.7,
          corroboration: 0.35,
          novelty: 1,
          seasonality: 0.4,
          commercial: 0.25,
        },
        scoreReasons: ["credibility_1.00"],
        riskFlags: [],
        matchedProductIds: [],
        evidence: [
          {
            evidenceId: "ev-1",
            sourceId: "src-1",
            sourceType: "official_government",
            sourceName: "UK Gov",
            isOfficial: true,
            evidenceType: "official_statement",
            url: "https://example.gov/indonesia",
            reference: null,
            excerpt: "Official excerpt.",
            publishedAt: NOW.toISOString(),
            observedAt: NOW.toISOString(),
          },
        ],
        candidateStatus: "candidate",
      },
    ],
    briefs: [],
    sourceSummary: {
      officialSourceCount: 1,
      newsSourceCount: 0,
      independentSourceFamilies: 1,
      evidenceCount: 1,
    },
    degradedState: {
      semanticInfrastructureAvailable: true,
      reason: null,
    },
    observability: {
      requestedAt: NOW.toISOString(),
      candidateCount: 1,
      briefCount: 0,
      topScore: 0.82,
      degraded: false,
      staleExcludedCount: 0,
      duplicateExcludedCount: 0,
    },
    notes: [],
    ...overrides,
  };
}

function deps(context = mockContext()): MarketingBotDeps {
  return {
    now: NOW,
    getManagerResearchContext: async () => context,
  };
}

describe("get_research_context MCP tool", () => {
  it("is read-only in MCP annotations and skill matrix", () => {
    expect(mcpReadOnlyHint("get_research_context")).toBe(true);
    expect(MARKETING_SKILL_MATRIX.marketing_manager.get_research_context).toBe("allow");
  });

  it("returns bounded research context via HTTP adapter", async () => {
    const result = await handleMarketingToolHttp({
      tool: "get_research_context",
      body: { limit: 5 },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });

    expect(result.status).toBe(200);
    const body = result.body as MarketingResearchContext;
    expect(body.contract).toBe(MARKETING_RESEARCH_CONTEXT_CONTRACT);
    expect(body.agendaCandidates.length).toBeLessThanOrEqual(5);
    expect(jsonContainsForbiddenBotLeak(body)).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/embedding/i);
  });

  it("supports default invocation with no arguments", async () => {
    const result = await handleMarketingMcpJsonRpc({
      payload: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_research_context", arguments: {} },
      },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    expect(result.status).toBe(200);
  });

  it("distinguishes empty from degraded states", async () => {
    const empty = await handleMarketingToolHttp({
      tool: "get_research_context",
      body: {},
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(mockContext({ status: "empty", agendaCandidates: [], notes: ["no_eligible_research_in_window"] })),
    });
    expect((empty.body as MarketingResearchContext).status).toBe("empty");

    const degraded = await handleMarketingToolHttp({
      tool: "get_research_context",
      body: {},
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(mockContext({ status: "degraded", degradedState: { semanticInfrastructureAvailable: false, reason: "embedding_provider_unavailable" } })),
    });
    expect((degraded.body as MarketingResearchContext).status).toBe("degraded");
  });

  it("preserves evidence refs for downstream governance verification", async () => {
    const result = await handleMarketingToolHttp({
      tool: "get_research_context",
      body: {},
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    const candidate = (result.body as MarketingResearchContext).agendaCandidates[0]!;
    expect(candidate.evidence[0]!.url).toContain("example.gov");
    expect(candidate.evidence[0]!.isOfficial).toBe(true);
  });

  it("does not expose publication side effects through tool list", async () => {
    const listed = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 2, method: "tools/list" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps: deps(),
    });
    const tools = (listed.body as { result: { tools: Array<{ name: string }> } }).result.tools;
    expect(tools.some((t) => t.name === "get_research_context")).toBe(true);
    expect(tools.some((name) => /publish|send|post/i.test(name.name))).toBe(false);
  });
});
