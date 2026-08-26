import type { RuntimeMessage } from "@/ai-runtime/domain/request";
import type { RuntimeFinishReason } from "@/ai-runtime/domain/response";
import { RuntimeError } from "@/ai-runtime/domain/error";

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type OpenAiChatRequestBody = {
  model: string;
  messages: OpenAiChatMessage[];
  max_tokens?: number;
};

/**
 * OpenAI-compatible chat message mapping (OpenRouter / NVIDIA NIM).
 * tool → user with explicit prefix (no silent drop; full tool protocol not in scope).
 */
export function mapRuntimeMessagesToOpenAiChat(messages: RuntimeMessage[]): OpenAiChatMessage[] {
  if (!messages.length) {
    throw new RuntimeError("INVALID_REQUEST", "messages must not be empty", false);
  }
  return messages.map((message) => {
    if (message.role === "system" || message.role === "user" || message.role === "assistant") {
      return { role: message.role, content: message.content };
    }
    if (message.role === "tool") {
      return { role: "user", content: `[tool result]\n${message.content}` };
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
    choices?: Array<{ message?: { content?: string | Array<{ text?: string; type?: string }> } }>;
  };
  const content = root.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part.text === "string" ? part.text : "")).join("");
  }
  return "";
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
