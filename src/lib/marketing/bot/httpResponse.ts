import "server-only";

import { handleMarketingMcpJsonRpc, handleMarketingToolHttp } from "@/lib/marketing/bot/httpHandler";
import type { MarketingBotToolName } from "@/lib/marketing/bot/types";

export async function marketingBotHttpResponse(tool: MarketingBotToolName, request: Request): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await handleMarketingToolHttp({
    tool,
    body,
    authorization: request.headers.get("authorization"),
  });
  return Response.json(result.body, { status: result.status });
}

export async function marketingBotMcpResponse(request: Request): Promise<Response> {
  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const result = await handleMarketingMcpJsonRpc({
    payload,
    authorization: request.headers.get("authorization"),
  });
  return Response.json(result.body, { status: result.status });
}
