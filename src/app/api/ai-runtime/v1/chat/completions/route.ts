import {
  assertInferenceGatewayAuth,
  handleOpenAiCompatChatCompletion,
  InferenceGatewayAuthError,
  isPrivateClientAddress,
  mapUnknownToHttp,
} from "@/ai-runtime/gateway";
import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS } from "@/ai-runtime/integration/constants";
import { resolveRuntimeEnv } from "@/lib/server/loadRuntimeEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hermes OpenAI-compatible inference boundary (SPIKE).
 * base_url example: http://127.0.0.1:3000/api/ai-runtime/v1
 * Expects POST .../chat/completions with Bearer AI_RUNTIME_INFERENCE_GATEWAY_TOKEN.
 */
export async function POST(request: Request) {
  try {
    assertInferenceGatewayAuth(request.headers.get("authorization"));

    const forwardedFor = request.headers.get("x-forwarded-for");
    if (!isPrivateClientAddress(forwardedFor)) {
      return Response.json(
        {
          error: {
            message: "inference gateway is not exposed to public networks",
            type: "invalid_request_error",
            code: "forbidden_network",
            param: null,
          },
        },
        { status: 403 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const env = resolveRuntimeEnv();
    const executor = createRuntimeExecutorStack({ env });

    const result = await handleOpenAiCompatChatCompletion({
      executor,
      body,
      timeoutMs: DEFAULT_RUNTIME_COMPLETION_TIMEOUT_MS,
    });

    if (!result.ok) {
      return Response.json(result.json, {
        status: result.status,
        headers: {
          "Cache-Control": "no-store",
          "X-AI-Runtime-Retryable": result.retryable ? "1" : "0",
        },
      });
    }

    // Safe observability headers (no prompt/secrets)
    const headers: Record<string, string> = {
      "Cache-Control": "no-store",
      "X-AI-Runtime-Request-Id": result.routing.requestId,
      "X-AI-Runtime-Alias": result.routing.alias,
      "X-AI-Runtime-Agent-Id": result.routing.agentId,
      "X-AI-Runtime-Workload": result.routing.workload,
    };
    if (result.routing.providerId) headers["X-AI-Runtime-Provider"] = result.routing.providerId;
    if (result.routing.modelId) headers["X-AI-Runtime-Model"] = result.routing.modelId;
    if (result.routing.fallbackUsed != null) {
      headers["X-AI-Runtime-Fallback"] = result.routing.fallbackUsed ? "1" : "0";
    }
    if (result.routing.attemptCount != null) {
      headers["X-AI-Runtime-Attempt-Count"] = String(result.routing.attemptCount);
    }
    if (result.routing.toolDefinitionCount != null) {
      headers["X-AI-Runtime-Tool-Defs"] = String(result.routing.toolDefinitionCount);
    }
    if (result.routing.toolCallCount != null) {
      headers["X-AI-Runtime-Tool-Calls"] = String(result.routing.toolCallCount);
    }

    if (result.stream && result.sse) {
      return new Response(result.sse, {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "text/event-stream; charset=utf-8",
        },
      });
    }

    return Response.json(result.json, { status: 200, headers });
  } catch (error) {
    if (error instanceof InferenceGatewayAuthError) {
      return Response.json(
        {
          error: {
            message: error.message,
            type: "invalid_request_error",
            code: error.status === 503 ? "gateway_misconfigured" : "unauthorized",
            param: null,
          },
        },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    const http = mapUnknownToHttp(error);
    return Response.json(http.body, {
      status: http.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
