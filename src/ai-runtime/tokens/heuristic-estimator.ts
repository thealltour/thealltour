import type { RuntimeMessage, RuntimeRequest } from "@/ai-runtime/domain/request";
import type { RuntimeToolDefinition } from "@/ai-runtime/domain/tools";
import type { RuntimeResponseFormat } from "@/ai-runtime/domain/structured-output";
import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { TokenEstimate, TokenBudgetCheck } from "@/ai-runtime/tokens/types";
import {
  ASCII_CHARS_PER_TOKEN,
  MESSAGE_BASE_OVERHEAD_TOKENS,
  NON_ASCII_CHARS_PER_TOKEN,
  ROLE_OVERHEAD_TOKENS,
  WORKLOAD_DEFAULT_OUTPUT_TOKENS,
} from "@/ai-runtime/tokens/constants";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";

export function countCharacters(content: string): { asciiCharacters: number; nonAsciiCharacters: number } {
  let asciiCharacters = 0;
  let nonAsciiCharacters = 0;
  for (const char of content) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x7f) asciiCharacters += 1;
    else nonAsciiCharacters += 1;
  }
  return { asciiCharacters, nonAsciiCharacters };
}

export function estimateTextTokens(content: string): number {
  const { asciiCharacters, nonAsciiCharacters } = countCharacters(content);
  const asciiTokens = asciiCharacters / ASCII_CHARS_PER_TOKEN;
  const nonAsciiTokens = nonAsciiCharacters / NON_ASCII_CHARS_PER_TOKEN;
  return Math.ceil(asciiTokens + nonAsciiTokens);
}

function roleOverhead(role: RuntimeMessage["role"]): number {
  return ROLE_OVERHEAD_TOKENS[role] ?? ROLE_OVERHEAD_TOKENS.user;
}

export function estimateMessageTokens(message: RuntimeMessage): number {
  const content = message.content ?? "";
  const contentTokens = content.length === 0 ? 0 : Math.max(1, estimateTextTokens(content));
  return MESSAGE_BASE_OVERHEAD_TOKENS + roleOverhead(message.role) + contentTokens;
}

export function estimateInputTokensFromMessages(messages: RuntimeMessage[]): number {
  if (!messages.length) return 0;
  return messages.reduce((sum, message) => sum + estimateMessageTokens(message), 0);
}

export function estimateToolDefinitionsTokens(tools: RuntimeToolDefinition[] | undefined): number {
  if (!tools?.length) return 0;
  let total = 8;
  for (const tool of tools) {
    total += 4;
    total += estimateTextTokens(tool.function.name);
    if (tool.function.description) total += estimateTextTokens(tool.function.description);
    if (tool.function.parameters) {
      try {
        total += estimateTextTokens(JSON.stringify(tool.function.parameters));
      } catch {
        total += 16;
      }
    }
  }
  return total;
}

export function estimateMessageTokensWithTools(message: RuntimeMessage): number {
  let total = estimateMessageTokens(message);
  if (message.toolCalls?.length) {
    for (const call of message.toolCalls) {
      total += 4 + estimateTextTokens(call.function.name) + estimateTextTokens(call.function.arguments || "");
    }
  }
  if (message.toolCallId) total += estimateTextTokens(message.toolCallId);
  return total;
}

export function estimateResponseFormatTokens(
  format: RuntimeResponseFormat | undefined,
): number {
  if (!format) return 0;
  let total = 4;
  total += estimateTextTokens(format.type);
  if (format.type === "json_schema") {
    total += estimateTextTokens(format.name);
    if (format.description) total += estimateTextTokens(format.description);
    try {
      total += estimateTextTokens(JSON.stringify(format.schema));
    } catch {
      total += 32;
    }
  }
  return total;
}

export function estimateInputTokensFromRequest(
  request: Pick<RuntimeRequest, "messages" | "tools" | "responseFormat">,
): number {
  const messageTokens = (request.messages ?? []).reduce(
    (sum, message) => sum + estimateMessageTokensWithTools(message),
    0,
  );
  return (
    messageTokens +
    estimateToolDefinitionsTokens(request.tools) +
    estimateResponseFormatTokens(request.responseFormat)
  );
}

export function resolveRawOutputTokens(
  workload: WorkloadClass,
  expectedOutputTokens: number | undefined,
): number {
  if (expectedOutputTokens != null) {
    if (!Number.isFinite(expectedOutputTokens) || expectedOutputTokens < 0) {
      return WORKLOAD_DEFAULT_OUTPUT_TOKENS[workload];
    }
    return expectedOutputTokens;
  }
  return WORKLOAD_DEFAULT_OUTPUT_TOKENS[workload];
}

export function applySafetyMultiplier(raw: number, multiplier: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.ceil(raw * multiplier);
}

export function checkContextFit(estimate: TokenEstimate, model?: ModelDefinition): TokenBudgetCheck {
  const contextLimit = model?.limits.contextTokens;
  const estimatedTotalTokens = estimate.estimatedTotalTokens;
  const output = checkOutputLimit(estimate, model);

  if (contextLimit == null) {
    return {
      fitsContext: true,
      estimatedTotalTokens,
      outputExceedsModelLimit: output.outputExceedsModelLimit,
      maxOutputTokens: output.maxOutputTokens,
    };
  }

  const remainingContextTokens = Math.max(0, contextLimit - estimatedTotalTokens);
  return {
    fitsContext: estimatedTotalTokens <= contextLimit,
    estimatedTotalTokens,
    contextLimit,
    remainingContextTokens,
    outputExceedsModelLimit: output.outputExceedsModelLimit,
    maxOutputTokens: output.maxOutputTokens,
  };
}

export function checkOutputLimit(
  estimate: TokenEstimate,
  model?: ModelDefinition,
): Pick<TokenBudgetCheck, "outputExceedsModelLimit" | "maxOutputTokens"> {
  const maxOutputTokens = model?.limits.maxOutputTokens;
  if (maxOutputTokens == null) {
    return { outputExceedsModelLimit: false };
  }
  return {
    outputExceedsModelLimit: estimate.estimatedOutputTokens > maxOutputTokens,
    maxOutputTokens,
  };
}

export function checkModelBudget(estimate: TokenEstimate, model?: ModelDefinition): TokenBudgetCheck {
  return checkContextFit(estimate, model);
}
