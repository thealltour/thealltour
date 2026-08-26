import "server-only";

import { ContextValidationError } from "@/lib/marketing/context/errors";
import { GovernanceValidationError } from "@/lib/marketing/governance/errors";
import { assertInternalMarketingAuth } from "@/lib/marketing/bot/auth";
import { MARKETING_BOT_MCP_SERVER_NAME, MARKETING_BOT_VERSION } from "@/lib/marketing/bot/constants";
import { dispatchMarketingBotTool, isMarketingBotToolName } from "@/lib/marketing/bot/dispatch";
import { MarketingBotAuthError, MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import { MARKETING_BOT_TOOL_NAMES, type MarketingBotDeps } from "@/lib/marketing/bot/types";

export type MarketingHttpResult = {
  status: number;
  body: unknown;
};

function errorStatus(error: unknown): MarketingHttpResult {
  if (error instanceof MarketingBotAuthError) {
    return { status: 401, body: { error: error.message } };
  }
  if (
    error instanceof MarketingBotValidationError ||
    error instanceof ContextValidationError ||
    error instanceof GovernanceValidationError
  ) {
    return { status: 400, body: { error: error.message } };
  }
  const message = error instanceof Error ? error.message : "Internal error";
  return { status: 500, body: { error: message } };
}

export async function handleMarketingToolHttp(input: {
  tool: string;
  body: unknown;
  authorization?: string | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  deps?: MarketingBotDeps;
}): Promise<MarketingHttpResult> {
  try {
    assertInternalMarketingAuth(input.authorization, input.env ?? process.env);
    if (!isMarketingBotToolName(input.tool)) {
      return { status: 404, body: { error: `Unknown tool: ${input.tool}` } };
    }
    const result = await dispatchMarketingBotTool(input.tool, input.body, {
      ...input.deps,
      env: input.deps?.env ?? input.env,
    });
    return { status: 200, body: result };
  } catch (error) {
    return errorStatus(error);
  }
}

const MCP_TOOL_SCHEMAS: Record<string, { description: string; required: string[]; properties: Record<string, unknown> }> =
  {
    get_marketing_context: {
      description: "Load compact marketing context for a product or campaign. No PII or embeddings.",
      required: ["purpose"],
      properties: {
        purpose: { type: "string" },
        productId: { type: "string" },
        campaignId: { type: "string" },
        channel: { type: "string" },
        lookbackDays: { type: "number" },
      },
    },
    search_marketing_memory: {
      description: "Semantic search over marketing memory. Returns previews, never vectors.",
      required: ["query"],
      properties: {
        query: { type: "string" },
        limit: { type: "number" },
        memoryType: { type: "string" },
        sourceType: { type: "string" },
      },
    },
    build_content_brief: {
      description: "Build a content brief. Hermes writes the copy; this tool does not generate the post body.",
      required: ["productId", "channel"],
      properties: {
        productId: { type: "string" },
        channel: { type: "string" },
        campaignId: { type: "string" },
        agendaId: { type: "string" },
        purpose: { type: "string" },
        goal: { type: "string" },
      },
    },
    evaluate_governance: {
      description: "Evaluate generated content against governance policy. Does not publish.",
      required: ["body", "channel"],
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        channel: { type: "string" },
        productId: { type: "string" },
        campaignId: { type: "string" },
        agendaId: { type: "string" },
        agendaKey: { type: "string" },
      },
    },
    prepare_marketing_task: {
      description: "Prepare context, memory matches, and generation instructions. Does not publish.",
      required: ["productId", "channel"],
      properties: {
        productId: { type: "string" },
        channel: { type: "string" },
        campaignId: { type: "string" },
        agendaId: { type: "string" },
        goal: { type: "string" },
      },
    },
    review_generated_content: {
      description: "Review Hermes-generated copy with governance. Stops at publish_ready. Does not publish.",
      required: ["body", "channel"],
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        channel: { type: "string" },
        productId: { type: "string" },
        campaignId: { type: "string" },
        agendaId: { type: "string" },
        agendaKey: { type: "string" },
      },
    },
    get_performance_evidence: {
      description:
        "Read-only Daily Performance Brief evidence (same contract as 08:30 cron). Internal DB/MCP counts only. No SNS collection or publish.",
      required: [],
      properties: {
        productId: { type: "string" },
        channel: { type: "string" },
      },
    },
    run_department_orchestration: {
      description:
        "Application-level Marketing Manager orchestration. Actually dispatches allowlisted specialist Hermes profiles, collects evidence, and synthesizes. Does not publish. Ingress-agnostic (Telegram/Desktop).",
      required: ["userRequest"],
      properties: {
        userRequest: { type: "string" },
        productId: { type: "string" },
        channel: { type: "string" },
      },
    },
  };

function mcpToolsList() {
  return MARKETING_BOT_TOOL_NAMES.map((name) => ({
    name,
    description: MCP_TOOL_SCHEMAS[name]?.description ?? name,
    inputSchema: {
      type: "object",
      required: MCP_TOOL_SCHEMAS[name]?.required ?? [],
      properties: MCP_TOOL_SCHEMAS[name]?.properties ?? {},
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }));
}

export async function handleMarketingMcpJsonRpc(input: {
  payload: unknown;
  authorization?: string | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  deps?: MarketingBotDeps;
}): Promise<MarketingHttpResult> {
  try {
    assertInternalMarketingAuth(input.authorization, input.env ?? process.env);
  } catch (error) {
    return errorStatus(error);
  }

  const payload = input.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { status: 400, body: { error: "JSON-RPC object is required" } };
  }
  const rpc = payload as { jsonrpc?: string; id?: string | number | null; method?: string; params?: unknown };
  if (rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
    return { status: 400, body: { error: "Invalid JSON-RPC request" } };
  }

  const respond = (result: unknown) => ({
    status: 200,
    body: { jsonrpc: "2.0", id: rpc.id ?? null, result },
  });

  if (rpc.method === "initialize") {
    return respond({
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: MARKETING_BOT_MCP_SERVER_NAME, version: MARKETING_BOT_VERSION },
    });
  }
  if (rpc.method === "notifications/initialized" || rpc.method === "initialized") {
    return { status: 202, body: {} };
  }
  if (rpc.method === "ping") {
    return respond({});
  }
  if (rpc.method === "tools/list") {
    return respond({ tools: mcpToolsList() });
  }
  if (rpc.method === "tools/call") {
    const params = rpc.params as { name?: string; arguments?: unknown } | undefined;
    if (!params?.name) {
      return { status: 400, body: { jsonrpc: "2.0", id: rpc.id ?? null, error: { code: -32602, message: "name is required" } } };
    }
    try {
      const result = await dispatchMarketingBotTool(params.name, params.arguments ?? {}, {
        ...input.deps,
        env: input.deps?.env ?? input.env,
      });
      return respond({
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        isError: false,
      });
    } catch (error) {
      const mapped = errorStatus(error);
      return {
        status: mapped.status === 401 ? 401 : 200,
        body:
          mapped.status === 401
            ? mapped.body
            : {
                jsonrpc: "2.0",
                id: rpc.id ?? null,
                result: {
                  content: [{ type: "text", text: JSON.stringify(mapped.body) }],
                  isError: true,
                },
              },
      };
    }
  }

  return {
    status: 200,
    body: { jsonrpc: "2.0", id: rpc.id ?? null, error: { code: -32601, message: `Unknown method: ${rpc.method}` } },
  };
}
