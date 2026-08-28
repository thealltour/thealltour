import { randomUUID } from "node:crypto";

import type { RuntimeMessage, RuntimeRequest } from "@/ai-runtime/domain/request";
import type {
  RuntimeToolCall,
  RuntimeToolChoice,
  RuntimeToolDefinition,
} from "@/ai-runtime/domain/tools";
import type { RuntimeResponseFormat } from "@/ai-runtime/domain/structured-output";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  GATEWAY_DEFAULT_ALIAS,
  resolveGatewayAlias,
  shouldSpikeForceFallback,
} from "@/ai-runtime/gateway/alias-registry";
import { HERMES_INFERENCE_INTEGRATION } from "@/ai-runtime/integration/constants";
import { createRuntimeRequest } from "@/ai-runtime/integration/runtime-request-factory";
import type {
  GatewayCompatibilityFlags,
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatMessage,
} from "@/ai-runtime/gateway/types";

export {
  resolveWorkloadForAlias,
  shouldSpikeForceFallback,
  lookupGatewayAlias,
  resolveGatewayAlias,
  listGatewayAliasEntries,
  isProductionGatewayAlias,
  isSpikeGatewayAlias,
  HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
  HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
  HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
  HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
} from "@/ai-runtime/gateway/alias-registry";

function flattenContent(content: OpenAiCompatMessage["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        if (typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function mapRole(role: string): RuntimeMessage["role"] {
  const normalized = role.trim().toLowerCase();
  if (normalized === "system" || normalized === "developer") return "system";
  if (normalized === "assistant") return "assistant";
  if (normalized === "tool" || normalized === "function") return "tool";
  return "user";
}

function mapOpenAiToolCalls(raw: unknown): RuntimeToolCall[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const mapped: RuntimeToolCall[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const call = entry as {
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: unknown };
    };
    const name = call.function?.name?.trim();
    if (!name) continue;
    const rawArgs = call.function?.arguments;
    let argsText = "{}";
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      argsText = rawArgs;
    } else if (rawArgs != null) {
      try {
        argsText = JSON.stringify(rawArgs);
      } catch {
        argsText = String(rawArgs);
      }
    }
    mapped.push({
      id: (call.id && String(call.id).trim()) || `call_${index}_${name}`,
      type: "function",
      function: { name, arguments: argsText },
    });
  }
  return mapped.length ? mapped : undefined;
}

export function mapOpenAiToolsToRuntime(raw: unknown): RuntimeToolDefinition[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const mapped: RuntimeToolDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const tool = entry as {
      type?: string;
      function?: { name?: string; description?: string; parameters?: Record<string, unknown> };
    };
    if (tool.type && tool.type !== "function") continue;
    const name = tool.function?.name?.trim();
    if (!name) continue;
    mapped.push({
      type: "function",
      function: {
        name,
        ...(tool.function?.description ? { description: tool.function.description } : {}),
        ...(tool.function?.parameters ? { parameters: tool.function.parameters } : {}),
      },
    });
  }
  return mapped.length ? mapped : undefined;
}

export function mapOpenAiToolChoiceToRuntime(raw: unknown): RuntimeToolChoice | undefined {
  if (raw == null) return undefined;
  if (raw === "auto" || raw === "none" || raw === "required") return raw;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as { type?: string; function?: { name?: string } };
    const name = obj.function?.name?.trim();
    if (obj.type === "function" && name) {
      return { type: "function", function: { name } };
    }
  }
  return undefined;
}


export function mapOpenAiResponseFormatToRuntime(raw: unknown): RuntimeResponseFormat | undefined {
  if (raw == null) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new RuntimeError("INVALID_REQUEST", "response_format must be an object", false);
  }
  const body = raw as {
    type?: unknown;
    json_schema?: {
      name?: unknown;
      description?: unknown;
      schema?: unknown;
      strict?: unknown;
    };
  };
  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (type === "json_object") {
    return { type: "json_object" };
  }
  if (type === "json_schema") {
    const js = body.json_schema;
    if (!js || typeof js !== "object" || Array.isArray(js)) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        "response_format.json_schema must be an object",
        false,
      );
    }
    const name = typeof js.name === "string" ? js.name.trim() : "";
    if (!name) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        "response_format.json_schema.name is required",
        false,
      );
    }
    if (!js.schema || typeof js.schema !== "object" || Array.isArray(js.schema)) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        "response_format.json_schema.schema must be an object",
        false,
      );
    }
    const out: RuntimeResponseFormat = {
      type: "json_schema",
      name,
      schema: js.schema as Record<string, unknown>,
    };
    if (typeof js.description === "string" && js.description.trim()) {
      out.description = js.description;
    }
    if (typeof js.strict === "boolean") {
      out.strict = js.strict;
    }
    return out;
  }
  throw new RuntimeError(
    "INVALID_REQUEST",
    `Unsupported response_format.type: ${type || "(missing)"}`,
    false,
  );
}

