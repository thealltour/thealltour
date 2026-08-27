import { RuntimeError, type RuntimeErrorCode } from "@/ai-runtime/domain/error";
import type { RuntimeExecutor } from "@/ai-runtime/integration/types";
import { mapRuntimeErrorCodeToHttp, mapUnknownToHttp } from "@/ai-runtime/gateway/error-mapper";
import { mapOpenAiCompatToRuntimeRequest } from "@/ai-runtime/gateway/request-mapper";
import {
  mapRuntimeResponseToOpenAiCompat,
  mapRuntimeResponseToOpenAiSse,
} from "@/ai-runtime/gateway/response-mapper";
import type { OpenAiCompatChatCompletionRequest } from "@/ai-runtime/gateway/types";

export type HandleOpenAiCompatChatCompletionOptions = {
  executor: Pick<RuntimeExecutor, "executeAndWait">;
  body: OpenAiCompatChatCompletionRequest;
  timeoutMs?: number;
  correlationId?: string;
  conversationId?: string;
  now?: () => Date;
};

export type HandleOpenAiCompatChatCompletionResult =
  | {
      ok: true;
      stream: boolean;
      status: 200;
      json?: ReturnType<typeof mapRuntimeResponseToOpenAiCompat>;
      sse?: string;
      routing: {
        requestId: string;
        alias: string;
        providerId?: string;
        modelId?: string;
        fallbackUsed?: boolean;
        attemptCount?: number;
        toolsPresent: boolean;
        toolDefinitionCount?: number;
        toolCallCount?: number;
        requiresStructuredOutput?: boolean;
        responseFormatType?: string;
        schemaPresent?: boolean;
      };
    }
  | {
      ok: false;
      status: number;
      json: ReturnType<typeof mapUnknownToHttp>["body"];
      retryable: boolean;
    };

/**
 * Hermes custom endpoint entry: OpenAI chat.completions → RuntimeExecutor → OpenAI response.
 * Streaming is emulated as a single aggregated SSE payload (no token-level streaming).
 */
export async function handleOpenAiCompatChatCompletion(
  options: HandleOpenAiCompatChatCompletionOptions,
): Promise<HandleOpenAiCompatChatCompletionResult> {
  try {
    const mapped = mapOpenAiCompatToRuntimeRequest(options.body, {
      correlationId: options.correlationId,
      conversationId: options.conversationId,
      now: options.now,
    });

    const result = await options.executor.executeAndWait(mapped.request, {
      timeoutMs: options.timeoutMs,
      now: options.now,
    });

    if (result.status !== "completed" || !result.response) {
      const code = (result.error?.code ?? "RUNTIME_ERROR") as RuntimeErrorCode;
      const http = mapRuntimeErrorCodeToHttp(
        code,
        result.error?.code ?? "runtime execution failed",
        result.error?.retryable ?? false,
      );
      return { ok: false, status: http.status, json: http.body, retryable: http.retryable };
    }

    const response = result.response;
    const routing = {
      requestId: response.requestId,
      alias: mapped.alias,
      providerId: response.providerId,
      modelId: response.modelId,
      fallbackUsed: response.routing.fallbackUsed,
      attemptCount: response.routing.attempts.length,
      toolsPresent: mapped.flags.toolsPresent,
      toolDefinitionCount: mapped.request.tools?.length ?? 0,
      toolCallCount: response.toolCalls?.length ?? 0,
      requiresStructuredOutput: mapped.request.routing?.requiresStructuredOutput === true,
      responseFormatType: mapped.request.responseFormat?.type,
      schemaPresent: mapped.request.responseFormat?.type === "json_schema",
    };

    if (mapped.flags.streamRequested) {
      return {
        ok: true,
        stream: true,
        status: 200,
        sse: mapRuntimeResponseToOpenAiSse(response, mapped.alias),
        routing,
      };
    }

    return {
      ok: true,
      stream: false,
      status: 200,
      json: mapRuntimeResponseToOpenAiCompat(response, mapped.alias),
      routing,
    };
  } catch (error) {
    if (error instanceof RuntimeError) {
      const http = mapRuntimeErrorCodeToHttp(error.code, error.message, error.retryable);
      return { ok: false, status: http.status, json: http.body, retryable: http.retryable };
    }
    const http = mapUnknownToHttp(error);
    return { ok: false, status: http.status, json: http.body, retryable: http.retryable };
  }
}
