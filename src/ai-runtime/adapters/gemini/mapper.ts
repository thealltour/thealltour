import type { RuntimeMessage } from "@/ai-runtime/domain/request";
import type { RuntimeFinishReason } from "@/ai-runtime/domain/response";
import { RuntimeError } from "@/ai-runtime/domain/error";

export type GeminiContentPart = { text: string };
export type GeminiContent = { role: "user" | "model"; parts: GeminiContentPart[] };

export type GeminiGenerateBody = {
  systemInstruction?: { parts: GeminiContentPart[] };
  contents: GeminiContent[];
  generationConfig?: { maxOutputTokens?: number };
};

/**
 * Maps RuntimeMessage[] → Gemini generateContent payload.
 * tool roles are mapped to user text (no silent drop).
 */
export function mapRuntimeMessagesToGemini(messages: RuntimeMessage[]): GeminiGenerateBody {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemParts.push(message.content);
      continue;
    }
    if (message.role === "user") {
      contents.push({ role: "user", parts: [{ text: message.content }] });
      continue;
    }
    if (message.role === "assistant") {
      contents.push({ role: "model", parts: [{ text: message.content }] });
      continue;
    }
    if (message.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ text: `[tool result]\n${message.content}` }],
      });
      continue;
    }
    throw new RuntimeError(
      "INVALID_REQUEST",
      `Unsupported message role for Gemini: ${(message as RuntimeMessage).role}`,
      false,
    );
  }

  if (contents.length === 0) {
    throw new RuntimeError(
      "INVALID_REQUEST",
      "Gemini request requires at least one non-system message",
      false,
    );
  }

  const body: GeminiGenerateBody = { contents };
  if (systemParts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  }
  return body;
}

export function mapGeminiFinishReason(raw: unknown): RuntimeFinishReason | undefined {
  const value = String(raw ?? "").toUpperCase();
  if (!value) return undefined;
  if (value === "STOP") return "stop";
  if (value === "MAX_TOKENS") return "length";
  if (value === "SAFETY" || value === "BLOCKLIST" || value === "PROHIBITED_CONTENT") {
    return "content_filter";
  }
  if (value.includes("TOOL") || value === "FUNCTION_CALL") return "tool_call";
  return "unknown";
}

export function extractGeminiText(payload: unknown): string {
  const root = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = root.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((part) => part.text ?? "").join("");
  return text;
}

export function extractGeminiUsage(payload: unknown): {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  provided: boolean;
} {
  const usage = (payload as { usageMetadata?: Record<string, unknown> }).usageMetadata;
  if (!usage || typeof usage !== "object") {
    return { provided: false };
  }
  const inputTokens =
    typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : undefined;
  const outputTokens =
    typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined;
  const totalTokens =
    typeof usage.totalTokenCount === "number" ? usage.totalTokenCount : undefined;
  const cachedInputTokens =
    typeof usage.cachedContentTokenCount === "number"
      ? usage.cachedContentTokenCount
      : undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    provided: inputTokens != null || outputTokens != null || totalTokens != null,
  };
}
