import type { RuntimeMessage } from "@/ai-runtime/domain/request";
import type { RuntimeFinishReason } from "@/ai-runtime/domain/response";
import type {
  RuntimeToolCall,
  RuntimeToolChoice,
  RuntimeToolDefinition,
} from "@/ai-runtime/domain/tools";
import type { RuntimeResponseFormat } from "@/ai-runtime/domain/structured-output";
import { RuntimeError } from "@/ai-runtime/domain/error";

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

export type OpenAiChatRequestBody = {
  model: string;
  messages: OpenAiChatMessage[];
  max_tokens?: number;
  tools?: Array<{
    type: "function";
    function: { name: string; description?: string; parameters?: Record<string, unknown> };
  }>;
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } };
  response_format?:
    | { type: "json_object" }
    | {
        type: "json_schema";
        json_schema: {
          name: string;
          description?: string;
          schema: Record<string, unknown>;
          strict?: boolean;
        };
      };
};

export function mapRuntimeToolsToOpenAi(
  tools: RuntimeToolDefinition[] | undefined,
): OpenAiChatRequestBody["tools"] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.function.name,
      ...(tool.function.description ? { description: tool.function.description } : {}),
      ...(tool.function.parameters ? { parameters: tool.function.parameters } : {}),
    },
  }));
}

export function mapRuntimeResponseFormatToOpenAi(
  format: RuntimeResponseFormat | undefined,
): OpenAiChatRequestBody["response_format"] | undefined {
  if (!format) return undefined;
  if (format.type === "json_object") {
    return { type: "json_object" };
  }
  return {
    type: "json_schema",
    json_schema: {
      name: format.name,
      schema: format.schema,
      ...(format.description ? { description: format.description } : {}),
      ...(typeof format.strict === "boolean" ? { strict: format.strict } : {}),
    },
  };
}

export function mapRuntimeToolChoiceToOpenAi(
  toolChoice: RuntimeToolChoice | undefined,
): OpenAiChatRequestBody["tool_choice"] | undefined {
  if (toolChoice == null) return undefined;
  if (typeof toolChoice === "string") return toolChoice;
  return { type: "function", function: { name: toolChoice.function.name } };
}

/**
 * OpenAI-compatible chat message mapping (OpenRouter / NVIDIA NIM).
 * Preserves assistant.tool_calls and role=tool + tool_call_id for Hermes loops.
 */
export function mapRuntimeMessagesToOpenAiChat(messages: RuntimeMessage[]): OpenAiChatMessage[] {
  if (!messages.length) {
    throw new RuntimeError("INVALID_REQUEST", "messages must not be empty", false);
  }
  return messages.map((message) => {
    if (message.role === "system" || message.role === "user") {
      return { role: message.role, content: message.content };
    }
    if (message.role === "assistant") {
      const out: OpenAiChatMessage = {
        role: "assistant",
        content: message.content || (message.toolCalls?.length ? null : ""),
      };
      if (message.toolCalls?.length) {
        out.tool_calls = message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        }));
      }
      return out;
    }
    if (message.role === "tool") {
      if (!message.toolCallId?.trim()) {
        throw new RuntimeError(
          "INVALID_REQUEST",
          "tool messages require toolCallId for OpenAI-compatible providers",
          false,
        );
      }
      return {
        role: "tool",
        content: message.content,
        tool_call_id: message.toolCallId,
        ...(message.name ? { name: message.name } : {}),
      };
    }
    throw new RuntimeError(
      "INVALID_REQUEST",
      `Unsupported message role: ${(message as RuntimeMessage).role}`,
      false,
    );
  });
}

export function mapOpenAiFinishReason(raw: unknown): RuntimeFinishReason | undefined {
  const value = String(raw ?? "").toLowerCase();
  if (!value) return undefined;
  if (value === "stop") return "stop";
  if (value === "length") return "length";
  if (value === "tool_calls" || value === "function_call") return "tool_call";
  if (value === "content_filter") return "content_filter";
  return "unknown";
}

export function extractOpenAiChatContent(payload: unknown): string {
  const root = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> | null } }>;
  };
  const content = root.choices?.[0]?.message?.content;
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part.text === "string" ? part.text : "")).join("");
  }
  return "";
}

export function extractOpenAiToolCalls(payload: unknown): RuntimeToolCall[] | undefined {
  const root = payload as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: unknown };
        }>;
      };
    }>;
  };
  const raw = root.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const mapped: RuntimeToolCall[] = [];
  for (const [index, call] of raw.entries()) {
    const name = call?.function?.name?.trim();
    if (!name) continue;
    const rawArgs = call?.function?.arguments;
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

export function extractOpenAiUsage(payload: unknown): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  provided: boolean;
} {
  const usage = (payload as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") return { provided: false };
  const inputTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const outputTokens =
    typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;
  const totalTokens = typeof usage.total_tokens === "number" ? usage.total_tokens : undefined;
  const details = usage.prompt_tokens_details as { cached_tokens?: number } | undefined;
  const cachedInputTokens =
    typeof details?.cached_tokens === "number" ? details.cached_tokens : undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    provided: inputTokens != null || outputTokens != null || totalTokens != null,
  };
}

/** OpenRouter may report the resolved upstream model. */
export function extractOpenRouterActualModel(payload: unknown): string | undefined {
  const root = payload as { model?: unknown };
  return typeof root.model === "string" && root.model.trim() ? root.model.trim() : undefined;
}
