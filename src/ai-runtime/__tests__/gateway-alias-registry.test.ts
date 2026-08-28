import { describe, expect, it, vi } from "vitest";

import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  HERMES_INFERENCE_ALIAS_AUTO,
  HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
} from "@/ai-runtime/integration/constants";
import {
  HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
  HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
  HERMES_INFERENCE_ALIAS_MARKETING_MANAGER,
  HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
  lookupGatewayAlias,
  resolveGatewayAlias,
  shouldSpikeForceFallback,
} from "@/ai-runtime/gateway/alias-registry";
import { validateHermesRuntimeCutoverConfig } from "@/ai-runtime/gateway/cutover-preflight";
import {
  handleOpenAiCompatChatCompletion,
  mapOpenAiCompatToRuntimeRequest,
} from "@/ai-runtime/gateway";

describe("STEP 2-5.4C6 production gateway alias registry", () => {
  it("A: thealltour/performance-analyst → agentId performance-analyst", () => {
    const entry = resolveGatewayAlias(HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST);
    expect(entry.agentId).toBe("performance-analyst");
    expect(entry.workload).toBe("analysis");
    expect(entry.kind).toBe("production");
  });

  it("B: thealltour/content-strategist → agentId content-strategist", () => {
    const entry = resolveGatewayAlias(HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST);
    expect(entry.agentId).toBe("content-strategist");
    expect(entry.workload).toBe("content_draft");
  });

  it("C: thealltour/governance-auditor → agentId governance-auditor", () => {
    const entry = resolveGatewayAlias(HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR);
    expect(entry.agentId).toBe("governance-auditor");
    expect(entry.workload).toBe("governance");
  });

  it("D: thealltour/marketing-manager → agentId marketing-manager", () => {
    const entry = resolveGatewayAlias(HERMES_INFERENCE_ALIAS_MARKETING_MANAGER);
    expect(entry.agentId).toBe("marketing-manager");
    expect(entry.workload).toBe("manager_decision");
    expect(entry.priority).toBe("high");
  });

  it("E: unknown alias → rejected", () => {
    expect(() => resolveGatewayAlias("gemini-3.5-flash-lite")).toThrow(RuntimeError);
    expect(() => resolveGatewayAlias("theallcloud/auto")).not.toThrow();
    expect(lookupGatewayAlias("openai/gpt-4o")).toBeUndefined();
    expect(() =>
      mapOpenAiCompatToRuntimeRequest({
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: "x" }],
      }),
    ).toThrow(/Unsupported inference gateway model alias/);
  });

  it("F: production alias + tools[] → requiresToolCalling=true", () => {
    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
      messages: [{ role: "user", content: "x" }],
      tools: [{ type: "function", function: { name: "get_performance_evidence" } }],
    });
    expect(request.agentId).toBe("performance-analyst");
    expect(request.routing?.requiresToolCalling).toBe(true);
  });

  it("G: production alias + response_format → requiresStructuredOutput=true", () => {
    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_GOVERNANCE_AUDITOR,
      messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_object" },
    });
    expect(request.routing?.requiresStructuredOutput).toBe(true);
    expect(request.responseFormat).toEqual({ type: "json_object" });
  });

  it("H: production alias + spike env does NOT enable spikeForceFallback", () => {
    expect(
      shouldSpikeForceFallback(HERMES_INFERENCE_ALIAS_MARKETING_MANAGER, {
        AI_RUNTIME_SPIKE_FORCE_FALLBACK: "1",
      }),
    ).toBe(false);
    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_CONTENT_STRATEGIST,
      messages: [{ role: "user", content: "x" }],
    });
    expect(request.metadata?.spikeForceFallback).toBeUndefined();
  });

  it("I: spike fallback alias + spikeForceFallback → C4.1 behavior preserved", () => {
    expect(shouldSpikeForceFallback(HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE)).toBe(true);
    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO_FALLBACK_SPIKE,
      messages: [{ role: "user", content: "fallback probe" }],
    });
    expect(request.agentId).toBe("runtime-spike");
    expect(request.metadata?.spikeForceFallback).toBe(true);
  });

  it("J: observability uses production agentId without prompt/secret fields", async () => {
    const executeAndWait = vi.fn(async () => ({
      requestId: "req-prod-1",
      status: "completed" as const,
      response: {
        requestId: "req-prod-1",
        providerId: "gemini-main",
        modelId: "gemini-flash-lite-primary",
        content: "ok",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        latencyMs: 5,
        finishReason: "stop" as const,
        routing: { attempts: [], fallbackUsed: false },
      },
    }));

    const result = await handleOpenAiCompatChatCompletion({
      executor: { executeAndWait },
      body: {
        model: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
        messages: [{ role: "user", content: "ping" }],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.routing.agentId).toBe("performance-analyst");
    expect(result.routing.workload).toBe("analysis");
    expect(result.routing.alias).toBe(HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST);
    expect(JSON.stringify(result)).not.toMatch(/sk-|GEMINI_API_KEY|Bearer /i);
    const submitted = executeAndWait.mock.calls[0]?.[0];
    expect(submitted.agentId).toBe("performance-analyst");
    expect(submitted.metadata?.correlationId).toContain("performance-analyst");
    expect(submitted.metadata?.correlationId).not.toContain("runtime-spike");
  });
});

