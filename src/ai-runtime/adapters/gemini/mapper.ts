import type { RuntimeMessage } from "@/ai-runtime/domain/request";
import type { RuntimeFinishReason } from "@/ai-runtime/domain/response";
import type {
  RuntimeToolCall,
  RuntimeToolChoice,
  RuntimeToolDefinition,
} from "@/ai-runtime/domain/tools";
import type { RuntimeResponseFormat } from "@/ai-runtime/domain/structured-output";
import { RuntimeError } from "@/ai-runtime/domain/error";
import { recallGeminiToolCallState, rememberGeminiToolCallState } from "@/ai-runtime/adapters/gemini/tool-call-state";

export type GeminiPart =
  | { text: string }
  | {
      functionCall: { name: string; args?: Record<string, unknown> };
      thoughtSignature?: string;
    }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type GeminiGenerateBody = {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
  generationConfig?: {
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: Record<string, unknown>;
  };
  tools?: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
  toolConfig?: {
    functionCallingConfig: {
      mode: "AUTO" | "ANY" | "NONE";
      allowedFunctionNames?: string[];
    };
  };
};

function parseToolArgsObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

function parseToolResultObject(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: content };
  }
}


function normalizeGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeGeminiSchema(item));
  }
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (key === "type" && typeof raw === "string") {
      out.type = raw.toUpperCase();
      continue;
    }
    if (key === "properties" && raw && typeof raw === "object" && !Array.isArray(raw)) {
      const props: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(raw as Record<string, unknown>)) {
        props[propKey] = normalizeGeminiSchema(propVal);
      }
      out.properties = props;
      continue;
    }
    if (key === "items") {
      out.items = normalizeGeminiSchema(raw);
      continue;
    }
    out[key] = normalizeGeminiSchema(raw);
  }
  return out;
}


/** Keywords Gemini responseSchema does not reliably accept (REST generateContent). */
const GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS = new Set([
  "$ref",
  "$schema",
  "$id",
  "$defs",
  "definitions",
  "if",
  "then",
  "else",
  "not",
  "dependentRequired",
  "dependentSchemas",
  "unevaluatedProperties",
  "unevaluatedItems",
  "patternProperties",
  "propertyNames",
  "contentEncoding",
  "contentMediaType",
  "prefixItems",
  "contains",
  "minContains",
  "maxContains",
  "additionalProperties",
]);

export function findUnsupportedGeminiSchemaKeywords(
  schema: unknown,
  found: Set<string> = new Set(),
): string[] {
  if (Array.isArray(schema)) {
    for (const item of schema) findUnsupportedGeminiSchemaKeywords(item, found);
    return [...found].sort();
  }
  if (!schema || typeof schema !== "object") return [...found].sort();
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (GEMINI_UNSUPPORTED_SCHEMA_KEYWORDS.has(key)) found.add(key);
    findUnsupportedGeminiSchemaKeywords(value, found);
  }
  return [...found].sort();
}

/**
 * Maps Runtime responseFormat → Gemini generationConfig JSON mode / responseSchema.
 * Does not silently drop unsupported schema keywords.
 */
export function mapRuntimeResponseFormatToGemini(
  format: RuntimeResponseFormat | undefined,
): NonNullable<GeminiGenerateBody["generationConfig"]> | undefined {
  if (!format) return undefined;
  if (format.type === "json_object") {
    return { responseMimeType: "application/json" };
  }
  const unsupported = findUnsupportedGeminiSchemaKeywords(format.schema);
  if (unsupported.length) {
    throw new RuntimeError(
      "INVALID_REQUEST",
      `Gemini responseSchema unsupported keywords: ${unsupported.join(", ")}`,
      false,
    );
  }
  return {
    responseMimeType: "application/json",
    responseSchema: normalizeGeminiSchema(format.schema) as Record<string, unknown>,
  };
}

export function mapRuntimeToolsToGemini(
  tools: RuntimeToolDefinition[] | undefined,
): GeminiGenerateBody["tools"] | undefined {
  if (!tools?.length) return undefined;
  return [
    {
      functionDeclarations: tools.map((tool) => {
        const decl: Record<string, unknown> = { name: tool.function.name };
        if (tool.function.description) decl.description = tool.function.description;
        if (tool.function.parameters) {
          decl.parameters = normalizeGeminiSchema(tool.function.parameters) as Record<string, unknown>;
        }
        return decl;
      }),
    },
  ];
}

