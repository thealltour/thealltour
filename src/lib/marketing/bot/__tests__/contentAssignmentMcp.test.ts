vi.mock("server-only", () => ({}));

import { describe, expect, it, beforeEach } from "vitest";

import { handleMarketingMcpJsonRpc, handleMarketingToolHttp } from "@/lib/marketing/bot/httpHandler";
import { MARKETING_BOT_INTERNAL_TOKEN_ENV } from "@/lib/marketing/bot/constants";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { mcpReadOnlyHint } from "@/lib/marketing/bot/organization/enforcement";
import { isToolAllowedForRole } from "@/lib/marketing/bot/organization/skillMatrix";
import { createContentAssignmentTool } from "@/lib/marketing/bot/createContentAssignmentTool";
import { getContentAssignmentTool } from "@/lib/marketing/bot/getContentAssignmentTool";
import { getAssignmentResearchEvidenceTool } from "@/lib/marketing/bot/getAssignmentResearchEvidenceTool";
import { createInMemoryContentAssignmentStore } from "@/lib/marketing/content/store/contentAssignmentStore";
import type { MarketingBotDeps } from "@/lib/marketing/bot/types";

const TOKEN = "test-marketing-bot-token";
const ENV = { [MARKETING_BOT_INTERNAL_TOKEN_ENV]: TOKEN };
const NOW = new Date("2026-09-02T03:00:00.000Z");

describe("content assignment MCP tools", () => {
  let store: ReturnType<typeof createInMemoryContentAssignmentStore>;
  let deps: MarketingBotDeps;

  beforeEach(() => {
    store = createInMemoryContentAssignmentStore();
    deps = { contentAssignmentStore: store, now: NOW };
  });

  it("classifies read-only vs internal execution correctly", () => {
    expect(mcpReadOnlyHint("get_content_assignment")).toBe(true);
    expect(mcpReadOnlyHint("get_assignment_research_evidence")).toBe(true);
    expect(mcpReadOnlyHint("create_content_assignment")).toBe(false);
    expect(isToolAllowedForRole("marketing_manager", "create_content_assignment")).toBe(true);
    expect(isToolAllowedForRole("content_strategist", "create_content_assignment")).toBe(false);
    expect(isToolAllowedForRole("content_strategist", "get_content_assignment")).toBe(true);
  });

  it("creates assignment via MCP tool wrapper", async () => {
    const result = await createContentAssignmentTool(
      {
        title: "South Sudan travel note",
        summary: "Timely destination context.",
        commercialIntent: "informational",
      },
      deps,
    );
    expect(result.contentAssignment.assignmentId).toMatch(/^ca_/);
    expect(result.selectedAgenda.provenance.decidedBy).toBe("marketing-manager");
    expect(jsonContainsForbiddenBotLeak(result)).toBe(false);
  });

  it("returns assignment via read-only lookup", async () => {
    const created = await createContentAssignmentTool(
      { title: "Kenya update", summary: "Useful travel note." },
      deps,
    );
    const lookup = await getContentAssignmentTool(
      { assignmentId: created.contentAssignment.assignmentId },
      deps,
    );
    expect(lookup.status).toBe("ok");
    if (lookup.status === "ok") {
      expect(lookup.assignment.topic).toBe("Kenya update");
    }
  });

  it("returns evidence refs for governance preparation", async () => {
    const created = await createContentAssignmentTool(
      {
        title: "Grand Canyon reopening",
        summary: "Limited access after floods.",
        rationale: ["timely safety update"],
      },
      deps,
    );
    const evidence = await getAssignmentResearchEvidenceTool(
      { assignmentId: created.contentAssignment.assignmentId },
      deps,
    );
    expect(evidence.status).toBe("ok");
    if (evidence.status === "ok") {
      expect(Array.isArray(evidence.evidenceRefs)).toBe(true);
      expect(Array.isArray(evidence.facts)).toBe(true);
    }
  });

  it("lists new tools in MCP adapter without publish tools", async () => {
    const listed = await handleMarketingMcpJsonRpc({
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps,
    });
    const tools = (listed.body as { result: { tools: Array<{ name: string }> } }).result.tools;
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("create_content_assignment");
    expect(names).toContain("get_content_assignment");
    expect(names).toContain("get_assignment_research_evidence");
    expect(names.some((name) => /publish|send|post/i.test(name))).toBe(false);
  });

  it("supports idempotent create through HTTP dispatch", async () => {
    const body = {
      title: "Scotland luxury camp",
      summary: "Lifestyle travel angle.",
      idempotencyKey: "http-idem-1",
    };
    const first = await handleMarketingToolHttp({
      tool: "create_content_assignment",
      body,
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps,
    });
    const second = await handleMarketingToolHttp({
      tool: "create_content_assignment",
      body,
      authorization: `Bearer ${TOKEN}`,
      env: ENV,
      deps,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const a = first.body as { contentAssignment: { assignmentId: string } };
    const b = second.body as { contentAssignment: { assignmentId: string } };
    expect(a.contentAssignment.assignmentId).toBe(b.contentAssignment.assignmentId);
  });
});