describe("validateHermesRuntimeCutoverConfig", () => {
  const canonicalProviders = {
    "thealltour-runtime": {
      key_env: "AI_RUNTIME_INFERENCE_GATEWAY_TOKEN",
      base_url: "http://127.0.0.1:3000/api/ai-runtime/v1",
      api_mode: "chat_completions" as const,
      models: {
        [HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST]: { context_length: 128000 },
      },
    },
  };

  const canonicalModel = {
    provider: "custom:thealltour-runtime",
    default: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
    base_url: "http://127.0.0.1:3000/api/ai-runtime/v1",
    api_mode: "chat_completions" as const,
  };

  it("passes canonical named-custom production cutover shape with Hermes execution scope", () => {
    const result = validateHermesRuntimeCutoverConfig(
      {
        profileId: "performance-analyst",
        model: canonicalModel,
        fallback_providers: [],
        providers: canonicalProviders,
      },
      {
        env: { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN: "present" },
        checkHermesExecutionScope: true,
      },
    );
    expect(result.ok).toBe(true);
    expect(result.namedProviderKey).toBe("thealltour-runtime");
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("rejects C7 Attempt #1 bare custom provider shape", () => {
    const result = validateHermesRuntimeCutoverConfig(
      {
        profileId: "performance-analyst",
        model: {
          provider: "custom",
          default: HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST,
          base_url: "http://127.0.0.1:3000/api/ai-runtime/v1",
          api_mode: "chat_completions",
        },
        fallback_providers: [],
        providers: {
          "thealltour-runtime": {
            key_env: "AI_RUNTIME_INFERENCE_GATEWAY_TOKEN",
            base_url: "http://127.0.0.1:3000/api/ai-runtime/v1",
            api_mode: "chat_completions",
          },
        },
      },
      { env: { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN: "present" }, checkHermesExecutionScope: false },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "hermes_bare_custom_provider_forbidden")).toBe(true);
  });

  it("flags Node-only token visibility without Hermes execution scope", () => {
    const result = validateHermesRuntimeCutoverConfig(
      {
        profileId: "performance-analyst",
        model: canonicalModel,
        fallback_providers: [],
        providers: canonicalProviders,
      },
      {
        env: { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN: "present" },
        hermesProcessEnv: {},
        checkHermesExecutionScope: true,
        hermesHome: "/nonexistent/hermes-home-for-test",
      },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "gateway_token_not_in_hermes_execution_scope")).toBe(
      true,
    );
    expect(result.issues.some((i) => i.code === "gateway_token_node_only_mismatch")).toBe(true);
  });

  it("flags dual fallback ownership", () => {
    const result = validateHermesRuntimeCutoverConfig({
      profileId: "performance-analyst",
      model: canonicalModel,
      fallback_providers: ["openrouter"],
      providers: canonicalProviders,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "hermes_fallback_providers_nonempty")).toBe(true);
  });

  it("rejects inline api_key in providers block", () => {
    const result = validateHermesRuntimeCutoverConfig({
      profileId: "performance-analyst",
      model: canonicalModel,
      fallback_providers: [],
      providers: {
        "thealltour-runtime": {
          api_key: "inline-secret",
          base_url: "http://127.0.0.1:3000/api/ai-runtime/v1",
          api_mode: "chat_completions",
          models: {
            [HERMES_INFERENCE_ALIAS_PERFORMANCE_ANALYST]: {},
          },
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "hermes_inline_api_key_forbidden")).toBe(true);
  });
});

describe("C1 spike alias backward compatibility", () => {
  it("theallcloud/auto still maps to runtime-spike", () => {
    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "ping" }],
    });
    expect(request.agentId).toBe("runtime-spike");
    expect(request.metadata?.spikeForceFallback).toBeUndefined();
  });

  it("AI_RUNTIME_SPIKE_FORCE_FALLBACK env alone does not force fallback on theallcloud/auto", () => {
    expect(
      shouldSpikeForceFallback(HERMES_INFERENCE_ALIAS_AUTO, {
        AI_RUNTIME_SPIKE_FORCE_FALLBACK: "1",
      }),
    ).toBe(false);
  });
});