export function mapRuntimeToolChoiceToGemini(
  toolChoice: RuntimeToolChoice | undefined,
): GeminiGenerateBody["toolConfig"] | undefined {
  if (toolChoice == null) return undefined;
  if (toolChoice === "auto") {
    return { functionCallingConfig: { mode: "AUTO" } };
  }
  if (toolChoice === "none") {
    return { functionCallingConfig: { mode: "NONE" } };
  }
  if (toolChoice === "required") {
    return { functionCallingConfig: { mode: "ANY" } };
  }
  return {
    functionCallingConfig: {
      mode: "ANY",
      allowedFunctionNames: [toolChoice.function.name],
    },
  };
}

/**
 * Maps RuntimeMessage[] → Gemini generateContent payload.
 * Translates OpenAI-style toolCalls / tool results ↔ functionCall / functionResponse.
 */
export function mapRuntimeMessagesToGemini(messages: RuntimeMessage[]): GeminiGenerateBody {
  const systemParts: string[] = [];
  const contents: GeminiContent[] = [];
  /** toolCallId → function name for functionResponse pairing */
  const callNames = new Map<string, string>();

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
      const parts: GeminiPart[] = [];
      if (message.content?.trim()) {
        parts.push({ text: message.content });
      }
      if (message.toolCalls?.length) {
        for (const call of message.toolCalls) {
          callNames.set(call.id, call.function.name);
          const remembered = recallGeminiToolCallState(call.id);
          const rawFc = call.providerData?.geminiFunctionCall;
          const argsFromRaw =
            rawFc && typeof rawFc === "object" && !Array.isArray(rawFc)
              ? (rawFc as { args?: Record<string, unknown> }).args
              : undefined;
          const argsFromRemembered = remembered?.functionCall?.args;
          const part: GeminiPart = {
            functionCall: {
              name: call.function.name,
              args:
                argsFromRaw ??
                argsFromRemembered ??
                parseToolArgsObject(call.function.arguments),
            },
          };
          const signature =
            (typeof call.providerData?.thoughtSignature === "string"
              ? call.providerData.thoughtSignature
              : undefined) || remembered?.thoughtSignature;
          if (typeof signature === "string" && signature) {
            (part as { thoughtSignature?: string }).thoughtSignature = signature;
          }
          parts.push(part);
        }
      }
      if (parts.length === 0) {
        parts.push({ text: "" });
      }
      contents.push({ role: "model", parts });
      continue;
    }
    if (message.role === "tool") {
      const name =
        message.name?.trim() ||
        (message.toolCallId ? callNames.get(message.toolCallId) : undefined) ||
        "tool";
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name,
              response: parseToolResultObject(message.content),
            },
          },
        ],
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
  return parts.map((part) => (typeof part.text === "string" ? part.text : "")).join("");
}

export function extractGeminiToolCalls(payload: unknown): RuntimeToolCall[] | undefined {
  const root = payload as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          functionCall?: { name?: string; args?: Record<string, unknown> };
          thoughtSignature?: string;
        }>;
      };
    }>;
  };
  const parts = root.candidates?.[0]?.content?.parts ?? [];
  const mapped: RuntimeToolCall[] = [];
  for (const [index, part] of parts.entries()) {
    const call = part.functionCall;
    if (!call?.name?.trim()) continue;
    let args = "{}";
    try {
      args = JSON.stringify(call.args ?? {});
    } catch {
      args = "{}";
    }
    const thoughtSignature =
      typeof (part as { thoughtSignature?: unknown }).thoughtSignature === "string"
        ? (part as { thoughtSignature: string }).thoughtSignature
        : undefined;
    const id = `gemini_call_${index}_${call.name}`;
    const providerData: Record<string, unknown> = {
      geminiFunctionCall: { name: call.name, args: call.args ?? {} },
    };
    if (thoughtSignature) providerData.thoughtSignature = thoughtSignature;
    rememberGeminiToolCallState(id, {
      thoughtSignature,
      functionCall: { name: call.name, args: call.args ?? {} },
    });
    mapped.push({
      id,
      type: "function",
      function: { name: call.name, arguments: args },
      providerData,
    });
  }
  return mapped.length ? mapped : undefined;
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