export function extractCompatibilityFlags(
  body: OpenAiCompatChatCompletionRequest,
): GatewayCompatibilityFlags {
  const unsupported: string[] = [];
  if (body.temperature != null) unsupported.push("temperature");
  return {
    toolsPresent: Array.isArray(body.tools) && body.tools.length > 0,
    streamRequested: body.stream === true,
    responseFormatPresent: body.response_format != null,
    unsupportedFields: unsupported,
  };
}

export function mapOpenAiMessagesToRuntime(messages: OpenAiCompatMessage[]): RuntimeMessage[] {
  const mapped: RuntimeMessage[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const role = mapRole(String(message.role ?? "user"));
    const content = flattenContent(message.content);
    const toolCalls = role === "assistant" ? mapOpenAiToolCalls(message.tool_calls) : undefined;
    const toolCallId =
      role === "tool" && typeof message.tool_call_id === "string"
        ? message.tool_call_id.trim()
        : undefined;

    if (!content && !toolCalls?.length && role !== "tool") continue;
    if (role === "tool" && !toolCallId) {
      throw new Error("role=tool messages require tool_call_id");
    }

    mapped.push({
      role,
      content: content || "",
      ...(toolCalls ? { toolCalls } : {}),
      ...(toolCallId ? { toolCallId } : {}),
      ...(typeof message.name === "string" && message.name.trim()
        ? { name: message.name.trim() }
        : {}),
    });
  }
  return mapped;
}

export type MapGatewayRequestResult = {
  request: RuntimeRequest;
  flags: GatewayCompatibilityFlags;
  alias: string;
  agentId: string;
  workload: RuntimeRequest["workload"];
};

/**
 * Normalize OpenAI-compatible chat body into a RuntimeRequest.
 * Preserves tools / tool_choice / tool_calls / tool results for Hermes loops.
 */
export function mapOpenAiCompatToRuntimeRequest(
  body: OpenAiCompatChatCompletionRequest,
  options: { correlationId?: string; conversationId?: string; now?: () => Date } = {},
): MapGatewayRequestResult {
  const flags = extractCompatibilityFlags(body);
  const rawAlias = body.model?.trim() ? body.model.trim() : GATEWAY_DEFAULT_ALIAS;
  const aliasEntry = resolveGatewayAlias(rawAlias);
  const alias = aliasEntry.alias;
  const messages = mapOpenAiMessagesToRuntime(Array.isArray(body.messages) ? body.messages : []);
  if (messages.length === 0) {
    throw new Error("messages must contain at least one non-empty message");
  }

  const tools = mapOpenAiToolsToRuntime(body.tools);
  const toolChoice = mapOpenAiToolChoiceToRuntime(body.tool_choice);
  const responseFormat = mapOpenAiResponseFormatToRuntime(body.response_format);

  const maxTokens =
    typeof body.max_completion_tokens === "number"
      ? body.max_completion_tokens
      : typeof body.max_tokens === "number"
        ? body.max_tokens
        : undefined;

  const agentId = aliasEntry.agentId;
  const correlationId =
    options.correlationId ??
    `${HERMES_INFERENCE_INTEGRATION}:${agentId}:${randomUUID().slice(0, 8)}`;

  const spikeForceFallback = shouldSpikeForceFallback(alias) || undefined;

  const request = createRuntimeRequest(
    {
      agentId,
      source: "system",
      workload: aliasEntry.workload,
      priority: aliasEntry.priority,
      messages,
      tools,
      toolChoice,
      responseFormat,
      expectedOutputTokens: maxTokens,
      correlationId,
      conversationId: options.conversationId,
      spikeForceFallback: spikeForceFallback || undefined,
      routing: {
        allowFallback: true,
        requiresStructuredOutput: Boolean(responseFormat) || flags.responseFormatPresent,
        requiresToolCalling: Boolean(tools?.length),
      },
    },
    { now: options.now },
  );

  return {
    request,
    flags,
    alias,
    agentId,
    workload: aliasEntry.workload,
  };
}
