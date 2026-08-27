import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import type { OpenAiCompatChatCompletionResponse } from "@/ai-runtime/gateway/types";

function mapFinishReason(reason: RuntimeResponse["finishReason"], hasTools: boolean): string {
  if (reason === "tool_call" || hasTools) return "tool_calls";
  if (reason === "length") return "length";
  if (reason === "content_filter") return "content_filter";
  if (reason === "stop") return "stop";
  return "stop";
}

export function mapRuntimeResponseToOpenAiCompat(
  response: RuntimeResponse,
  alias: string,
): OpenAiCompatChatCompletionResponse {
  const created = Math.floor(Date.now() / 1000);
  const hasTools = Boolean(response.toolCalls?.length);
  const message: OpenAiCompatChatCompletionResponse["choices"][0]["message"] = {
    role: "assistant",
    content: hasTools && !response.content ? null : (response.content ?? ""),
  };
  if (hasTools && response.toolCalls) {
    message.tool_calls = response.toolCalls.map((call) => ({
      id: call.id,
      type: "function" as const,
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    }));
  }

  return {
    id: `chatcmpl-${response.requestId}`,
    object: "chat.completion",
    created,
    model: alias,
    choices: [
      {
        index: 0,
        message,
        finish_reason: mapFinishReason(response.finishReason, hasTools),
      },
    ],
    usage: {
      prompt_tokens: response.usage.inputTokens,
      completion_tokens: response.usage.outputTokens,
      total_tokens: response.usage.totalTokens,
    },
  };
}

/** Minimal SSE: aggregated completion, including tool_calls when present. */
export function mapRuntimeResponseToOpenAiSse(
  response: RuntimeResponse,
  alias: string,
): string {
  const id = `chatcmpl-${response.requestId}`;
  const created = Math.floor(Date.now() / 1000);
  const content = response.content ?? "";
  const hasTools = Boolean(response.toolCalls?.length);
  const finish = mapFinishReason(response.finishReason, hasTools);

  const chunks: unknown[] = [
    {
      id,
      object: "chat.completion.chunk",
      created,
      model: alias,
      choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
    },
  ];

  if (content) {
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created,
      model: alias,
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    });
  }

  if (hasTools && response.toolCalls) {
    chunks.push({
      id,
      object: "chat.completion.chunk",
      created,
      model: alias,
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: response.toolCalls.map((call, index) => ({
              index,
              id: call.id,
              type: "function",
              function: {
                name: call.function.name,
                arguments: call.function.arguments,
              },
            })),
          },
          finish_reason: null,
        },
      ],
    });
  }

  chunks.push({
    id,
    object: "chat.completion.chunk",
    created,
    model: alias,
    choices: [{ index: 0, delta: {}, finish_reason: finish }],
    usage: {
      prompt_tokens: response.usage.inputTokens,
      completion_tokens: response.usage.outputTokens,
      total_tokens: response.usage.totalTokens,
    },
  });

  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n";
}
