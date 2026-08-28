import { describe, expect, it, vi } from "vitest";

import type { RuntimeResponse } from "@/ai-runtime/domain/response";
import {
  assertInferenceGatewayAuth,
  extractCompatibilityFlags,
  handleOpenAiCompatChatCompletion,
  HERMES_INFERENCE_ALIAS_AUTO,
  HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
  HERMES_INFERENCE_INTEGRATION,
  mapOpenAiCompatToRuntimeRequest,
  mapRuntimeErrorCodeToHttp,
  resolveWorkloadForAlias,
  shouldSpikeForceFallback,
} from "@/ai-runtime/gateway";

function sampleResponse(overrides: Partial<RuntimeResponse> = {}): RuntimeResponse {
  return {
    requestId: "req-spike-1",
    providerId: "gemini-main",
    modelId: "gemini-flash-lite-primary",
    content: "hello from runtime",
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    latencyMs: 12,
    finishReason: "stop",
    routing: {
      attempts: [
        {
          providerId: "gemini-main",
          modelId: "gemini-flash-lite-primary",
          startedAt: new Date(0).toISOString(),
          result: "success",
        },
      ],
      fallbackUsed: false,
    },
    ...overrides,
  };
}

describe("STEP 2-5.4C1 Hermes inference gateway", () => {
  it("maps theallcloud/auto to interactive workload and spike agentId", () => {
    expect(resolveWorkloadForAlias(HERMES_INFERENCE_ALIAS_AUTO)).toBe("manager_decision");
    const { request, alias, flags } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "ping" }],
    });
    expect(alias).toBe(HERMES_INFERENCE_ALIAS_AUTO);
    expect(request.agentId).toBe("runtime-spike");
    expect(request.source).toBe("system");
    expect(request.workload).toBe("manager_decision");
    expect(request.metadata?.correlationId).toContain(HERMES_INFERENCE_INTEGRATION);
    expect(request.metadata?.spikeForceFallback).toBeUndefined();
    expect(flags.toolsPresent).toBe(false);
  });

  it("STEP 2-5.4C4.1: auto-fallback-spike alias sets spikeForceFallback metadata", () => {
    expect(resolveWorkloadForAlias(HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE)).toBe(
      "manager_decision",
    );
    expect(shouldSpikeForceFallback(HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE)).toBe(true);
    expect(shouldSpikeForceFallback(HERMES_INFERENCE_ALIAS_AUTO, {})).toBe(false);
    expect(
      shouldSpikeForceFallback(HERMES_INFERENCE_ALIAS_AUTO, {
        AI_RUNTIME_SPIKE_FORCE_FALLBACK: "1",
      }),
    ).toBe(false);

    const { request, alias } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
      messages: [{ role: "user", content: "fallback probe" }],
    });
    expect(alias).toBe(HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE);
    expect(request.agentId).toBe("runtime-spike");
    expect(request.workload).toBe("manager_decision");
    expect(request.metadata?.spikeForceFallback).toBe(true);
    expect(request.routing?.allowFallback).toBe(true);
  });

  it("preserves tools and sets requiresToolCalling on RuntimeRequest", () => {
    const flags = extractCompatibilityFlags({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "x" }],
      tools: [{ type: "function", function: { name: "noop" } }],
    });
    expect(flags.toolsPresent).toBe(true);
    expect(flags.unsupportedFields).not.toContain("tools");

    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "x" }],
      tools: [{ type: "function", function: { name: "noop", description: "d", parameters: { type: "object" } } }],
      tool_choice: "auto",
    });
    expect(request.routing?.requiresToolCalling).toBe(true);
    expect(request.tools?.[0]?.function.name).toBe("noop");
    expect(request.toolChoice).toBe("auto");
  });


  it("preserves response_format and does not mark it unsupported", () => {
    const flags = extractCompatibilityFlags({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_object" },
    });
    expect(flags.responseFormatPresent).toBe(true);
    expect(flags.unsupportedFields).not.toContain("response_format");

    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_object" },
    });
    expect(request.responseFormat).toEqual({ type: "json_object" });
    expect(request.routing?.requiresStructuredOutput).toBe(true);
  });

  it("returns non-stream JSON completion via executor", async () => {
    const executeAndWait = vi.fn(async () => ({
      requestId: "req-spike-1",
      status: "completed" as const,
      response: sampleResponse(),
    }));

    const result = await handleOpenAiCompatChatCompletion({
      executor: { executeAndWait },
      body: {
        model: HERMES_INFERENCE_ALIAS_AUTO,
        messages: [{ role: "user", content: "hi" }],
        stream: false,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stream).toBe(false);
    expect(result.json?.choices[0]?.message.content).toBe("hello from runtime");
    expect(result.routing.providerId).toBe("gemini-main");
    expect(result.routing.fallbackUsed).toBe(false);
  });

  it("emulates stream=true as aggregated SSE without requiring true token streaming", async () => {
    const executeAndWait = vi.fn(async () => ({
      requestId: "req-spike-1",
      status: "completed" as const,
      response: sampleResponse({ content: "streamed-ish" }),
    }));

    const result = await handleOpenAiCompatChatCompletion({
      executor: { executeAndWait },
      body: {
        model: HERMES_INFERENCE_ALIAS_AUTO,
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stream).toBe(true);
    expect(result.sse).toContain("streamed-ish");
    expect(result.sse).toContain("data: [DONE]");
  });

  it("maps RATE_LIMIT to OpenAI-compatible 429", () => {
    const http = mapRuntimeErrorCodeToHttp("RATE_LIMIT", "slow down", true);
    expect(http.status).toBe(429);
    expect(http.body.error.code).toBe("rate_limit_exceeded");
    expect(http.retryable).toBe(true);
  });

  it("rejects missing bearer token", () => {
    expect(() =>
      assertInferenceGatewayAuth("Bearer wrong", {
        AI_RUNTIME_INFERENCE_GATEWAY_TOKEN: "secret-spike-token",
      }),
    ).toThrow(/unauthorized/);
  });

  it("TEST4-style: records Runtime fallback without Hermes provider fallback", async () => {
    const executeAndWait = vi.fn(async () => ({
      requestId: "req-fb",
      status: "completed" as const,
      response: sampleResponse({
        providerId: "openrouter-main",
        modelId: "openrouter-free",
        routing: {
          fallbackUsed: true,
          attempts: [
            {
              providerId: "gemini-main",
              modelId: "gemini-flash-lite-primary",
              startedAt: new Date(0).toISOString(),
              result: "provider_error",
              detail: "controlled_test_failure",
            },
            {
              providerId: "openrouter-main",
              modelId: "openrouter-free",
              startedAt: new Date(1).toISOString(),
              result: "success",
            },
          ],
        },
      }),
    }));

    const result = await handleOpenAiCompatChatCompletion({
      executor: { executeAndWait },
      body: {
        model: HERMES_INFERENCE_ALIAS_AUTO,
        messages: [{ role: "user", content: "fallback probe" }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routing.fallbackUsed).toBe(true);
    expect(result.routing.attemptCount).toBe(2);
    expect(result.routing.providerId).toBe("openrouter-main");
  });

  it("surfaces failed execution as mapped HTTP error", async () => {
    const executeAndWait = vi.fn(async () => ({
      requestId: "req-fail",
      status: "failed" as const,
      error: { code: "QUOTA_EXHAUSTED" as const, retryable: false },
    }));

    const result = await handleOpenAiCompatChatCompletion({
      executor: { executeAndWait },
      body: {
        model: HERMES_INFERENCE_ALIAS_AUTO,
        messages: [{ role: "user", content: "x" }],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(429);
    expect(result.json.error.code).toBe("insufficient_quota");
    expect(result.retryable).toBe(false);
  });
});
