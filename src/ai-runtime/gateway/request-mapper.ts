import { randomUUID } from "node:crypto";

import type { RuntimeMessage, RuntimeRequest } from "@/ai-runtime/domain/request";
import type {
  RuntimeToolCall,
  RuntimeToolChoice,
  RuntimeToolDefinition,
} from "@/ai-runtime/domain/tools";
import type { RuntimeResponseFormat } from "@/ai-runtime/domain/structured-output";
import { RuntimeError } from "@/ai-runtime/domain/error";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import {
  HERMES_INFERENCE_ALIAS_AUTO,
  HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
  HERMES_INFERENCE_INTEGRATION,
  AI_RUNTIME_SPIKE_FORCE_FALLBACK_ENV,
  RUNTIME_SPIKE_AGENT_ID,
} from "@/ai-runtime/integration/constants";
import { createRuntimeRequest } from "@/ai-runtime/integration/runtime-request-factory";
import type {
  GatewayCompatibilityFlags,
  OpenAiCompatChatCompletionRequest,
  OpenAiCompatMessage,
} from "@/ai-runtime/gateway/types";

const SPIKE_AGENT_ID = RUNTIME_SPIKE_AGENT_ID;

function isTruthyEnvFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

/** Alias or process env requesting spike-only controlled first-candidate failure. */
export function shouldSpikeForceFallback(alias: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const normalized = alias.trim().toLowerCase();
  if (normalized === HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE) return true;
  return isTruthyEnvFlag(env[AI_RUNTIME_SPIKE_FORCE_FALLBACK_ENV]);
}

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

export function resolveWorkloadForAlias(model: string | undefined): WorkloadClass {
  const alias = (model ?? HERMES_INFERENCE_ALIAS_AUTO).trim().toLowerCase();
  if (alias === HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE) {
    return "manager_decision";
  }
  if (alias === "theallcloud/governance" || alias.includes("governance")) {
    return "governance";
  }
  if (alias === "theallcloud/reasoning" || alias.includes("reasoning")) {
    return "reasoning";
  }
  if (alias === "thealltour/marketing" || alias.includes("marketing") || alias.includes("content")) {
    return "content_draft";
  }
  return "manager_decision";
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
  const alias = (body.model ?? HERMES_INFERENCE_ALIAS_AUTO).trim() || HERMES_INFERENCE_ALIAS_AUTO;
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

  const correlationId =
    options.correlationId ??
    `${HERMES_INFERENCE_INTEGRATION}:${SPIKE_AGENT_ID}:${randomUUID().slice(0, 8)}`;

  const spikeForceFallback = shouldSpikeForceFallback(alias);

  const request = createRuntimeRequest(
    {
      agentId: SPIKE_AGENT_ID,
      source: "system",
      workload: resolveWorkloadForAlias(alias),
      priority: "high",
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

  return { request, flags, alias };
}
